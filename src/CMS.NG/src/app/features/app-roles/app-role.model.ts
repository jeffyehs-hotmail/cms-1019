import { AppUserLookup } from '../../core/models/lookup.model';

/** AppRole response model (使用者角色). */
export interface AppRole {
  pkid: number;
  roleId: string;
  roleName: string;
  permissionLevel: number;
  description: string | null;
  userCount: number;
  /** Populated on GET /api/app-roles/{id} only. */
  users: AppUserLookup[];
}

/** Write DTO for POST / PUT. `pkid` required on PUT; `roleId` is immutable on update. */
export interface AppRoleRequest {
  pkid: number;
  roleId: string;
  roleName: string;
  permissionLevel: number;
  description: string | null;
  userIds: string[];
}

export interface AppRoleQuery {
  keyword?: string | null;
  permissionLevelFrom?: number | null;
  permissionLevelTo?: number | null;
}
