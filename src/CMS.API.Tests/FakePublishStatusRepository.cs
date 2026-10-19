using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests;

/// <summary>In-memory IPublishStatusRepository so endpoint tests run without SQL Server.</summary>
public class FakePublishStatusRepository : IPublishStatusRepository
{
    private readonly object _lock = new();
    private readonly List<PublishStatus> _rows =
    [
        new() { Pkid = 1, Description = "草稿", IsDraft = true },
        new() { Pkid = 2, Description = "上架中", IsPublished = true, CourseCount = 5, Promotion2Count = 2 },
        new() { Pkid = 3, Description = "已下架", IsDiscontinued = true },
    ];

    private static PublishStatus Copy(PublishStatus s) => new()
    {
        Pkid = s.Pkid,
        Description = s.Description,
        IsDraft = s.IsDraft,
        IsPublished = s.IsPublished,
        IsDiscontinued = s.IsDiscontinued,
        CourseCount = s.CourseCount,
        Promotion2Count = s.Promotion2Count
    };

    public Task<IEnumerable<PublishStatus>> GetAllAsync()
    {
        lock (_lock)
            return Task.FromResult<IEnumerable<PublishStatus>>(_rows.OrderBy(s => s.Pkid).Select(Copy).ToList());
    }

    public Task<IEnumerable<PublishStatus>> QueryAsync(PublishStatusQuery query)
    {
        lock (_lock)
        {
            IEnumerable<PublishStatus> q = _rows;
            if (!string.IsNullOrWhiteSpace(query.Keyword))
            {
                var k = query.Keyword.Trim();
                q = q.Where(s => s.Description.Contains(k, StringComparison.OrdinalIgnoreCase));
            }
            if (query.IsDraft.HasValue) q = q.Where(s => s.IsDraft == query.IsDraft);
            if (query.IsPublished.HasValue) q = q.Where(s => s.IsPublished == query.IsPublished);
            if (query.IsDiscontinued.HasValue) q = q.Where(s => s.IsDiscontinued == query.IsDiscontinued);
            return Task.FromResult<IEnumerable<PublishStatus>>(q.OrderBy(s => s.Pkid).Select(Copy).ToList());
        }
    }

    public Task<PublishStatus?> GetByIdAsync(byte pkid)
    {
        lock (_lock)
        {
            var row = _rows.FirstOrDefault(s => s.Pkid == pkid);
            return Task.FromResult(row is null ? null : Copy(row));
        }
    }

    public Task<bool> ExistsAsync(byte pkid)
    {
        lock (_lock)
            return Task.FromResult(_rows.Any(s => s.Pkid == pkid));
    }

    public Task CreateAsync(PublishStatusRequest request)
    {
        lock (_lock)
            _rows.Add(new PublishStatus
            {
                Pkid = request.Pkid,
                Description = request.Description,
                IsDraft = request.IsDraft,
                IsPublished = request.IsPublished,
                IsDiscontinued = request.IsDiscontinued
            });
        return Task.CompletedTask;
    }

    public Task<bool> UpdateAsync(PublishStatusRequest request)
    {
        lock (_lock)
        {
            var row = _rows.FirstOrDefault(s => s.Pkid == request.Pkid);
            if (row is null) return Task.FromResult(false);
            row.Description = request.Description;
            row.IsDraft = request.IsDraft;
            row.IsPublished = request.IsPublished;
            row.IsDiscontinued = request.IsDiscontinued;
            return Task.FromResult(true);
        }
    }

    public Task<bool> DeleteAsync(byte pkid)
    {
        lock (_lock)
            return Task.FromResult(_rows.RemoveAll(s => s.Pkid == pkid) > 0);
    }
}
