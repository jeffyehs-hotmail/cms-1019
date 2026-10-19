# CMS

| Project | Stack | Run | Test |
|---|---|---|---|
| `CMS.API` | .NET 9 Web API, Dapper, Swagger | `dotnet run --project CMS.API` → http://localhost:5000/swagger | `dotnet test` |
| `CMS.API.Tests` | xUnit + WebApplicationFactory (in-memory fake repository, no DB needed) | | `dotnet test` |
| `CMS.NG` | Angular 20 (standalone), PrimeNG 20 | `cd CMS.NG && npm start` → http://localhost:4200 | `npm test` (watch) / `npm run test:ci` (headless) |

- Connection string: `CMS.API/appsettings.json` → `ConnectionStrings:CMS`
- API base URL for the frontend: `CMS.NG/src/environments/environment*.ts`, imported as `@env/environment`
- `global.json` pins the .NET 9 SDK.

## Features
- **系統管理 Admin › 角色 AppRole** — list (keyword / permission-level filter, sort, paging persisted in session storage), view, add, edit, delete; user assignment via `AppUserRole`.
