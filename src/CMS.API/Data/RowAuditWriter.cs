using System.Collections;
using System.Collections.Concurrent;
using System.Data;
using System.Globalization;
using System.Reflection;
using System.Text;
using CMS.API.Models;
using CMS.API.Repositories;
using Dapper;
using Microsoft.IdentityModel.JsonWebTokens;

namespace CMS.API.Data;

/// <summary>
/// Writes one RowAudit row per Insert / Update / Delete of any entity, reading the entity by reflection
/// (or, for an <see cref="AuditRow"/>, by its columns): PrimaryKeyValues = its <c>Pkid</c> property / column,
/// UserName = the signed-in user's JWT <c>name</c> claim (or "system").
/// Repositories pass their transaction so the audit row commits or rolls back with the change.
/// </summary>
public class RowAuditWriter(IRowAuditRepository repository, IHttpContextAccessor httpContextAccessor, TimeProvider time)
{
    public const string SystemUserName = "system";

    /// <summary>ActionDesc is varchar(1000): 1000 bytes in the database's code page (Chinese_Taiwan → Big5, 2 bytes per Chinese character).</summary>
    public const int MaxActionDescBytes = 1000;

    /// <summary>UserName is nvarchar(100) while AppUser.UserName allows 200; a longer name would fail the audited write.</summary>
    public const int MaxUserNameLength = 100;

    private static readonly TimeSpan TaipeiOffset = TimeSpan.FromHours(8);
    private static readonly Encoding Big5 = CodePagesEncodingProvider.Instance.GetEncoding(950)!;
    private static readonly ConcurrentDictionary<Type, PropertyInfo[]> PropertiesByType = new();

    /// <summary>ActionDesc = value of the entity's first string property.</summary>
    public Task LogInsertAsync<T>(string tableName, T entity, IDbTransaction? tx = null) where T : class
        => WriteAsync(tableName, "Insert", entity, FirstStringValue(entity), tx);

    /// <summary>ActionDesc = names of the properties whose value differs, comma-separated ("" when none).</summary>
    public Task LogUpdateAsync<T>(string tableName, T before, T after, IDbTransaction? tx = null) where T : class
        => WriteAsync(tableName, "Update", after, string.Join(",", ChangedPropertyNames(before, after)), tx);

    /// <summary>ActionDesc = value of the deleted entity's first string property.</summary>
    public Task LogDeleteAsync<T>(string tableName, T entity, IDbTransaction? tx = null) where T : class
        => WriteAsync(tableName, "Delete", entity, FirstStringValue(entity), tx);

    /// <summary>
    /// <c>SELECT *</c> of the row whose <paramref name="keyColumn"/> equals <paramref name="key"/>, read on
    /// <paramref name="tx"/> with UPDLOCK; null when there is none. <paramref name="tableName"/> and
    /// <paramref name="keyColumn"/> must be code constants.
    /// </summary>
    public static async Task<AuditRow?> LoadRowAsync(IDbTransaction tx, string tableName, object key, string keyColumn = "pkid")
    {
        using var reader = await tx.Connection!.ExecuteReaderAsync(
            $"SELECT * FROM [{tableName}] WITH (UPDLOCK) WHERE [{keyColumn}] = @key", new { key }, tx);
        if (!reader.Read()) return null;
        return new AuditRow(Enumerable.Range(0, reader.FieldCount)
            .Select(i => new AuditColumn(reader.GetName(i), reader.GetFieldType(i), reader.IsDBNull(i) ? null : reader.GetValue(i)))
            .ToList());
    }

    private Task WriteAsync(string tableName, string actionType, object entity, string? actionDesc, IDbTransaction? tx)
        => repository.InsertAsync(new RowAudit
        {
            TableName = tableName,
            UserName = CurrentUserName(),
            PrimaryKeyValues = PrimaryKeyValue(entity),
            ActionType = actionType,
            ActionDesc = actionDesc is null ? null : Truncate(actionDesc),
            DateTime = time.GetUtcNow().ToOffset(TaipeiOffset).DateTime,
        }, tx);

    private string CurrentUserName()
    {
        var user = httpContextAccessor.HttpContext?.User;
        var name = user?.Identity?.IsAuthenticated == true ? user.FindFirst(JwtRegisteredClaimNames.Name)?.Value : null;
        if (string.IsNullOrWhiteSpace(name)) return SystemUserName;
        if (name.Length <= MaxUserNameLength) return name;
        // Don't leave half a surrogate pair at the cut.
        var length = char.IsHighSurrogate(name[MaxUserNameLength - 1]) ? MaxUserNameLength - 1 : MaxUserNameLength;
        return name[..length];
    }

    /// <summary>The <c>Pkid</c> property / column (any case) as an invariant string.</summary>
    public static string PrimaryKeyValue(object entity)
    {
        var pkid = Fields(entity).FirstOrDefault(f => f.Name.Equals("pkid", StringComparison.OrdinalIgnoreCase))
            ?? throw new ArgumentException($"{entity.GetType().Name} has no pkid property.", nameof(entity));
        return Convert.ToString(pkid.Value, CultureInfo.InvariantCulture) ?? string.Empty;
    }

    /// <summary>Value of the first string property / column in declaration order; null when there is none or it is null.</summary>
    public static string? FirstStringValue(object entity)
        => Fields(entity).FirstOrDefault(f => f.Type == typeof(string))?.Value as string;

    /// <summary>Properties / columns (declaration order) whose values differ; collections and nested objects compare by content.</summary>
    public static IEnumerable<string> ChangedPropertyNames<T>(T before, T after) where T : class
    {
        var afterValues = Fields(after).ToDictionary(f => f.Name, f => f.Value, StringComparer.OrdinalIgnoreCase);
        return Fields(before)
            .Where(f => !afterValues.TryGetValue(f.Name, out var value) || !ValuesEqual(f.Value, value))
            .Select(f => f.Name);
    }

    /// <summary>Cuts <paramref name="text"/> so it fits <see cref="MaxActionDescBytes"/> Big5 bytes, never splitting a character.</summary>
    public static string Truncate(string text)
    {
        if (Big5.GetByteCount(text) <= MaxActionDescBytes) return text;
        var bytes = 0;
        var i = 0;
        while (i < text.Length)
        {
            var length = char.IsSurrogatePair(text, i) ? 2 : 1;
            bytes += Big5.GetByteCount(text.AsSpan(i, length));
            if (bytes > MaxActionDescBytes) break;
            i += length;
        }
        return text[..i];
    }

    private static IReadOnlyList<AuditColumn> Fields(object entity) => entity is AuditRow row
        ? row.Columns
        : Properties(entity.GetType()).Select(p => new AuditColumn(p.Name, p.PropertyType, p.GetValue(entity))).ToList();

    private static PropertyInfo[] Properties(Type type) => PropertiesByType.GetOrAdd(type, t => t
        .GetProperties(BindingFlags.Public | BindingFlags.Instance)
        .Where(p => p.CanRead && p.GetIndexParameters().Length == 0)
        .OrderBy(p => p.MetadataToken)
        .ToArray());

    private static bool ValuesEqual(object? a, object? b)
    {
        if (a is null || b is null) return a is null && b is null;
        var type = a.GetType();
        if (type != b.GetType()) return false;
        if (type.IsPrimitive || type.IsEnum || a is string || a is decimal || a is DateTime || a is DateOnly || a is TimeOnly
            || a is DateTimeOffset || a is TimeSpan || a is Guid)
            return a.Equals(b);
        if (a is IEnumerable left && b is IEnumerable right)
        {
            var l = left.Cast<object?>().ToList();
            var r = right.Cast<object?>().ToList();
            return l.Count == r.Count && l.Zip(r).All(x => ValuesEqual(x.First, x.Second));
        }
        // Nested objects (e.g. n-n lookup labels) have no Equals override: compare their properties.
        return Properties(type).All(p => ValuesEqual(p.GetValue(a), p.GetValue(b)));
    }
}
