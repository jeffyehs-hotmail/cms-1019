namespace CMS.API.Models;

/// <summary>AppUser search DTO.</summary>
public class AppUserQuery
{
    /// <summary>LIKE on UserId, UserName.</summary>
    public string? Keyword { get; set; }

    public bool? IsActive { get; set; }

    /// <summary>Users assigned to this AppRole.RoleId.</summary>
    public string? RoleId { get; set; }
}
