import { auth } from "@/lib/auth";
import { listMyNotifications, unreadCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// SSE stream (T-037): pushes { unread, items } every few seconds when the
// state changes. nginx runs with proxy_buffering off, so events arrive live.
const POLL_MS = 4000;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let lastPayload = "";
      let closed = false;

      const push = async () => {
        if (closed) return;
        try {
          const [unread, items] = await Promise.all([
            unreadCount(userId),
            listMyNotifications(userId, 15),
          ]);
          const payload = JSON.stringify({ unread, items });
          if (payload !== lastPayload) {
            lastPayload = payload;
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          } else {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          }
        } catch {
          // transient DB error — keep the stream alive, retry next tick
        }
      };

      void push();
      const timer = setInterval(push, POLL_MS);
      const close = () => {
        if (!closed) {
          closed = true;
          clearInterval(timer);
          try {
            controller.close();
          } catch {
            // already closed by the client
          }
        }
      };
      // stop after 15 minutes; EventSource auto-reconnects
      setTimeout(close, 15 * 60_000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
