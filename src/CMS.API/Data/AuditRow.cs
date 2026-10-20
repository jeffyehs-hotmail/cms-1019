namespace CMS.API.Data;

/// <summary>One column of an <see cref="AuditRow"/>: its database name, CLR type (known even when the value is NULL) and value.</summary>
public sealed record AuditColumn(string Name, Type Type, object? Value);

/// <summary>
/// A table row exactly as <c>SELECT *</c> returns it (columns in table order, real column names), loaded by
/// <see cref="RowAuditWriter.LoadRowAsync"/> so RowAudit compares and describes database columns, not model properties.
/// </summary>
public sealed class AuditRow(IReadOnlyList<AuditColumn> columns)
{
    public IReadOnlyList<AuditColumn> Columns { get; } = columns;

    /// <summary>Value of the column (case-insensitive name); throws when the table has no such column.</summary>
    public object? this[string column]
        => (Columns.FirstOrDefault(c => c.Name.Equals(column, StringComparison.OrdinalIgnoreCase))
            ?? throw new ArgumentException($"Row has no column {column}.", nameof(column))).Value;
}
