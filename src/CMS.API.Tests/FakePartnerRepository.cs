using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests;

/// <summary>In-memory IPartnerRepository so endpoint tests run without SQL Server.</summary>
public class FakePartnerRepository : IPartnerRepository
{
    private readonly object _lock = new();
    private short _nextPkid = 100;
    private readonly List<Partner> _rows =
    [
        new()
        {
            Pkid = 1, Name = "Microsoft", AppKey = "ms", NameOnPartnerMenu = "Microsoft 微軟",
            NameOnCourseDetailPage = "微軟", DisplayOrder = 20, ImageFilename = "ms.png",
            CourseCount = 243, CertificationCount = 1
        },
        new()
        {
            Pkid = 2, Name = "Oracle", AppKey = "Oracle", NameOnPartnerMenu = "Oracle 甲骨文",
            NameOnCourseDetailPage = "Oracle", DisplayOrder = 30, ImageFilename = "Oracle.svg"
        },
        new()
        {
            Pkid = 3, Name = "Cisco", AppKey = "cisco", NameOnPartnerMenu = "Cisco 思科",
            NameOnCourseDetailPage = "Cisco", DisplayOrder = 10, SeminarCount = 2
        },
    ];

    private static Partner Copy(Partner p) => new()
    {
        Pkid = p.Pkid,
        Name = p.Name,
        AppKey = p.AppKey,
        NameOnPartnerMenu = p.NameOnPartnerMenu,
        NameOnCourseDetailPage = p.NameOnCourseDetailPage,
        DisplayOrder = p.DisplayOrder,
        ImageFilename = p.ImageFilename,
        CourseCount = p.CourseCount,
        CertificationCount = p.CertificationCount,
        PartnerCourseGroupCount = p.PartnerCourseGroupCount,
        Promotion2Count = p.Promotion2Count,
        SeminarCount = p.SeminarCount
    };

    private static IEnumerable<Partner> Ordered(IEnumerable<Partner> q)
        => q.OrderBy(p => p.DisplayOrder).ThenByDescending(p => p.Pkid);

    public Task<IEnumerable<Partner>> GetAllAsync()
    {
        lock (_lock)
            return Task.FromResult<IEnumerable<Partner>>(Ordered(_rows).Select(Copy).ToList());
    }

    public Task<IEnumerable<Partner>> QueryAsync(PartnerQuery query)
    {
        lock (_lock)
        {
            IEnumerable<Partner> q = _rows;
            if (!string.IsNullOrWhiteSpace(query.Keyword))
            {
                var k = query.Keyword.Trim();
                bool Has(string? s) => s?.Contains(k, StringComparison.OrdinalIgnoreCase) == true;
                q = q.Where(p => Has(p.Name) || Has(p.AppKey) || Has(p.NameOnPartnerMenu)
                                 || Has(p.NameOnCourseDetailPage) || Has(p.ImageFilename));
            }
            return Task.FromResult<IEnumerable<Partner>>(Ordered(q).Select(Copy).ToList());
        }
    }

    public Task<Partner?> GetByIdAsync(short pkid)
    {
        lock (_lock)
        {
            var row = _rows.FirstOrDefault(p => p.Pkid == pkid);
            return Task.FromResult(row is null ? null : Copy(row));
        }
    }

    public Task<bool> AppKeyExistsAsync(string appKey, short excludePkid = 0)
    {
        lock (_lock)
            return Task.FromResult(_rows.Any(p =>
                p.Pkid != excludePkid && string.Equals(p.AppKey, appKey, StringComparison.OrdinalIgnoreCase)));
    }

    public Task<short> CreateAsync(PartnerRequest request)
    {
        lock (_lock)
        {
            var pkid = _nextPkid++;
            _rows.Add(new Partner { Pkid = pkid });
            Apply(_rows[^1], request);
            return Task.FromResult(pkid);
        }
    }

    public Task<bool> UpdateAsync(PartnerRequest request)
    {
        lock (_lock)
        {
            var row = _rows.FirstOrDefault(p => p.Pkid == request.Pkid);
            if (row is null) return Task.FromResult(false);
            Apply(row, request);
            return Task.FromResult(true);
        }
    }

    public Task<bool> DeleteAsync(short pkid)
    {
        lock (_lock)
            return Task.FromResult(_rows.RemoveAll(p => p.Pkid == pkid) > 0);
    }

    private static void Apply(Partner row, PartnerRequest r)
    {
        row.Name = r.Name;
        row.AppKey = r.AppKey;
        row.NameOnPartnerMenu = r.NameOnPartnerMenu;
        row.NameOnCourseDetailPage = r.NameOnCourseDetailPage;
        row.DisplayOrder = r.DisplayOrder;
        row.ImageFilename = r.ImageFilename;
    }
}
