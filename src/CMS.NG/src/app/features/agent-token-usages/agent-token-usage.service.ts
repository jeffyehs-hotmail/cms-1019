import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { AgentTokenUsage, AgentTokenUsageFilterOptions, AgentTokenUsageQuery } from './agent-token-usage.model';

/** Read-only Token 用量 report. Ingest (POST /api/agent-token-usages) is done by the Claude Code hook, not the UI. */
@Injectable({ providedIn: 'root' })
export class AgentTokenUsageService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/agent-token-usages`;

  query(query: AgentTokenUsageQuery): Observable<AgentTokenUsage[]> {
    return this.http.post<AgentTokenUsage[]>(`${this.baseUrl}/query`, query);
  }

  getFilterOptions(): Observable<AgentTokenUsageFilterOptions> {
    return this.http.get<AgentTokenUsageFilterOptions>(`${this.baseUrl}/filter-options`);
  }
}
