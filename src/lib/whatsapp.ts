// WhatsApp channel adapter (T-064; Baileys gateway added EPIC-015).
// Two transports, tried in order:
//   1. The self-hosted Baileys gateway — linked by scanning a QR in Admin.
//   2. Meta's Business Cloud API — used when WHATSAPP_TOKEN + WHATSAPP_PHONE_ID
//      are set and the gateway is offline.
// With neither available the adapter no-ops (logged). Failures never throw:
// WhatsApp is a side channel like email.

const API_VERSION = "v21.0";

function metaConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

/** True when SOME transport can currently deliver a message. */
export async function whatsappConfigured(): Promise<boolean> {
  if (metaConfigured()) return true;
  try {
    const { isConnected } = await import("@/lib/whatsapp/session");
    return isConnected();
  } catch {
    return false;
  }
}

export async function sendWhatsApp(input: {
  /** any common form — normalised before sending (e.g. 0812…, +62812…) */
  to: string;
  text: string;
}): Promise<void> {
  // preferred: the linked Baileys device
  try {
    const { isConnected, sendText } = await import("@/lib/whatsapp/session");
    if (isConnected() && (await sendText(input.to, input.text))) return;
  } catch (error) {
    console.error("[whatsapp] gateway send failed, trying fallback:", error);
  }

  if (!metaConfigured()) {
    console.log(`[whatsapp] no transport available — skipped ${input.to}`);
    return;
  }
  try {
    const response = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: input.to.replace(/^\+/, ""),
          type: "text",
          text: { body: input.text },
        }),
      },
    );
    if (!response.ok) {
      console.error(
        `[whatsapp] send failed (${response.status}):`,
        await response.text(),
      );
    }
  } catch (error) {
    console.error(`[whatsapp] send failed to ${input.to}:`, error);
  }
}
