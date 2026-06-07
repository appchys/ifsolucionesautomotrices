import { getAuthenticatedUid, getGmailAccessTokenForUser, listGmailInvoiceAttachments } from "@/lib/gmailOAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const uid = await getAuthenticatedUid(request);
  const token = await getGmailAccessTokenForUser(uid);
  if (!token) return Response.json({ error: "GMAIL_NOT_CONNECTED" }, { status: 401 });

  const maxResultsParam = new URL(request.url).searchParams.get("maxResults");
  const maxResults = Number(maxResultsParam || 10);
  const attachments = await listGmailInvoiceAttachments(token, Number.isFinite(maxResults) ? maxResults : 10);
  return Response.json({ attachments });
}
