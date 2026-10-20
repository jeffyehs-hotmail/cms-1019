using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/rowaudit")]
public class RowAuditController(IRowAuditRepository repo) : ControllerBase
{
    /// <summary>History of one record: RowAudit rows with this TableName and PrimaryKeyValues = pkid, newest first.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<RowAuditEntry>>> GetByRecord([FromQuery] string? tableName, [FromQuery] string? pkid)
    {
        tableName = tableName?.Trim();
        pkid = pkid?.Trim();
        if (string.IsNullOrEmpty(tableName) || string.IsNullOrEmpty(pkid))
            return BadRequest(new { message = "請指定資料表名稱與主代碼" });
        // Longer values cannot match the varchar(50) / nvarchar(100) columns.
        if (tableName.Length > 50 || pkid.Length > 100) return Ok(Array.Empty<RowAuditEntry>());

        return Ok(await repo.GetByRecordAsync(tableName, pkid));
    }
}
