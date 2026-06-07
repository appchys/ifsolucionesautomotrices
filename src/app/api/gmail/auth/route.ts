import { NextResponse } from "next/server";
import { buildGmailAuthUrl, createOAuthState, getAppUrl, getAuthenticatedUid } from "@/lib/gmailOAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return NextResponse.redirect(getAppUrl(request, "/compras?gmail=error&reason=auth"));
}

export async function POST(request: Request) {
  try {
    const uid = await getAuthenticatedUid(request);
    const state = createOAuthState(uid);
    return Response.json({ url: buildGmailAuthUrl(request, state) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GMAIL_AUTH_FAILED";
    const url = new URL(getAppUrl(request, "/compras"));
    url.searchParams.set("gmail", "error");
    url.searchParams.set("reason", message === "GMAIL_REDIRECT_URI_RAW_IP" ? "invalid-redirect" : "auth");
    return Response.json({ error: "GMAIL_AUTH_FAILED", redirect: url.toString() }, { status: 401 });
  }
}
