export interface UserDto {
  id: string;
  email: string | null;
  phoneNumber: string | null;
  firstName: string;
  lastName: string;
  isPlatformAdmin: boolean;
  status: string;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: string;
}

export interface AuthResponseDto {
  user: UserDto;
  tokens: AuthTokens;
}
