import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { AgentTokenResponse, AppUser, AppUserQuery, AppUserRequest } from './app-user.model';

@Injectable({ providedIn: 'root' })
export class AppUserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/app-users`;

  getAll(): Observable<AppUser[]> {
    return this.http.get<AppUser[]>(this.baseUrl);
  }

  query(query: AppUserQuery): Observable<AppUser[]> {
    return this.http.post<AppUser[]>(`${this.baseUrl}/query`, query);
  }

  getById(pkid: number): Observable<AppUser> {
    return this.http.get<AppUser>(`${this.baseUrl}/${pkid}`);
  }

  create(request: AppUserRequest): Observable<AppUser> {
    return this.http.post<AppUser>(this.baseUrl, request);
  }

  update(request: AppUserRequest): Observable<AppUser> {
    return this.http.put<AppUser>(this.baseUrl, request);
  }

  /** Resets the password to the system default (SysConfig appConfig.defaultPassword). */
  resetPassword(pkid: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${pkid}/reset-password`, null);
  }

  /** Issues a new agent token (the old one stops working); the plain token is only in this response. */
  regenerateAgentToken(pkid: number): Observable<AgentTokenResponse> {
    return this.http.post<AgentTokenResponse>(`${this.baseUrl}/${pkid}/regenerate-agent-token`, null);
  }

  revokeAgentToken(pkid: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${pkid}/revoke-agent-token`, null);
  }

  delete(pkid: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${pkid}`);
  }
}
