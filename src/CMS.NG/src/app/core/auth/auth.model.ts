/** Body of POST /api/auth/login. */
export interface LoginRequest {
  userId: string;
  password: string;
}

/** Response of POST /api/auth/login, kept in sessionStorage while signed in. */
export interface AuthProfile {
  userId: string;
  userName: string;
  /** HS256 JWT; claims `sub`, `name`, `role` (string or array, omitted when the user has no roles), `exp`. */
  accessToken: string;
}

/** The JWT claims the frontend reads. */
export interface AccessTokenClaims {
  role?: string | string[];
  exp?: number;
}

/** Response of GET / PUT /api/auth/profile: the signed-in user's own profile. */
export interface UserProfile {
  userId: string;
  userName: string;
  roles: { roleId: string; roleName: string }[];
}

/** Body of PUT /api/auth/profile. Only UserName can change; the API takes the UserId from the token. */
export interface UserProfileRequest {
  userName: string;
}

/** Body of POST /api/auth/change-password (204 on success). Plain passwords only; hashes never leave the API. */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
