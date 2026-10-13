export interface AuthenticatedUser {
  id: string;
  email: string | null;
  phoneNumber: string | null;
  firstName: string;
  lastName: string;
  isPlatformAdmin: boolean;
  status: string;
  sessionId?: string;
}
