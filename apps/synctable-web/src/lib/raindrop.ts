export const RAINDROP_API_BASE = "https://api.raindrop.io/rest/v1";
export const RAINDROP_OAUTH_AUTH_URL = "https://raindrop.io/oauth/authorize";
export const RAINDROP_OAUTH_TOKEN_URL = "https://raindrop.io/oauth/access_token";

export const ACCESS_TOKEN_COOKIE = "raindrop_access_token";
export const REFRESH_TOKEN_COOKIE = "raindrop_refresh_token";
export const STATE_COOKIE = "raindrop_oauth_state";

export interface RaindropRawUser {
  _id: number;
  fullName: string;
  email?: string;
  email_MD5?: string;
  pro?: boolean;
  registered?: string;
  avatar?: string;
}

export interface RaindropUserProfile {
  id: number;
  name: string;
  email?: string;
  avatarUrl?: string;
  isPro?: boolean;
}

export interface RaindropTokenResponse {
  result?: boolean;
  access_token: string;
  refresh_token?: string;
  expires?: number;
  expires_in?: number;
  token_type?: string;
  error?: string;
  errorMessage?: string;
}

export function getRaindropConfig() {
  const clientId =
    process.env.RAINDROP_CLIENT_ID ||
    process.env.NEXT_PUBLIC_RAINDROP_CLIENT_ID ||
    "";
  const clientSecret = process.env.RAINDROP_CLIENT_SECRET || "";
  const redirectUri =
    process.env.RAINDROP_REDIRECT_URI ||
    process.env.RAINDROP_CALLBACK_URL ||
    process.env.NEXT_PUBLIC_RAINDROP_CALLBACK_URL ||
    "http://localhost:3000/api/auth/callback/raindrop";

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

export function getAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = getRaindropConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });

  return `${RAINDROP_OAUTH_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string
): Promise<RaindropTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getRaindropConfig();

  if (!clientId || !clientSecret) {
    throw new Error("Missing Raindrop client ID or client secret");
  }

  const res = await fetch(RAINDROP_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Failed to exchange token (${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as RaindropTokenResponse;
  if (!data.access_token) {
    throw new Error(data.errorMessage || data.error || "No access token in response");
  }

  return data;
}

export async function fetchRaindropUser(
  token: string
): Promise<RaindropUserProfile | null> {
  const res = await fetch(`${RAINDROP_API_BASE}/user`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as {
    result?: boolean;
    user?: RaindropRawUser;
  };

  if (!data.user) {
    return null;
  }

  const user = data.user;
  const avatarUrl = user.email_MD5
    ? `https://www.gravatar.com/avatar/${user.email_MD5}?d=mp`
    : user.avatar;

  return {
    id: user._id,
    name: user.fullName || "Raindrop User",
    email: user.email,
    avatarUrl,
    isPro: Boolean(user.pro),
  };
}
