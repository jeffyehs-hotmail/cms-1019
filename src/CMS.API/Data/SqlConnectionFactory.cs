using System.Data;
using Microsoft.Data.SqlClient;

namespace CMS.API.Data;

public interface IDbConnectionFactory
{
    Task<IDbConnection> OpenAsync();
}

public class SqlConnectionFactory(string connectionString) : IDbConnectionFactory
{
    public async Task<IDbConnection> OpenAsync()
    {
        var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        return connection;
    }
}
