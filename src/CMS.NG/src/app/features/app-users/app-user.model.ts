import { AppRoleLookup } from '../../core/models/lookup.model';

/** AppUser response model (使用者). The password hash is never sent to the frontend. */
export interface AppUser {
  pkid: number;
  userId: string;
  userName: string;
  isActive: boolean;
  /** null = still on the default password (new or reset). */
  passwordUpdatedTime: string | null;
  roleCount: number;
  /** Populated on GET /api/app-users/{id} only. */
  roles: AppRoleLookup[];
}

/** Write DTO for POST / PUT. `pkid` required on PUT; `userId` is immutable on update. No password field. */
export interface AppUserRequest {
  pkid: number;
  userId: string;
  userName: string;
  isActive: boolean;
  roleIds: string[];
}

export interface AppUserQuery {
  keyword?: string | null;
  isActive?: boolean | null;
  roleId?: string | null;
}
