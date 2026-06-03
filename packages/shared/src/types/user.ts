import { Role } from '../enums/roles';

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  phone: string; // Note: returned masked/decrypted as needed
  role: Role;
  identityVerified: boolean;
  maskedAadhaarRef: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: Role;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}
