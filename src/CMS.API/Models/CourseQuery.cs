namespace CMS.API.Models;

/// <summary>Course search DTO.</summary>
public class CourseQuery
{
    /// <summary>LIKE on Title, OfficialTitle, CourseId, ProdCourseId, FriendlyUrl.</summary>
    public string? Keyword { get; set; }
    public short? PartnerPkid { get; set; }
    public short? CourseGroupPkid { get; set; }
    public byte? PublishStatusPkid { get; set; }
    public DateOnly? ScheduleOnFrom { get; set; }
    public DateOnly? ScheduleOnTo { get; set; }
    public DateOnly? ScheduleOffFrom { get; set; }
    public DateOnly? ScheduleOffTo { get; set; }
    public bool? CanRepeat { get; set; }
}
