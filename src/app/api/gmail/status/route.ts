import { NextResponse } from "next/server";
import {
  clearGmailTokenCookies,
  clearGmailTokensForUid,
  getAuthenticatedUid,
  getGmailAccessTokenForUser,
  getGmailCookieStatus,
  getGmailProfile,
} from "@/lib/gmailOAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const uid = await getAuthenticatedUid(request);
    const cookieStatus = await getGmailCookieStatus();
    console.info("[gmail:status] Checking Gmail connection", { uid, cookieStatus });
    const token = await getGmailAccessTokenForUser(uid);
    if (!token) {
      console.info("[gmail:status] No Gmail token available", { uid, cookieStatus });
      return Response.json({ connected: false });
    }

    const profile = await getGmailProfile(token);
    console.info("[gmail:status] Gmail profile loaded", { uid, email: profile.emailAddress });
    return Response.json({ connected: true, email: profile.emailAddress });
  } catch (error) {
    console.error("[gmail:status] Gmail status failed", error);
    return Response.json({ connected: false });
  }
}

export async function DELETE(request: Request) {
  const response = NextResponse.json({ connected: false });
  try {
    const uid = await getAuthenticatedUid(request);
    await clearGmailTokensForUid(uid);
    console.info("[gmail:status] Cleared stored Gmail tokens", { uid });
  } catch (error) {
    console.error("[gmail:status] Failed to clear stored Gmail tokens", error);
  }
  clearGmailTokenCookies(response);
  return response;
}
