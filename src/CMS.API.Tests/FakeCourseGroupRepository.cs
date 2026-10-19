using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests;

/// <summary>In-memory ICourseGroupRepository so endpoint tests run without SQL Server.</summary>
public class FakeCourseGroupRepository : ICourseGroupRepository
{
    private readonly object _lock = new();
    private short _nextPkid = 100;
    private readonly List<CourseGroup> _rows =
    [
        new() { Pkid = 1, Description = "Windows Server", CourseCount = 12, PartnerCourseGroupCount = 1 },
        new() { Pkid = 2, Description = "Azure 雲端" },
        new() { Pkid = 3, Description = "CCNA", PartnerCourseGroupCount = 2 },
    ];

    private static CourseGroup Copy(CourseGroup g) => new()
    {
        Pkid = g.Pkid,
        Description = g.Description,
        CourseCount = g.CourseCount,
        PartnerCourseGroupCount = g.PartnerCourseGroupCount
    };

    private static IEnumerable<CourseGroup> Ordered(IEnumerable<CourseGroup> q)
        => q.OrderByDescending(g => g.Pkid);

    public Task<IEnumerable<CourseGroup>> GetAllAsync()
    {
        lock (_lock)
            return Task.FromResult<IEnumerable<CourseGroup>>(Ordered(_rows).Select(Copy).ToList());
    }

    public Task<IEnumerable<CourseGroup>> QueryAsync(CourseGroupQuery query)
    {
        lock (_lock)
        {
            IEnumerable<CourseGroup> q = _rows;
            if (!string.IsNullOrWhiteSpace(query.Keyword))
            {
                var k = query.Keyword.Trim();
                q = q.Where(g => g.Description.Contains(k, StringComparison.OrdinalIgnoreCase));
            }
            return Task.FromResult<IEnumerable<CourseGroup>>(Ordered(q).Select(Copy).ToList());
        }
    }

    public Task<CourseGroup?> GetByIdAsync(short pkid)
    {
        lock (_lock)
        {
            var row = _rows.FirstOrDefault(g => g.Pkid == pkid);
            return Task.FromResult(row is null ? null : Copy(row));
        }
    }

    public Task<short> CreateAsync(CourseGroupRequest request)
    {
        lock (_lock)
        {
            var pkid = _nextPkid++;
            _rows.Add(new CourseGroup { Pkid = pkid, Description = request.Description });
            return Task.FromResult(pkid);
        }
    }

    public Task<bool> UpdateAsync(CourseGroupRequest request)
    {
        lock (_lock)
        {
            var row = _rows.FirstOrDefault(g => g.Pkid == request.Pkid);
            if (row is null) return Task.FromResult(false);
            row.Description = request.Description;
            return Task.FromResult(true);
        }
    }

    public Task<bool> DeleteAsync(short pkid)
    {
        lock (_lock)
            return Task.FromResult(_rows.RemoveAll(g => g.Pkid == pkid) > 0);
    }
}
