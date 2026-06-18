import { NextResponse } from "next/server";
import { getAuthenticatedUid, getGmailAccessTokenForUser } from "@/lib/gmailOAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const uid = await getAuthenticatedUid(request);
    const token = await getGmailAccessTokenForUser(uid);
    if (!token) {
      return NextResponse.json({ error: "GMAIL_NOT_CONNECTED" }, { status: 401 });
    }

    const { to, subject, content, attachmentBase64, attachmentName, attachmentMime } = await request.json();

    if (!to || !subject || !content) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
    }

    // Construct MIME Message
    const subjectBase64 = Buffer.from(subject, "utf-8").toString("base64");
    const bodyBase64 = Buffer.from(content, "utf-8").toString("base64");

    const mimeParts: string[] = [];
    mimeParts.push(`MIME-Version: 1.0`);
    mimeParts.push(`To: ${to}`);
    mimeParts.push(`Subject: =?utf-8?B?${subjectBase64}?=`);

    if (attachmentBase64 && attachmentName) {
      const boundary = "boundary_if_soluciones_" + Date.now();
      mimeParts.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      mimeParts.push("");

      // Text body part
      mimeParts.push(`--${boundary}`);
      mimeParts.push(`Content-Type: text/plain; charset="utf-8"`);
      mimeParts.push(`Content-Transfer-Encoding: base64`);
      mimeParts.push("");
      mimeParts.push(bodyBase64);
      mimeParts.push("");

      // Attachment part
      const mimeType = attachmentMime || "application/pdf";
      mimeParts.push(`--${boundary}`);
      mimeParts.push(`Content-Type: ${mimeType}; name="${attachmentName}"`);
      mimeParts.push(`Content-Disposition: attachment; filename="${attachmentName}"`);
      mimeParts.push(`Content-Transfer-Encoding: base64`);
      mimeParts.push("");
      mimeParts.push(attachmentBase64);
      mimeParts.push("");
      mimeParts.push(`--${boundary}--`);
    } else {
      mimeParts.push(`Content-Type: text/plain; charset="utf-8"`);
      mimeParts.push(`Content-Transfer-Encoding: base64`);
      mimeParts.push("");
      mimeParts.push(bodyBase64);
    }

    const mimeMessage = mimeParts.join("\r\n");
    // Convert to base64url standard required by Gmail API
    const raw = Buffer.from(mimeMessage, "utf-8").toString("base64url");

    // Send via Gmail API
    const sendResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error("[gmail:send] Gmail API error response:", errorText);
      return NextResponse.json({ error: "GMAIL_API_ERROR", detail: errorText }, { status: sendResponse.status });
    }

    const data = await sendResponse.json();
    return NextResponse.json({ ok: true, messageId: data.id });
  } catch (error) {
    console.error("[gmail:send] Failed to send email:", error);
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: "SEND_FAILED", detail: message }, { status: 500 });
  }
}
