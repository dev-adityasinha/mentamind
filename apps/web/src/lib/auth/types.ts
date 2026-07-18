export type UserRole =
  | "employee"
  | "manager"
  | "hr_manager"
  | "wellness_officer"
  | "admin"
  | "counselor"
  | "student"
  | "moderator"
  | "therapist"
  | "anonymous";

export interface User {
  id: string;
  org_id: string;
  display_name: string;
  role: UserRole;
  is_anonymous: boolean;
  consent_analytics: boolean;
  consent_ai_coaching: boolean;
  consent_community: boolean;
  onboarding_completed_at: string | null;
  created_at: string;
  last_active_at: string | null;
}

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGhostMode: boolean;
  isTransitioningGhostMode: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterOrgData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  enterGhostMode: () => Promise<void>;
  exitGhostMode: () => Promise<void>;
}

export type DataResidencyRegion = "in" | "eu" | "us" | "uae";

export interface RegisterOrgData {
  org_name: string;
  email: string;
  password: string;
  display_name: string;
  data_residency_region: DataResidencyRegion;
}
