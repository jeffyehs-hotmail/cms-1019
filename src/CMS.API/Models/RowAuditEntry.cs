namespace CMS.API.Models;

/// <summary>One RowAudit row of a record's history, as returned by <c>GET api/rowaudit</c>.</summary>
public class RowAuditEntry
{
    /// <summary>Taipei time, as stored.</summary>
    public DateTime DateTime { get; set; }
    public string UserName { get; set; } = string.Empty;
    /// <summary>"Insert" | "Update" | "Delete".</summary>
    public string ActionType { get; set; } = string.Empty;
    public string? ActionDesc { get; set; }
}
