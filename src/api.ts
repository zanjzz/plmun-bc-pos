import { projectId, publicAnonKey } from "../utils/supabase/info";

const apiUrl = `https://${projectId}.supabase.co/functions/v1/server/make-server-2e4384b4`;
const tokenKey = "plmun-bc-access-token";

export function getAccessToken() {
  return window.localStorage.getItem(tokenKey);
}

export function storeAccessToken(token: string) {
  window.localStorage.setItem(tokenKey, token);
}

export function clearAccessToken() {
  window.localStorage.removeItem(tokenKey);
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  authenticated = false,
): Promise<T> {
  const token = authenticated ? getAccessToken() : null;
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        apikey: publicAnonKey,
        Authorization: `Bearer ${token ?? publicAnonKey}`,
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "The Supabase backend is unavailable. Deploy the server Edge Function, then try again.",
    );
  }
  const body = await response.json();
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "The Supabase server function has not been deployed yet. Deploy it before signing in.",
      );
    }
    throw new Error(body.error ?? "The request could not be completed.");
  }
  return body as T;
}

export async function initializeDatabase() {
  await apiRequest<{ seeded: boolean }>("/seed", { method: "POST" });
}
