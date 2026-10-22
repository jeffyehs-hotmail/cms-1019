using System.Data;
using System.Text;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class CourseRepository(IDbConnectionFactory db, RowAuditWriter audit) : ICourseRepository
{
    private const string Table = "Course";

    // List columns only — the long texts (up to nvarchar(max)) are loaded by GetByIdAsync.
    private const string ListColumns = """
        c.pkid, c.Title, c.OfficialTitle, c.CourseId, c.ProdCourseId, c.FriendlyUrl, c.DisplayOrder,
        c.Partner_pkid AS PartnerPkid, p.Name AS PartnerName,
        c.CourseGroup_pkid AS CourseGroupPkid, g.Description AS CourseGroupDescription,
        c.PublishStatus_pkid AS PublishStatusPkid, s.Description AS PublishStatusDescription,
        c.ScheduleOn, c.ScheduleOff, c.Hour, c.ListPrice, c.LearningCredit, c.CanRepeat,
        (SELECT COUNT(*) FROM CourseFAQ f WHERE f.Course_pkid = c.pkid) AS CourseFaqCount,
        (SELECT COUNT(*) FROM CourseRelatedLink l WHERE l.Course_pkid = c.pkid) AS CourseRelatedLinkCount,
        (SELECT COUNT(*) FROM HotCourse h WHERE h.Course_pkid = c.pkid) AS HotCourseCount
        """;

    private const string TextColumns = """
        , c.Material, c.Objective, c.Target, c.Prerequisites, c.Outline, c.TowardCertOrExam, c.Note, c.OtherInfo
        """;

    private const string FromSql = """

        FROM Course c
        JOIN Partner p ON p.pkid = c.Partner_pkid
        LEFT JOIN CourseGroup g ON g.pkid = c.CourseGroup_pkid
        JOIN PublishStatus s ON s.pkid = c.PublishStatus_pkid
        """;

    private const string DefaultOrder = " ORDER BY c.DisplayOrder ASC, c.pkid DESC";

    public async Task<IEnumerable<Course>> GetAllAsync()
    {
        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<Course>("SELECT " + ListColumns + FromSql + DefaultOrder);
    }

    public async Task<IEnumerable<Course>> QueryAsync(CourseQuery query)
    {
        var sql = new StringBuilder("SELECT ").Append(ListColumns).Append(FromSql).Append(" WHERE 1 = 1");
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            sql.Append(" AND (c.Title LIKE @Keyword OR c.OfficialTitle LIKE @Keyword OR c.CourseId LIKE @Keyword")
               .Append(" OR c.ProdCourseId LIKE @Keyword OR c.FriendlyUrl LIKE @Keyword)");
            p.Add("Keyword", $"%{query.Keyword.Trim()}%");
        }
        if (query.PartnerPkid.HasValue)
        {
            sql.Append(" AND c.Partner_pkid = @PartnerPkid");
            p.Add("PartnerPkid", query.PartnerPkid);
        }
        if (query.CourseGroupPkid.HasValue)
        {
            sql.Append(" AND c.CourseGroup_pkid = @CourseGroupPkid");
            p.Add("CourseGroupPkid", query.CourseGroupPkid);
        }
        if (query.PublishStatusPkid.HasValue)
        {
            sql.Append(" AND c.PublishStatus_pkid = @PublishStatusPkid");
            p.Add("PublishStatusPkid", query.PublishStatusPkid);
        }
        AddDate(sql, p, "c.ScheduleOn >=", "ScheduleOnFrom", query.ScheduleOnFrom);
        AddDate(sql, p, "c.ScheduleOn <=", "ScheduleOnTo", query.ScheduleOnTo);
        AddDate(sql, p, "c.ScheduleOff >=", "ScheduleOffFrom", query.ScheduleOffFrom);
        AddDate(sql, p, "c.ScheduleOff <=", "ScheduleOffTo", query.ScheduleOffTo);
        if (query.CanRepeat.HasValue)
        {
            sql.Append(" AND c.CanRepeat = @CanRepeat");
            p.Add("CanRepeat", query.CanRepeat);
        }

        sql.Append(DefaultOrder);

        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<Course>(sql.ToString(), p);
    }

    public async Task<Course?> GetByIdAsync(int pkid)
    {
        using var conn = await db.OpenAsync();
        var course = await conn.QuerySingleOrDefaultAsync<Course>(
            "SELECT " + ListColumns + TextColumns + FromSql + " WHERE c.pkid = @pkid", new { pkid });
        if (course is null) return null;

        // n-n: separate queries on same connection
        course.Certifications = (await conn.QueryAsync<CertificationLookup>("""
            SELECT ce.pkid, RTRIM(ce.Title) AS Title, p.Name AS PartnerName
            FROM CourseInCertification x
            JOIN Certification ce ON ce.pkid = x.Certification_pkid
            JOIN Partner p ON p.pkid = ce.Partner_pkid
            WHERE x.Course_pkid = @pkid
            ORDER BY p.DisplayOrder, p.Name, ce.Title
            """, new { pkid })).ToList();

        course.JobCategories = (await conn.QueryAsync<JobCategoryLookup>("""
            SELECT j.pkid, j.Description
            FROM CourseJobCategories x
            JOIN JobCategory j ON j.pkid = x.JobCategory_pkid
            WHERE x.Course_pkid = @pkid
            ORDER BY j.Description
            """, new { pkid })).ToList();

        return course;
    }

    public async Task<bool> CourseIdExistsAsync(string courseId, int excludePkid = 0)
    {
        using var conn = await db.OpenAsync();
        return await conn.ExecuteScalarAsync<bool>(
            "SELECT CASE WHEN EXISTS (SELECT 1 FROM Course WHERE CourseId = @courseId AND pkid <> @excludePkid) THEN 1 ELSE 0 END",
            new { courseId = Ansi(courseId), excludePkid });
    }

    public async Task<CourseReferenceCheck> CheckReferencesAsync(CourseRequest r)
    {
        var certIds = r.CertificationPkids.Distinct().ToList();
        var jobIds = r.JobCategoryPkids.Distinct().ToList();

        using var conn = await db.OpenAsync();
        var row = await conn.QuerySingleAsync<(bool PartnerExists, bool CourseGroupExists, bool PublishStatusExists)>("""
            SELECT CAST(CASE WHEN EXISTS (SELECT 1 FROM Partner WHERE pkid = @PartnerPkid) THEN 1 ELSE 0 END AS bit),
                   CAST(CASE WHEN @CourseGroupPkid IS NULL
                               OR EXISTS (SELECT 1 FROM CourseGroup WHERE pkid = @CourseGroupPkid) THEN 1 ELSE 0 END AS bit),
                   CAST(CASE WHEN EXISTS (SELECT 1 FROM PublishStatus WHERE pkid = @PublishStatusPkid) THEN 1 ELSE 0 END AS bit)
            """, new { r.PartnerPkid, r.CourseGroupPkid, r.PublishStatusPkid });

        HashSet<int> foundCerts = certIds.Count == 0 ? [] : (await conn.QueryAsync<int>(
            "SELECT pkid FROM Certification WHERE pkid IN @certIds", new { certIds })).ToHashSet();
        HashSet<short> foundJobs = jobIds.Count == 0 ? [] : (await conn.QueryAsync<short>(
            "SELECT pkid FROM JobCategory WHERE pkid IN @jobIds", new { jobIds })).ToHashSet();

        return new CourseReferenceCheck
        {
            PartnerExists = row.PartnerExists,
            CourseGroupExists = row.CourseGroupExists,
            PublishStatusExists = row.PublishStatusExists,
            MissingCertificationPkids = certIds.Where(id => !foundCerts.Contains(id)).ToList(),
            MissingJobCategoryPkids = jobIds.Where(id => !foundJobs.Contains(id)).ToList(),
        };
    }

    public async Task<int> CreateAsync(CourseRequest request)
    {
        using var conn = await db.OpenAsync();
        using var tx = conn.BeginTransaction();

        var pkid = await conn.ExecuteScalarAsync<int>("""
            INSERT INTO Course (Title, OfficialTitle, CourseId, ProdCourseId, FriendlyUrl, DisplayOrder,
                Partner_pkid, CourseGroup_pkid, PublishStatus_pkid, ScheduleOn, ScheduleOff, Hour, ListPrice,
                LearningCredit, Material, Objective, Target, Prerequisites, Outline, TowardCertOrExam, Note, OtherInfo, CanRepeat)
            VALUES (@Title, @OfficialTitle, @CourseId, @ProdCourseId, @FriendlyUrl, @DisplayOrder,
                @PartnerPkid, @CourseGroupPkid, @PublishStatusPkid, @ScheduleOn, @ScheduleOff, @Hour, @ListPrice,
                @LearningCredit, @Material, @Objective, @Target, @Prerequisites, @Outline, @TowardCertOrExam, @Note, @OtherInfo, @CanRepeat);
            SELECT CAST(SCOPE_IDENTITY() AS int);
            """, ToParams(request), tx);

        await InsertLinksAsync(conn, tx, pkid, request);

        await audit.LogInsertAsync(Table, (await RowAuditWriter.LoadRowAsync(tx, Table, pkid))!, tx);
        tx.Commit();
        return pkid;
    }

    public async Task<bool> UpdateAsync(CourseRequest request)
    {
        using var conn = await db.OpenAsync();
        using var tx = conn.BeginTransaction();

        var before = await RowAuditWriter.LoadRowAsync(tx, Table, request.Pkid);
        if (before is null) return false;
        var oldCourseId = (string)before["CourseId"]!;

        await conn.ExecuteAsync("""
            UPDATE Course
            SET Title = @Title, OfficialTitle = @OfficialTitle, CourseId = @CourseId, ProdCourseId = @ProdCourseId,
                FriendlyUrl = @FriendlyUrl, DisplayOrder = @DisplayOrder, Partner_pkid = @PartnerPkid,
                CourseGroup_pkid = @CourseGroupPkid, PublishStatus_pkid = @PublishStatusPkid,
                ScheduleOn = @ScheduleOn, ScheduleOff = @ScheduleOff, Hour = @Hour, ListPrice = @ListPrice,
                LearningCredit = @LearningCredit, Material = @Material, Objective = @Objective, Target = @Target,
                Prerequisites = @Prerequisites, Outline = @Outline, TowardCertOrExam = @TowardCertOrExam,
                Note = @Note, OtherInfo = @OtherInfo, CanRepeat = @CanRepeat
            WHERE pkid = @Pkid
            """, ToParams(request), tx);

        // CourseRecomm is keyed by the CourseId string (no FK) — carry recommendations over to the new id.
        if (!string.Equals(oldCourseId, request.CourseId, StringComparison.Ordinal))
            await conn.ExecuteAsync("""
                UPDATE CourseRecomm SET CourseId = @newId WHERE CourseId = @oldId;
                UPDATE CourseRecomm SET RecommCourseId = @newId WHERE RecommCourseId = @oldId;
                """, new { newId = Ansi(request.CourseId), oldId = Ansi(oldCourseId) }, tx);

        // n-n: delete-then-reinsert
        await conn.ExecuteAsync("""
            DELETE FROM CourseInCertification WHERE Course_pkid = @Pkid;
            DELETE FROM CourseJobCategories WHERE Course_pkid = @Pkid;
            """, new { request.Pkid }, tx);
        await InsertLinksAsync(conn, tx, request.Pkid, request);

        await audit.LogUpdateAsync(Table, before, (await RowAuditWriter.LoadRowAsync(tx, Table, request.Pkid))!, tx);
        tx.Commit();
        return true;
    }

    public async Task<bool> DeleteAsync(int pkid)
    {
        using var conn = await db.OpenAsync();
        using var tx = conn.BeginTransaction();

        var row = await RowAuditWriter.LoadRowAsync(tx, Table, pkid);
        if (row is null) return false;
        var courseId = (string)row["CourseId"]!;

        // CourseRecomm has no FK; CourseInCertification / CourseJobCategories cascade.
        await conn.ExecuteAsync(
            "DELETE FROM CourseRecomm WHERE CourseId = @courseId OR RecommCourseId = @courseId",
            new { courseId = Ansi(courseId) }, tx);
        await conn.ExecuteAsync("DELETE FROM Course WHERE pkid = @pkid", new { pkid }, tx);

        await audit.LogDeleteAsync(Table, row, tx);
        tx.Commit();
        return true;
    }

    private static async Task InsertLinksAsync(IDbConnection conn, IDbTransaction tx, int pkid, CourseRequest r)
    {
        var certs = r.CertificationPkids.Distinct()
            .Select(id => new { Pkid = pkid, Id = id }).ToList();
        if (certs.Count > 0)
            await conn.ExecuteAsync(
                "INSERT INTO CourseInCertification (Course_pkid, Certification_pkid) VALUES (@Pkid, @Id)", certs, tx);

        var jobs = r.JobCategoryPkids.Distinct()
            .Select(id => new { Pkid = pkid, Id = id }).ToList();
        if (jobs.Count > 0)
            await conn.ExecuteAsync(
                "INSERT INTO CourseJobCategories (Course_pkid, JobCategory_pkid) VALUES (@Pkid, @Id)", jobs, tx);
    }

    private static void AddDate(StringBuilder sql, DynamicParameters p, string condition, string name, DateOnly? value)
    {
        if (!value.HasValue) return;
        sql.Append($" AND {condition} @{name}");
        p.Add(name, value.Value);
    }

    private static DbString Ansi(string value) => new() { Value = value, IsAnsi = true, Length = 50 };

    // CourseId / ProdCourseId are varchar — send them as AnsiString rather than nvarchar.
    private static DynamicParameters ToParams(CourseRequest r)
    {
        var p = new DynamicParameters(r);
        p.Add("CourseId", r.CourseId, DbType.AnsiString, size: 50);
        p.Add("ProdCourseId", r.ProdCourseId, DbType.AnsiString, size: 50);
        p.Add("ScheduleOn", r.ScheduleOn!.Value);
        p.Add("ScheduleOff", r.ScheduleOff!.Value);
        return p;
    }
}
