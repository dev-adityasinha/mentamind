function getApiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not configured. Set it in your environment variables " +
      "(Vercel dashboard → Environment Variables → NEXT_PUBLIC_API_URL)."
    );
  }
  return base;
}

let _accessToken: string | null = null;

export function setAccessToken(token: string): void {
  _accessToken = token;
}

export function clearAccessToken(): void {
  _accessToken = null;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type FetchOptions = RequestInit & { skipAuth?: boolean };

export async function apiFetch(
  path: string,
  options: FetchOptions = {},
): Promise<Response> {
  const { skipAuth, ...init } = options;
  const res = await doFetch(path, init, skipAuth);

  if (res.status === 401 && !skipAuth) {
    const refreshed = await attemptRefresh();
    if (!refreshed) {
      clearAccessToken();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return res;
    }
    return doFetch(path, init, false);
  }

  return res;
}

function doFetch(
  path: string,
  init: RequestInit,
  skipAuth: boolean | undefined,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (!skipAuth && _accessToken) {
    headers.set("Authorization", `Bearer ${_accessToken}`);
  }
  return fetch(`${getApiBase()}${path}`, { ...init, headers });
}

async function attemptRefresh(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", { method: "POST" });
    if (!res.ok) return false;
    const data = (await res.json()) as { access_token: string };
    setAccessToken(data.access_token);
    return true;
  } catch {
    return false;
  }
}
