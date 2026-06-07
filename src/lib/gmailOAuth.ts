import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

const GMAIL_ACCESS_COOKIE = "if_gmail_access_token";
const GMAIL_REFRESH_COOKIE = "if_gmail_refresh_token";
const ACCESS_TOKEN_MAX_AGE = 55 * 60;
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 90;
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const GMAIL_INVOICE_LABELS = ["Pendiente", "Procesado", "Guardado", "Descartado"] as const;
const DEFAULT_PUBLIC_APP_ORIGIN = "https://ifsolucionesautomotrices.web.app";
const FIREBASE_PROJECT_ID = "ifsolucionesautomotrices";
const FIREBASE_WEB_API_KEY = "AIzaSyDxgUn0XDS_EpfkVb6PKKTHkIBS7AeGnRc";

export type GmailInvoiceLabel = (typeof GMAIL_INVOICE_LABELS)[number];

export type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type OAuthStatePayload = {
  nonce: string;
  issuedAt: number;
  uid: string;
};

export type GmailCookieStatus = {
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  accessTokenLength: number;
  refreshTokenLength: number;
};

export type GmailProfile = {
  emailAddress: string;
  messagesTotal?: number;
  threadsTotal?: number;
};

export type GmailAttachment = {
  messageId: string;
  messageSubject: string;
  messageDate: string;
  filename: string;
  mimeType: string;
  size: number;
  dataBase64: string;
};

function getClientId(): string {
  const value = process.env.GOOGLE_GMAIL_CLIENT_ID;
  if (!value) throw new Error("GMAIL_CLIENT_ID_MISSING");
  return value;
}

function getClientSecret(): string {
  const value = process.env.GOOGLE_GMAIL_CLIENT_SECRET;
  if (!value) throw new Error("GMAIL_CLIENT_SECRET_MISSING");
  return value;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signOAuthState(payload: string): string {
  return createHmac("sha256", getClientSecret()).update(payload).digest("base64url");
}

type StoredGmailTokens = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  updatedAt?: unknown;
};

export async function getAuthenticatedUid(request: Request): Promise<string> {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) throw new Error("GMAIL_AUTH_MISSING");

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: match[1] }),
  });
  const data = (await response.json()) as { users?: { localId?: string }[]; error?: { message?: string } };
  const uid = data.users?.[0]?.localId;
  if (!response.ok || !uid) throw new Error(data.error?.message || "GMAIL_AUTH_INVALID");
  return uid;
}

export function createOAuthState(uid: string): string {
  const payload: OAuthStatePayload = {
    nonce: crypto.randomUUID(),
    issuedAt: Date.now(),
    uid,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  return `${encodedPayload}.${signOAuthState(encodedPayload)}`;
}

export function getOAuthStateUid(state: string | null): string | null {
  if (!state) return null;

  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signOAuthState(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as Partial<OAuthStatePayload>;
    if (typeof payload.issuedAt !== "number" || Date.now() - payload.issuedAt > OAUTH_STATE_MAX_AGE_MS) return null;
    return typeof payload.uid === "string" && payload.uid ? payload.uid : null;
  } catch {
    return null;
  }
}

function getConfiguredPublicOrigin(): string | undefined {
  const value = process.env.GOOGLE_GMAIL_APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL;
  if (!value) return undefined;
  return new URL(value).origin;
}

function getForwardedOrigin(request: Request): string | undefined {
  const headers = request.headers;
  const requestedHost =
    headers.get("x-fh-requested-host") ||
    headers.get("x-forwarded-host") ||
    headers.get("host");

  if (!requestedHost) return undefined;

  const host = requestedHost.split(",")[0].trim();
  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const isLocalHost = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const protocol = isLocalHost ? forwardedProto || "http" : "https";
  return `${protocol}://${host}`;
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isGoogleRedirectHostAllowed(hostname: string): boolean {
  return !isIP(hostname) || isLoopbackHost(hostname);
}

function isPublicOriginUsable(origin: string): boolean {
  const url = new URL(origin);
  if (url.hostname === "0.0.0.0") return false;
  return isGoogleRedirectHostAllowed(url.hostname);
}

export function getAppUrl(request: Request, path: string): string {
  const configuredOrigin = getConfiguredPublicOrigin();
  if (configuredOrigin) return new URL(path, configuredOrigin).toString();

  const forwardedOrigin = getForwardedOrigin(request);
  if (forwardedOrigin && isPublicOriginUsable(forwardedOrigin)) {
    return new URL(path, forwardedOrigin).toString();
  }

  const requestOrigin = new URL(request.url).origin;
  if (isPublicOriginUsable(requestOrigin)) {
    return new URL(path, requestOrigin).toString();
  }

  return new URL(path, DEFAULT_PUBLIC_APP_ORIGIN).toString();
}

export function getRedirectUri(request: Request): string {
  if (process.env.GOOGLE_GMAIL_REDIRECT_URI) {
    return process.env.GOOGLE_GMAIL_REDIRECT_URI;
  }

  return getAppUrl(request, "/api/gmail/callback");
}

function assertValidGoogleRedirectUri(redirectUri: string): void {
  const url = new URL(redirectUri);
  if (!isGoogleRedirectHostAllowed(url.hostname)) {
    throw new Error("GMAIL_REDIRECT_URI_RAW_IP");
  }
}

function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

function getFirestoreDocumentUrl(uid: string): string {
  const safeUid = encodeURIComponent(uid);
  return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/gmailTokens/${safeUid}`;
}

async function getGoogleCloudAccessToken(): Promise<string> {
  const response = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
    headers: { "Metadata-Flavor": "Google" },
  });
  const data = (await response.json().catch(() => ({}))) as { access_token?: string };
  if (!response.ok || !data.access_token) throw new Error("GOOGLE_CLOUD_TOKEN_FAILED");
  return data.access_token;
}

function parseStoredGmailTokens(data: unknown): StoredGmailTokens | undefined {
  const fields = (data as { fields?: Record<string, { stringValue?: string; doubleValue?: number; integerValue?: string }> })?.fields;
  if (!fields) return undefined;
  return {
    accessToken: fields.accessToken?.stringValue,
    refreshToken: fields.refreshToken?.stringValue,
    expiresAt: fields.expiresAt?.doubleValue ?? Number(fields.expiresAt?.integerValue ?? 0),
  };
}

async function getStoredGmailTokens(uid: string): Promise<StoredGmailTokens | undefined> {
  const token = await getGoogleCloudAccessToken();
  const response = await fetch(getFirestoreDocumentUrl(uid), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return undefined;
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data) || "GMAIL_TOKEN_READ_FAILED");
  return parseStoredGmailTokens(data);
}

async function setStoredGmailTokens(uid: string, tokens: Required<Pick<StoredGmailTokens, "accessToken" | "refreshToken" | "expiresAt">>): Promise<void> {
  const token = await getGoogleCloudAccessToken();
  const response = await fetch(getFirestoreDocumentUrl(uid), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        accessToken: { stringValue: tokens.accessToken },
        refreshToken: { stringValue: tokens.refreshToken },
        expiresAt: { doubleValue: tokens.expiresAt },
        updatedAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  if (!response.ok) throw new Error((await response.text()) || "GMAIL_TOKEN_WRITE_FAILED");
}

export function getTokenDiagnostics(tokens: TokenResponse) {
  return {
    hasAccessToken: Boolean(tokens.access_token),
    hasRefreshToken: Boolean(tokens.refresh_token),
    accessTokenLength: tokens.access_token?.length ?? 0,
    refreshTokenLength: tokens.refresh_token?.length ?? 0,
    expiresIn: tokens.expires_in ?? null,
  };
}

export async function getGmailCookieStatus(): Promise<GmailCookieStatus> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(GMAIL_ACCESS_COOKIE)?.value ?? "";
  const refreshToken = cookieStore.get(GMAIL_REFRESH_COOKIE)?.value ?? "";
  return {
    hasAccessToken: Boolean(accessToken),
    hasRefreshToken: Boolean(refreshToken),
    accessTokenLength: accessToken.length,
    refreshTokenLength: refreshToken.length,
  };
}

export async function setGmailTokens(tokens: TokenResponse): Promise<void> {
  const cookieStore = await cookies();
  if (tokens.access_token) {
    cookieStore.set(GMAIL_ACCESS_COOKIE, tokens.access_token, getCookieOptions(ACCESS_TOKEN_MAX_AGE));
  }
  if (tokens.refresh_token) {
    cookieStore.set(GMAIL_REFRESH_COOKIE, tokens.refresh_token, getCookieOptions(REFRESH_TOKEN_MAX_AGE));
  }
}

export async function setGmailTokensForUid(uid: string, tokens: TokenResponse): Promise<void> {
  const existing = await getStoredGmailTokens(uid);
  const refreshToken = tokens.refresh_token ?? existing?.refreshToken;
  if (!tokens.access_token || !refreshToken) throw new Error("GMAIL_TOKEN_STORE_INCOMPLETE");

  await setStoredGmailTokens(uid, {
    accessToken: tokens.access_token,
    refreshToken,
    expiresAt: Date.now() + (tokens.expires_in ?? ACCESS_TOKEN_MAX_AGE) * 1000,
  });
}

export function setGmailTokenCookies(response: NextResponse, tokens: TokenResponse): void {
  if (tokens.refresh_token) {
    response.cookies.set(GMAIL_REFRESH_COOKIE, tokens.refresh_token, getCookieOptions(REFRESH_TOKEN_MAX_AGE));
  }
  if (tokens.access_token) {
    response.cookies.set(GMAIL_ACCESS_COOKIE, tokens.access_token, getCookieOptions(ACCESS_TOKEN_MAX_AGE));
  }
}

export async function clearGmailTokens(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(GMAIL_ACCESS_COOKIE);
  cookieStore.delete(GMAIL_REFRESH_COOKIE);
}

export async function clearGmailTokensForUid(uid: string): Promise<void> {
  const token = await getGoogleCloudAccessToken();
  const response = await fetch(getFirestoreDocumentUrl(uid), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error((await response.text()) || "GMAIL_TOKEN_DELETE_FAILED");
  }
}

export function clearGmailTokenCookies(response: NextResponse): void {
  response.cookies.delete(GMAIL_ACCESS_COOKIE);
  response.cookies.delete(GMAIL_REFRESH_COOKIE);
}

export function buildGmailAuthUrl(request: Request, state: string): string {
  const redirectUri = getRedirectUri(request);
  assertValidGoogleRedirectUri(redirectUri);

  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.modify",
    access_type: "offline",
    prompt: "consent select_account",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, request: Request): Promise<TokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      code,
      grant_type: "authorization_code",
      redirect_uri: getRedirectUri(request),
    }),
  });
  const tokens = (await response.json()) as TokenResponse;
  if (!response.ok || !tokens.access_token) {
    throw new Error(tokens.error_description || tokens.error || "GMAIL_TOKEN_EXCHANGE_FAILED");
  }
  return tokens;
}

async function refreshAccessToken(refreshToken: string, uid?: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const tokens = (await response.json()) as TokenResponse;
  if (!response.ok || !tokens.access_token) {
    throw new Error(tokens.error_description || tokens.error || "GMAIL_REFRESH_FAILED");
  }
  if (uid) {
    await setGmailTokensForUid(uid, { ...tokens, refresh_token: tokens.refresh_token ?? refreshToken });
  } else {
    await setGmailTokens(tokens);
  }
  return tokens.access_token;
}

export async function getGmailAccessToken(uid?: string): Promise<string | null> {
  if (uid) {
    const stored = await getStoredGmailTokens(uid);
    if (!stored?.refreshToken) return null;
    if (stored.accessToken && stored.expiresAt && stored.expiresAt > Date.now() + 60_000) {
      return stored.accessToken;
    }
    return refreshAccessToken(stored.refreshToken, uid);
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(GMAIL_ACCESS_COOKIE)?.value;
  if (accessToken) return accessToken;

  const refreshToken = cookieStore.get(GMAIL_REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;
  return refreshAccessToken(refreshToken);
}

export async function getGmailAccessTokenForUser(uid: string): Promise<string | null> {
  try {
    const storedToken = await getGmailAccessToken(uid);
    if (storedToken) return storedToken;
  } catch (error) {
    console.warn("[gmail] Stored token lookup failed, falling back to session cookies", {
      uid,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return getGmailAccessToken();
}

async function gmailFetch<T>(path: string, token: string, init: RequestInit = {}): Promise<{ data: T; token: string }> {
  let activeToken = token;
  const headers = {
    ...init.headers,
    Authorization: `Bearer ${activeToken}`,
  };
  let response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(GMAIL_REFRESH_COOKIE)?.value;
    if (!refreshToken) throw new Error("GMAIL_NOT_CONNECTED");
    activeToken = await refreshAccessToken(refreshToken);
    response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${activeToken}`,
      },
    });
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "GMAIL_API_ERROR");
  }

  return { data: (await response.json()) as T, token: activeToken };
}

export async function getGmailProfile(token: string): Promise<GmailProfile> {
  const { data } = await gmailFetch<GmailProfile>("/profile", token);
  return data;
}

type GmailMessageList = {
  messages?: { id: string; threadId: string }[];
};

type GmailMessagePart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  body?: {
    attachmentId?: string;
    size?: number;
    data?: string;
  };
  parts?: GmailMessagePart[];
};

type GmailMessage = {
  id: string;
  payload?: GmailMessagePart & {
    headers?: { name: string; value: string }[];
  };
};

type GmailAttachmentResponse = {
  data?: string;
  size?: number;
};

type GmailLabel = {
  id: string;
  name: string;
};

type GmailLabelList = {
  labels?: GmailLabel[];
};

function collectAttachmentParts(part: GmailMessagePart | undefined): GmailMessagePart[] {
  if (!part) return [];
  const children = part.parts?.flatMap(collectAttachmentParts) ?? [];
  const filename = part.filename?.toLowerCase() ?? "";
  const isInvoiceCandidate = filename.endsWith(".xml") || filename.endsWith(".zip");
  return isInvoiceCandidate && part.body?.attachmentId ? [part, ...children] : children;
}

function getHeader(message: GmailMessage, name: string): string {
  return message.payload?.headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function normalizeGmailBase64(data: string): string {
  return Buffer.from(data, "base64url").toString("base64");
}

export async function listGmailInvoiceAttachments(token: string, maxResults = 10): Promise<GmailAttachment[]> {
  const query = "has:attachment (filename:xml OR filename:zip) -label:Guardado -label:Descartado after:2026/06/01";
  const listParams = new URLSearchParams({
    q: query,
    maxResults: String(Math.min(Math.max(maxResults, 1), 25)),
  });
  const { data: list, token: activeToken } = await gmailFetch<GmailMessageList>(`/messages?${listParams.toString()}`, token);
  const messages = list.messages ?? [];
  const attachments: GmailAttachment[] = [];

  for (const item of messages) {
    if (attachments.length >= maxResults) break;
    const messageParams = new URLSearchParams({ format: "full" });
    const { data: message } = await gmailFetch<GmailMessage>(`/messages/${item.id}?${messageParams.toString()}`, activeToken);
    const parts = collectAttachmentParts(message.payload);
    const subject = getHeader(message, "Subject");
    const date = getHeader(message, "Date");

    for (const part of parts) {
      if (attachments.length >= maxResults) break;
      const attachmentId = part.body?.attachmentId;
      if (!attachmentId) continue;
      const { data: attachment } = await gmailFetch<GmailAttachmentResponse>(
        `/messages/${item.id}/attachments/${attachmentId}`,
        activeToken
      );
      if (!attachment.data) continue;

      attachments.push({
        messageId: item.id,
        messageSubject: subject,
        messageDate: date,
        filename: part.filename ?? "factura.xml",
        mimeType: part.mimeType ?? "application/octet-stream",
        size: attachment.size ?? part.body?.size ?? 0,
        dataBase64: normalizeGmailBase64(attachment.data),
      });
    }
  }

  return attachments;
}

async function getOrCreateGmailLabel(token: string, name: GmailInvoiceLabel): Promise<GmailLabel> {
  const { data: list, token: activeToken } = await gmailFetch<GmailLabelList>("/labels", token);
  const existing = list.labels?.find((label) => label.name === name);
  if (existing) return existing;

  const { data: created } = await gmailFetch<GmailLabel>("/labels", activeToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    }),
  });
  return created;
}

export async function labelGmailInvoiceMessages(
  token: string,
  messageIds: string[],
  labelName: GmailInvoiceLabel
): Promise<void> {
  const uniqueMessageIds = Array.from(new Set(messageIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueMessageIds.length === 0) return;

  const labels = await Promise.all(GMAIL_INVOICE_LABELS.map((name) => getOrCreateGmailLabel(token, name)));
  const targetLabel = labels.find((label) => label.name === labelName);
  if (!targetLabel?.id) throw new Error("GMAIL_LABEL_NOT_FOUND");

  const removeLabelIds = labels.filter((label) => label.id !== targetLabel.id).map((label) => label.id);
  await Promise.all(
    uniqueMessageIds.map((messageId) =>
      gmailFetch(`/messages/${messageId}/modify`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addLabelIds: [targetLabel.id],
          removeLabelIds,
        }),
      })
    )
  );
}
