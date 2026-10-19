namespace CMS.API.Models;

/// <summary>Slim Certification for lookups / n-n selection. Title is nchar(100) — RTRIMmed in SQL.</summary>
public class CertificationLookup
{
    public int Pkid { get; set; }
    public string Title { get; set; } = string.Empty;
    public string PartnerName { get; set; } = string.Empty;
}
