import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { toWhatsAppJid } from "./normalize";

// Baileys WhatsApp gateway (EPIC-015). Baileys is an UNOFFICIAL WhatsApp Web
// client: it holds one long-lived socket per linked device. Two consequences
// shape this file.
//
// 1. The socket must be a true singleton. Next dev hot-reload re-evaluates
//    modules, and the standalone server may import this from several route
//    handlers — a second socket on the same credentials gets both kicked.
//    So the instance is cached on globalThis, exactly like the db pool.
// 2. Credentials must outlive the container. useMultiFileAuthState writes to
//    WHATSAPP_SESSION_DIR, which lives on the uploads volume in Docker, so a
//    redeploy does NOT force a re-scan.
//
// Everything here fails soft: WhatsApp is a side channel, never a hard
// dependency of a mutation.

export type WaStatus =
  | "disconnected" // no socket, no attempt
  | "connecting" // socket opening / waiting for the pairing QR to be scanned
  | "awaiting_qr" // QR generated, waiting for the phone to scan it
  | "connected"; // linked and able to send

interface WaState {
  socket: unknown | null;
  status: WaStatus;
  /** data: URL of the current pairing QR, present only while awaiting_qr */
  qr: string | null;
  /** the linked account's own number, once known */
  me: string | null;
  lastError: string | null;
  /** guards against overlapping connect() calls */
  starting: boolean;
}

const globalForWa = globalThis as unknown as { waState?: WaState };

const state: WaState = (globalForWa.waState ??= {
  socket: null,
  status: "disconnected",
  qr: null,
  me: null,
  lastError: null,
  starting: false,
});

function sessionDir(): string {
  return (
    process.env.WHATSAPP_SESSION_DIR ||
    path.join(path.resolve(env.UPLOADS_DIR), "whatsapp-session")
  );
}

export function getStatus(): {
  status: WaStatus;
  qr: string | null;
  me: string | null;
  lastError: string | null;
} {
  return {
    status: state.status,
    qr: state.qr,
    me: state.me,
    lastError: state.lastError,
  };
}

export function isConnected(): boolean {
  return state.status === "connected" && state.socket !== null;
}

/**
 * Opens (or re-opens) the WhatsApp socket. Safe to call repeatedly: returns
 * immediately when already connected or mid-start.
 */
export async function connect(): Promise<void> {
  if (state.status === "connected" || state.starting) return;
  state.starting = true;
  state.lastError = null;
  state.status = "connecting";

  try {
    // imported lazily so the module never loads during `next build` page-data
    // collection, and so an install without the dep still boots
    const {
      default: makeWASocket,
      // aliased: the `use*` name trips eslint's react-hooks rule
      useMultiFileAuthState: loadAuthState,
      DisconnectReason,
      fetchLatestBaileysVersion,
    } = await import("@whiskeysockets/baileys");
    const { toDataURL } = await import("qrcode");

    const dir = sessionDir();
    await mkdir(dir, { recursive: true });
    const { state: auth, saveCreds } = await loadAuthState(dir);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth,
      // we render the QR ourselves in the admin UI
      printQRInTerminal: false,
      // never mark the linked phone as "online" — that would steal
      // notifications from the human using the same account
      markOnlineOnConnect: false,
      browser: ["Backstage", "Chrome", "1.0.0"],
    });
    state.socket = socket;

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (update: Record<string, unknown>) => {
      const qr = update.qr as string | undefined;
      const connection = update.connection as string | undefined;
      const lastDisconnect = update.lastDisconnect as
        | { error?: { output?: { statusCode?: number } } }
        | undefined;

      if (qr) {
        state.status = "awaiting_qr";
        void toDataURL(qr, { margin: 1, width: 320 })
          .then((dataUrl) => {
            state.qr = dataUrl;
          })
          .catch(() => {
            state.qr = null;
          });
      }

      if (connection === "open") {
        state.status = "connected";
        state.qr = null;
        state.lastError = null;
        const jid = (socket as { user?: { id?: string } }).user?.id;
        state.me = jid ? jid.split(":")[0] : null;
        console.log("[whatsapp] connected as", state.me);
      }

      if (connection === "close") {
        const code = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        state.socket = null;
        state.qr = null;
        state.status = "disconnected";
        state.starting = false;
        if (loggedOut) {
          // the phone unlinked us — the stored creds are now useless
          state.lastError =
            "Logged out on the phone. Scan the QR again to reconnect.";
          void rm(sessionDir(), { recursive: true, force: true }).catch(() => {});
        } else {
          state.lastError = `Connection closed (${code ?? "unknown"}). Reconnecting…`;
          // transient drop — Baileys expects us to re-dial
          setTimeout(() => void connect().catch(() => {}), 3_000);
        }
      }
    });
  } catch (error) {
    state.status = "disconnected";
    state.socket = null;
    state.lastError =
      error instanceof Error ? error.message : "Failed to start WhatsApp.";
    console.error("[whatsapp] connect failed:", error);
  } finally {
    state.starting = false;
  }
}

/** Unlinks this device and deletes the stored credentials. */
export async function disconnect(): Promise<void> {
  const socket = state.socket as { logout?: () => Promise<void> } | null;
  try {
    await socket?.logout?.();
  } catch {
    // already gone — carry on and clear local state anyway
  }
  state.socket = null;
  state.status = "disconnected";
  state.qr = null;
  state.me = null;
  state.lastError = null;
  await rm(sessionDir(), { recursive: true, force: true }).catch(() => {});
}

/**
 * Sends a text message. Returns false (never throws) when the gateway is
 * offline or the number is unusable, so callers stay unaffected.
 */
export async function sendText(to: string, text: string): Promise<boolean> {
  if (!isConnected()) return false;
  const jid = toWhatsAppJid(to, process.env.WHATSAPP_COUNTRY_CODE || "62");
  if (!jid) {
    console.warn(`[whatsapp] unusable number, skipped: ${to}`);
    return false;
  }
  try {
    const socket = state.socket as {
      sendMessage: (jid: string, content: { text: string }) => Promise<unknown>;
    };
    await socket.sendMessage(jid, { text });
    return true;
  } catch (error) {
    console.error(`[whatsapp] send failed to ${jid}:`, error);
    return false;
  }
}
