import { getAuthenticatedUid, getGmailAccessTokenForUser, labelGmailInvoiceMessages } from "@/lib/gmailOAuth";
import type { GmailInvoiceLabel } from "@/lib/gmailOAuth";

export const runtime = "nodejs";

const VALID_LABELS = new Set<GmailInvoiceLabel>(["Pendiente", "Procesado", "Guardado", "Descartado"]);

export async function POST(request: Request) {
  try {
    const uid = await getAuthenticatedUid(request);
    const token = await getGmailAccessTokenForUser(uid);
    if (!token) return Response.json({ error: "GMAIL_NOT_CONNECTED" }, { status: 401 });

    const body = (await request.json()) as {
      messageIds?: unknown;
      label?: unknown;
    };

    if (!Array.isArray(body.messageIds) || typeof body.label !== "string" || !VALID_LABELS.has(body.label as GmailInvoiceLabel)) {
      return Response.json({ error: "GMAIL_LABEL_REQUEST_INVALID" }, { status: 400 });
    }

    const messageIds = body.messageIds.filter((id): id is string => typeof id === "string");
    await labelGmailInvoiceMessages(token, messageIds, body.label as GmailInvoiceLabel);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "GMAIL_LABEL_FAILED";
    const status = message.includes("insufficient") || message.includes("PERMISSION_DENIED") ? 403 : 500;
    return Response.json({ error: "GMAIL_LABEL_FAILED", detail: message }, { status });
  }
}
