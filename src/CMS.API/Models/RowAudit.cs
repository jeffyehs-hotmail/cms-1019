namespace CMS.API.Models;

/// <summary>One RowAudit row (pkid is IDENTITY, so it is not part of the insert).</summary>
public class RowAudit
{
    public string TableName { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string PrimaryKeyValues { get; set; } = string.Empty;
    /// <summary>"Insert" | "Update" | "Delete".</summary>
    public string ActionType { get; set; } = string.Empty;
    /// <summary>Insert/Delete: first string property's value; Update: changed property names, comma-separated.</summary>
    public string? ActionDesc { get; set; }
    public DateTime DateTime { get; set; }
}
