import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '@env/environment';
import {
  AccessTokenClaims,
  AuthProfile,
  ChangePasswordRequest,
  LoginRequest,
  UserProfile,
  UserProfileRequest,
} from './auth.model';

/** sessionStorage key of the signed-in {@link AuthProfile}. */
export const AUTH_PROFILE_KEY = 'auth-profile';
export const ADMIN_ROLE = 'Admin';

/** Login state. The profile lives in sessionStorage (per tab, gone when the tab closes), never localStorage. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly loginUrl = `${environment.apiUrl}/auth/login`;
  readonly profileUrl = `${environment.apiUrl}/auth/profile`;
  readonly changePasswordUrl = `${environment.apiUrl}/auth/change-password`;

  private readonly profileState = signal<AuthProfile | null>(readProfile());
  readonly profile = this.profileState.asReadonly();
  readonly userName = computed(() => this.profileState()?.userName ?? '');
  /** Role ids from the token's `role` claims. */
  readonly roles = computed(() => rolesOf(decodeClaims(this.profileState()?.accessToken)));
  readonly isAdmin = computed(() => this.roles().includes(ADMIN_ROLE));

  login(request: LoginRequest): Observable<AuthProfile> {
    return this.http.post<AuthProfile>(this.loginUrl, request).pipe(
      tap(({ userId, userName, accessToken }) => {
        const profile: AuthProfile = { userId, userName, accessToken };
        sessionStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile));
        this.profileState.set(profile);
      }),
    );
  }

  /** The signed-in user's profile with role names, from the API. */
  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.profileUrl);
  }

  /**
   * Changes the signed-in user's own UserName, then refreshes it in sessionStorage and the shell.
   * The token is kept as is: its `name` claim stays stale until the next login (nothing reads it; RowAudit records
   * the login UserId from `sub`).
   */
  updateProfile(request: UserProfileRequest): Observable<UserProfile> {
    return this.http.put<UserProfile>(this.profileUrl, request).pipe(
      tap(({ userName }) => {
        const current = this.profileState();
        if (!current) return;
        const profile: AuthProfile = { ...current, userName };
        sessionStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile));
        this.profileState.set(profile);
      }),
    );
  }

  /** Changes the signed-in user's own password (the API takes the UserId from the token); the session is kept. */
  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>(this.changePasswordUrl, request);
  }

  /** The stored access token, read from sessionStorage each time. */
  token(): string | null {
    return readProfile()?.accessToken ?? null;
  }

  /** A readable token that has not expired yet (the API still has the final say). */
  isLoggedIn(): boolean {
    const claims = decodeClaims(this.token());
    return !!claims && (claims.exp === undefined || claims.exp * 1000 > Date.now());
  }

  /** Clears all of sessionStorage (profile plus saved list filters) and the in-memory profile. */
  clearSession(): void {
    try {
      sessionStorage.clear();
    } catch {
      /* storage unavailable */
    }
    this.profileState.set(null);
  }

  logout(): void {
    this.clearSession();
    this.router.navigateByUrl('/login');
  }
}

function readProfile(): AuthProfile | null {
  try {
    const raw = sessionStorage.getItem(AUTH_PROFILE_KEY);
    const profile = raw ? (JSON.parse(raw) as AuthProfile) : null;
    return profile?.accessToken ? profile : null;
  } catch {
    return null;
  }
}

/** Payload of a JWT (base64url JSON, UTF-8), or null if it can't be read. Does not check the signature. */
export function decodeClaims(token: string | null | undefined): AccessTokenClaims | null {
  const part = token?.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes));
    return claims && typeof claims === 'object' ? (claims as AccessTokenClaims) : null;
  } catch {
    return null;
  }
}

function rolesOf(claims: AccessTokenClaims | null): string[] {
  const role = claims?.role;
  if (role === undefined) return [];
  return (Array.isArray(role) ? role : [role]).filter((r): r is string => typeof r === 'string');
}
