export interface AuthenticatedUser {
  email: string;
  id: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  tokenType: 'Bearer';
  user: AuthenticatedUser;
}

export interface PreparedRefreshToken {
  expiresAt: Date;
  raw: string;
  tokenHash: string;
}
