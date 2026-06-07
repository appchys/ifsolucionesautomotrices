import { NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  getAppUrl,
  getOAuthStateUid,
  getTokenDiagnostics,
  setGmailTokenCookies,
  setGmailTokensForUid,
} from "@/lib/gmailOAuth";

export const runtime = "nodejs";

function getGmailErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return "token";
  if (error.message === "GMAIL_CLIENT_SECRET_MISSING") return "secret";
  if (error.message === "GMAIL_CLIENT_ID_MISSING") return "client";
  if (error.message.includes("redirect_uri_mismatch")) return "redirect";
  if (error.message.includes("invalid_grant")) return "grant";
  return "token";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const uid = getOAuthStateUid(state);

  if (oauthError) {
    console.warn("[gmail:callback] OAuth provider returned error", { oauthError });
    return NextResponse.redirect(getAppUrl(request, `/compras?gmail=error&reason=${oauthError}`));
  }

  if (!code || !uid) {
    console.warn("[gmail:callback] Invalid callback state", { hasCode: Boolean(code), hasState: Boolean(state) });
    return NextResponse.redirect(getAppUrl(request, "/compras?gmail=error&reason=state"));
  }

  try {
    const tokens = await exchangeCodeForTokens(code, request);
    console.info("[gmail:callback] Token exchange succeeded", { uid, ...getTokenDiagnostics(tokens) });

    const response = NextResponse.redirect(getAppUrl(request, "/compras?gmail=connected"));
    setGmailTokenCookies(response, tokens);

    try {
      await setGmailTokensForUid(uid, tokens);
      console.info("[gmail:callback] Stored Gmail tokens for user", { uid });
    } catch (storageError) {
      console.warn("[gmail:callback] Gmail connected, but persistent token storage failed", {
        uid,
        error: storageError instanceof Error ? storageError.message : String(storageError),
      });
    }

    console.info("[gmail:callback] Redirecting with Gmail token cookies", {
      location: response.headers.get("location"),
      setCookieLength: response.headers.get("set-cookie")?.length ?? 0,
    });
    return response;
  } catch (error) {
    console.error("[gmail:callback] Token exchange failed", error);
    return NextResponse.redirect(getAppUrl(request, `/compras?gmail=error&reason=${getGmailErrorCode(error)}`));
  }
}
