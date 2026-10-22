using CMS.API.Models;
using CMS.API.Repositories;
using CMS.API.Security;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/rowaudit")]
public class RowAuditController(IRowAuditRepository repo) : ControllerBase
{
    /// <summary>
    /// Tables whose repositories write RowAudit, keyed case-insensitively to their canonical name. Only a canonical name
    /// reaches SQL: the column collation is width-insensitive, so a raw "ＡｐｐＲｏｌｅ" would match AppRole rows there.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string> AuditedTables =
        new[] { "AppRole", "AppUser", "Course", "CourseGroup", "FeaturedPromoItem", "Partner", "PublishStatus" }
            .ToDictionary(t => t, StringComparer.OrdinalIgnoreCase);

    /// <summary>History of these tables is Admin-only, like their APIs (it names every account and who changed roles).</summary>
    public static readonly IReadOnlySet<string> AdminOnlyTables = new HashSet<string>(["AppUser", "AppRole"]);

    /// <summary>History of one record: RowAudit rows with this TableName and PrimaryKeyValues = pkid, newest first.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<RowAuditEntry>>> GetByRecord([FromQuery] string? tableName, [FromQuery] string? pkid)
    {
        tableName = tableName?.Trim();
        pkid = pkid?.Trim();
        if (string.IsNullOrEmpty(tableName) || string.IsNullOrEmpty(pkid))
            return BadRequest(new { message = "請指定資料表名稱與主代碼" });
        if (!AuditedTables.TryGetValue(tableName, out var table)) return Ok(Array.Empty<RowAuditEntry>());
        if (AdminOnlyTables.Contains(table) && !User.IsInRole(AppUsersController.AdminRole))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = JwtAuthentication.Forbidden });
        // Longer values cannot match the nvarchar(100) column.
        if (pkid.Length > 100) return Ok(Array.Empty<RowAuditEntry>());

        return Ok(await repo.GetByRecordAsync(table, pkid));
    }
}
