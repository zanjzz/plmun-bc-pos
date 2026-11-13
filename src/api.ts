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
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("apikey", publicAnonKey);
  headers.set("Authorization", `Bearer ${token ?? publicAnonKey}`);
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "We couldn’t connect to the Business Center server. Check your connection and try again.",
    );
  }

  const responseText = await response.text();
  let body: { error?: string } | null = null;
  if (responseText.trim()) {
    try {
      body = JSON.parse(responseText) as { error?: string };
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "This service is not available yet. Please contact the system administrator.",
      );
    }
    if (response.status === 401) {
      if (authenticated) {
        clearAccessToken();
        window.dispatchEvent(new Event("auth:expired"));
      }
      throw new Error(body?.error ?? "Your email or password is incorrect. Please try again.");
    }
    if (response.status === 403) {
      throw new Error(body?.error ?? "You don’t have permission to complete this action.");
    }
    if (response.status === 409) {
      throw new Error(body?.error ?? "An account with these details already exists.");
    }
    if (response.status === 429) {
      throw new Error("Too many attempts. Please wait a moment before trying again.");
    }
    if (response.status >= 500) {
      throw new Error(
        body?.error ?? "The server is temporarily unavailable. Please try again shortly.",
      );
    }
    throw new Error(body?.error ?? "We couldn’t complete your request. Please check your details.");
  }

  if (!body) {
    throw new Error("The server returned an unexpected response. Please contact support.");
  }

  return body as T;
}
