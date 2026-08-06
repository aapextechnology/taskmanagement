// WhatsApp channel adapter (T-064, Owner decision 2026-08-06).
// Provider-agnostic surface; the Meta Business Cloud API implementation
// activates when WHATSAPP_TOKEN + WHATSAPP_PHONE_ID are set, otherwise the
// adapter no-ops (logged) — the Owner has not picked the provider yet.
// Failures never throw: WhatsApp is a side channel like email.

const API_VERSION = "v21.0";

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

export async function sendWhatsApp(input: {
  /** E.164, e.g. +62812xxxxxxx */
  to: string;
  text: string;
}): Promise<void> {
  if (!whatsappConfigured()) {
    console.log(`[whatsapp] not configured — skipped message to ${input.to}`);
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
