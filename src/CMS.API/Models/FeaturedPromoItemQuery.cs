namespace CMS.API.Models;

/// <summary>FeaturedPromoItem search DTO: one Monday–Sunday week, optionally for one training center.</summary>
public class FeaturedPromoItemQuery
{
    public short? TrainingCenterPkid { get; set; }

    /// <summary>Any date in the wanted week; null = the current week.</summary>
    public DateOnly? WeekOf { get; set; }

    /// <summary>Monday and Sunday of the week containing <paramref name="date"/>.</summary>
    public static (DateOnly Monday, DateOnly Sunday) WeekRange(DateOnly date)
    {
        var monday = date.AddDays(-(((int)date.DayOfWeek + 6) % 7));
        return (monday, monday.AddDays(6));
    }
}
