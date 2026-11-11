import { apiRequest, clearAccessToken, getAccessToken, storeAccessToken } from "./api";

export type Role = "student" | "staff" | "admin";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  reference: string;
};

export type Credentials = { email: string; password: string };
export type Registration = Credentials & {
  name: string;
  reference: string;
};

export interface AuthProvider {
  signIn(credentials: Credentials): Promise<AuthUser>;
  register(details: Registration): Promise<AuthUser>;
  signOut(): Promise<void>;
  restoreSession(): Promise<AuthUser | null>;
}

export const demoAccounts = [
  { email: "student@plmun.edu.ph", password: "student123", role: "student" as const },
  { email: "staff@plmun.edu.ph", password: "staff123", role: "staff" as const },
  { email: "admin@plmun.edu.ph", password: "admin123", role: "admin" as const },
];

const sessionKey = "plmun-bc-user";

export const authProvider: AuthProvider = {
  async signIn(credentials) {
    const preset = demoAccounts.find(
      (account) =>
        account.email.toLowerCase() === credentials.email.trim().toLowerCase() &&
        account.password === credentials.password,
    );
    const result = await apiRequest<{ user: AuthUser; accessToken: string }>(
      preset ? "/auth/demo-login" : "/auth/login",
      {
        method: "POST",
        body: JSON.stringify(preset ? { role: preset.role } : credentials),
      },
    );
    storeAccessToken(result.accessToken);
    window.localStorage.setItem(sessionKey, JSON.stringify(result.user));
    return result.user;
  },

  async register(details) {
    const result = await apiRequest<{ user: AuthUser; accessToken: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(details),
    });
    storeAccessToken(result.accessToken);
    window.localStorage.setItem(sessionKey, JSON.stringify(result.user));
    return result.user;
  },

  async signOut() {
    clearAccessToken();
    window.localStorage.removeItem(sessionKey);
  },

  async restoreSession() {
    const token = getAccessToken();
    if (!token) return null;
    try {
      const result = await apiRequest<{ user: AuthUser }>("/auth/me", {}, true);
      window.localStorage.setItem(sessionKey, JSON.stringify(result.user));
      return result.user;
    } catch {
      clearAccessToken();
      window.localStorage.removeItem(sessionKey);
      return null;
    }
  },
};

export function readStoredSession(): AuthUser | null {
  if (!getAccessToken()) return null;
  const stored = window.localStorage.getItem(sessionKey);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as AuthUser;
  } catch {
    clearAccessToken();
    window.localStorage.removeItem(sessionKey);
    return null;
  }
}
