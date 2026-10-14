import { env, API_PUBLIC_URL } from "../config/env.js";

export type OAuthProvider = "fortytwo" | "github" | "google";

export type OAuthProfile = {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
};

type ProviderConfig = {
  id: OAuthProvider;
  label: string;
  enabled: boolean;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  clientId: string;
  clientSecret: string;
};

function providers(): ProviderConfig[] {
  return [
    {
      id: "fortytwo",
      label: "42",
      enabled: Boolean(env.OAUTH_42_UID && env.OAUTH_42_SECRET),
      authUrl: "https://api.intra.42.fr/oauth/authorize",
      tokenUrl: "https://api.intra.42.fr/oauth/token",
      scope: "public",
      clientId: env.OAUTH_42_UID,
      clientSecret: env.OAUTH_42_SECRET,
    },
    {
      id: "github",
      label: "GitHub",
      enabled: Boolean(env.OAUTH_GITHUB_ID && env.OAUTH_GITHUB_SECRET),
      authUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      scope: "read:user user:email",
      clientId: env.OAUTH_GITHUB_ID,
      clientSecret: env.OAUTH_GITHUB_SECRET,
    },
    {
      id: "google",
      label: "Google",
      enabled: Boolean(env.OAUTH_GOOGLE_ID && env.OAUTH_GOOGLE_SECRET),
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scope: "openid email profile",
      clientId: env.OAUTH_GOOGLE_ID,
      clientSecret: env.OAUTH_GOOGLE_SECRET,
    },
  ];
}

export function enabledProviders(): { id: OAuthProvider; label: string }[] {
  return providers()
    .filter((p) => p.enabled)
    .map((p) => ({ id: p.id, label: p.label }));
}

export function getProvider(id: string): ProviderConfig | undefined {
  return providers().find((p) => p.id === id && p.enabled);
}

export function callbackUrl(id: OAuthProvider): string {
  return `${API_PUBLIC_URL}/api/auth/oauth/${id}/callback`;
}

export function authorizeUrl(p: ProviderConfig, state: string): string {
  const url = new URL(p.authUrl);
  url.searchParams.set("client_id", p.clientId);
  url.searchParams.set("redirect_uri", callbackUrl(p.id));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", p.scope);
  url.searchParams.set("state", state);
  if (p.id === "google") url.searchParams.set("prompt", "select_account");
  return url.toString();
}

async function exchangeToken(p: ProviderConfig, code: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: p.clientId,
    client_secret: p.clientSecret,
    code,
    redirect_uri: callbackUrl(p.id),
    grant_type: "authorization_code",
  });
  const res = await fetch(p.tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    throw new Error(data.error ?? "OAuth token exchange failed");
  }
  return data.access_token;
}

function splitName(full: string, fallback: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: fallback, lastName: fallback };
  if (parts.length === 1) return { firstName: parts[0], lastName: fallback };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function sanitizeUsername(raw: string): string {
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").slice(0, 16);
  return cleaned.length >= 3 ? cleaned : `user_${Math.random().toString(36).slice(2, 8)}`;
}

export async function fetchOAuthProfile(p: ProviderConfig, code: string): Promise<OAuthProfile> {
  const token = await exchangeToken(p, code);

  if (p.id === "github") {
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "matcha" },
    });
    const user = (await userRes.json()) as {
      id: number;
      login: string;
      name?: string;
      email?: string | null;
    };
    const mailRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "matcha" },
    });
    const emailsRaw = (await mailRes.json()) as { email: string; primary: boolean; verified: boolean }[] | { message?: string };
    const emails = Array.isArray(emailsRaw) ? emailsRaw : [];
    const email =
      emails.find((e) => e.primary && e.verified)?.email ??
      emails.find((e) => e.verified)?.email ??
      user.email;
    if (!email) throw new Error("GitHub n'a pas fourni d'e-mail.");
    const names = splitName(user.name ?? user.login, user.login);
    return {
      provider: "github",
      providerId: String(user.id),
      email: email.toLowerCase(),
      username: sanitizeUsername(user.login),
      ...names,
    };
  }

  if (p.id === "google") {
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user = (await userRes.json()) as {
      id: string;
      email?: string;
      given_name?: string;
      family_name?: string;
      name?: string;
    };
    if (!user.email) throw new Error("Google n'a pas fourni d'e-mail.");
    const names = splitName(user.name ?? user.email, "Google");
    return {
      provider: "google",
      providerId: user.id,
      email: user.email.toLowerCase(),
      username: sanitizeUsername(user.email.split("@")[0] ?? "google"),
      firstName: user.given_name ?? names.firstName,
      lastName: user.family_name ?? names.lastName,
    };
  }

  const userRes = await fetch("https://api.intra.42.fr/v2/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const user = (await userRes.json()) as {
    id: number;
    login: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    usual_full_name?: string;
  };
  if (!user.email) throw new Error("Intra 42 n'a pas fourni d'e-mail.");
  return {
    provider: "fortytwo",
    providerId: String(user.id),
    email: user.email.toLowerCase(),
    username: sanitizeUsername(user.login),
    firstName: user.first_name ?? splitName(user.usual_full_name ?? user.login, user.login).firstName,
    lastName: user.last_name ?? "42",
  };
}
