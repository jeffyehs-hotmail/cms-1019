using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests;

/// <summary>In-memory ICourseRepository so endpoint tests run without SQL Server.</summary>
/// <remarks>Publish status description and IsPublished come from the factory's status fake, like the SQL JOIN.</remarks>
public class FakeCourseRepository(FakePublishStatusRepository publishStatuses) : ICourseRepository
{
    // Reference data the FK / n-n checks validate against.
    public static readonly Dictionary<short, string> Partners = new() { [1] = "Microsoft", [3] = "Cisco" };
    public static readonly Dictionary<short, string> CourseGroups = new() { [10] = "Azure", [11] = "CCNA" };
    public static readonly List<CertificationLookup> Certifications =
    [
        new() { Pkid = 1, Title = "Azure Administrator", PartnerName = "Microsoft" },
        new() { Pkid = 2, Title = "CCNA", PartnerName = "Cisco" },
    ];
    public static readonly List<JobCategoryLookup> JobCategories =
    [
        new() { Pkid = 1, Description = "系統管理" },
        new() { Pkid = 2, Description = "網路工程" },
    ];

    private readonly object _lock = new();
    private int _nextPkid = 100;
    private readonly List<Course> _rows =
    [
        new()
        {
            Pkid = 1, Title = "Azure 管理", CourseId = "AZ104", ProdCourseId = "AZ-104", FriendlyUrl = "az-104",
            DisplayOrder = 2, PartnerPkid = 1, CourseGroupPkid = 10, PublishStatusPkid = 2,
            ScheduleOn = new DateOnly(2025, 1, 1), ScheduleOff = new DateOnly(2027, 12, 31),
            Hour = 32, ListPrice = 28000, LearningCredit = 4.5m, CanRepeat = true, Outline = "大綱",
            CourseFaqCount = 2, Certifications = [Certifications[0]], JobCategories = [JobCategories[0]]
        },
        new()
        {
            Pkid = 2, Title = "CCNA 網路", OfficialTitle = "Implementing and Administering Cisco Solutions",
            CourseId = "CCNA", ProdCourseId = "CCNA", FriendlyUrl = "ccna",
            DisplayOrder = 1, PartnerPkid = 3, PublishStatusPkid = 1,
            ScheduleOn = new DateOnly(2026, 3, 1), ScheduleOff = new DateOnly(2026, 12, 31),
            Hour = 40, ListPrice = 30000, LearningCredit = 5m
        },
        new()
        {
            Pkid = 3, Title = "AI 入門", CourseId = "AI900", ProdCourseId = "AI-900", FriendlyUrl = "ai-900",
            DisplayOrder = 1, PartnerPkid = 1, CourseGroupPkid = 10, PublishStatusPkid = 3,
            ScheduleOn = new DateOnly(2024, 6, 1), ScheduleOff = new DateOnly(2025, 12, 31),
            Hour = 7, ListPrice = 9000, LearningCredit = 2.5m, HotCourseCount = 1
        },
    ];

    private Course Copy(Course c, bool full) => new()
    {
        Pkid = c.Pkid,
        Title = c.Title,
        OfficialTitle = c.OfficialTitle,
        CourseId = c.CourseId,
        ProdCourseId = c.ProdCourseId,
        FriendlyUrl = c.FriendlyUrl,
        DisplayOrder = c.DisplayOrder,
        PartnerPkid = c.PartnerPkid,
        PartnerName = Partners.GetValueOrDefault(c.PartnerPkid, ""),
        CourseGroupPkid = c.CourseGroupPkid,
        CourseGroupDescription = c.CourseGroupPkid is { } g ? CourseGroups.GetValueOrDefault(g) : null,
        PublishStatusPkid = c.PublishStatusPkid,
        PublishStatusDescription = publishStatuses.Find(c.PublishStatusPkid)?.Description ?? "",
        PublishStatusIsPublished = publishStatuses.Find(c.PublishStatusPkid)?.IsPublished ?? false,
        ScheduleOn = c.ScheduleOn,
        ScheduleOff = c.ScheduleOff,
        Hour = c.Hour,
        ListPrice = c.ListPrice,
        LearningCredit = c.LearningCredit,
        CanRepeat = c.CanRepeat,
        Material = full ? c.Material : null,
        Objective = full ? c.Objective : null,
        Target = full ? c.Target : null,
        Prerequisites = full ? c.Prerequisites : null,
        Outline = full ? c.Outline : null,
        TowardCertOrExam = full ? c.TowardCertOrExam : null,
        Note = full ? c.Note : null,
        OtherInfo = full ? c.OtherInfo : null,
        CourseFaqCount = c.CourseFaqCount,
        CourseRelatedLinkCount = c.CourseRelatedLinkCount,
        HotCourseCount = c.HotCourseCount,
        Certifications = full ? [.. c.Certifications] : [],
        JobCategories = full ? [.. c.JobCategories] : [],
    };

    private static IEnumerable<Course> Ordered(IEnumerable<Course> q)
        => q.OrderBy(c => c.DisplayOrder).ThenByDescending(c => c.Pkid);

    public Task<IEnumerable<Course>> GetAllAsync()
    {
        lock (_lock)
            return Task.FromResult<IEnumerable<Course>>(Ordered(_rows).Select(c => Copy(c, false)).ToList());
    }

    public Task<IEnumerable<Course>> QueryAsync(CourseQuery query)
    {
        lock (_lock)
        {
            IEnumerable<Course> q = _rows;
            if (!string.IsNullOrWhiteSpace(query.Keyword))
            {
                var k = query.Keyword.Trim();
                bool Has(string? s) => s?.Contains(k, StringComparison.OrdinalIgnoreCase) == true;
                q = q.Where(c => Has(c.Title) || Has(c.OfficialTitle) || Has(c.CourseId)
                                 || Has(c.ProdCourseId) || Has(c.FriendlyUrl));
            }
            if (query.PartnerPkid.HasValue) q = q.Where(c => c.PartnerPkid == query.PartnerPkid);
            if (query.CourseGroupPkid.HasValue) q = q.Where(c => c.CourseGroupPkid == query.CourseGroupPkid);
            if (query.PublishStatusPkid.HasValue) q = q.Where(c => c.PublishStatusPkid == query.PublishStatusPkid);
            if (query.ScheduleOnFrom.HasValue) q = q.Where(c => c.ScheduleOn >= query.ScheduleOnFrom);
            if (query.ScheduleOnTo.HasValue) q = q.Where(c => c.ScheduleOn <= query.ScheduleOnTo);
            if (query.ScheduleOffFrom.HasValue) q = q.Where(c => c.ScheduleOff >= query.ScheduleOffFrom);
            if (query.ScheduleOffTo.HasValue) q = q.Where(c => c.ScheduleOff <= query.ScheduleOffTo);
            if (query.CanRepeat.HasValue) q = q.Where(c => c.CanRepeat == query.CanRepeat);
            return Task.FromResult<IEnumerable<Course>>(Ordered(q).Select(c => Copy(c, false)).ToList());
        }
    }

    public Task<Course?> GetByIdAsync(int pkid)
    {
        lock (_lock)
        {
            var row = _rows.FirstOrDefault(c => c.Pkid == pkid);
            return Task.FromResult(row is null ? null : Copy(row, true));
        }
    }

    public Task<bool> CourseIdExistsAsync(string courseId, int excludePkid = 0)
    {
        lock (_lock)
            return Task.FromResult(_rows.Any(c =>
                c.Pkid != excludePkid && string.Equals(c.CourseId, courseId, StringComparison.OrdinalIgnoreCase)));
    }

    public Task<CourseReferenceCheck> CheckReferencesAsync(CourseRequest r)
        => Task.FromResult(new CourseReferenceCheck
        {
            PartnerExists = Partners.ContainsKey(r.PartnerPkid),
            CourseGroupExists = r.CourseGroupPkid is not { } g || CourseGroups.ContainsKey(g),
            PublishStatusExists = publishStatuses.Find(r.PublishStatusPkid) is not null,
            MissingCertificationPkids = r.CertificationPkids.Distinct()
                .Where(id => Certifications.All(c => c.Pkid != id)).ToList(),
            MissingJobCategoryPkids = r.JobCategoryPkids.Distinct()
                .Where(id => JobCategories.All(j => j.Pkid != id)).ToList(),
        });

    public Task<int> CreateAsync(CourseRequest request)
    {
        lock (_lock)
        {
            var pkid = _nextPkid++;
            _rows.Add(new Course { Pkid = pkid });
            Apply(_rows[^1], request);
            return Task.FromResult(pkid);
        }
    }

    public Task<bool> UpdateAsync(CourseRequest request)
    {
        lock (_lock)
        {
            var row = _rows.FirstOrDefault(c => c.Pkid == request.Pkid);
            if (row is null) return Task.FromResult(false);
            Apply(row, request);
            return Task.FromResult(true);
        }
    }

    public Task<bool> DeleteAsync(int pkid)
    {
        lock (_lock)
            return Task.FromResult(_rows.RemoveAll(c => c.Pkid == pkid) > 0);
    }

    private static void Apply(Course row, CourseRequest r)
    {
        row.Title = r.Title;
        row.OfficialTitle = r.OfficialTitle;
        row.CourseId = r.CourseId;
        row.ProdCourseId = r.ProdCourseId;
        row.FriendlyUrl = r.FriendlyUrl;
        row.DisplayOrder = r.DisplayOrder;
        row.PartnerPkid = r.PartnerPkid;
        row.CourseGroupPkid = r.CourseGroupPkid;
        row.PublishStatusPkid = r.PublishStatusPkid;
        row.ScheduleOn = r.ScheduleOn!.Value;
        row.ScheduleOff = r.ScheduleOff!.Value;
        row.Hour = r.Hour;
        row.ListPrice = r.ListPrice;
        row.LearningCredit = r.LearningCredit;
        row.CanRepeat = r.CanRepeat;
        row.Material = r.Material;
        row.Objective = r.Objective;
        row.Target = r.Target;
        row.Prerequisites = r.Prerequisites;
        row.Outline = r.Outline;
        row.TowardCertOrExam = r.TowardCertOrExam;
        row.Note = r.Note;
        row.OtherInfo = r.OtherInfo;
        row.Certifications = Certifications.Where(c => r.CertificationPkids.Contains(c.Pkid)).ToList();
        row.JobCategories = JobCategories.Where(j => r.JobCategoryPkids.Contains(j.Pkid)).ToList();
    }
}
