type Subscriber = {
  userId: number;
  send: (event: string, data: unknown) => void;
  close: () => void;
};

type Store = {
  subscribersByUserId: Map<number, Set<Subscriber>>;
};

const GLOBAL_KEY = "__luminbridge_realtime_store__" as const;

function getStore(): Store {
  const g = globalThis as unknown as Record<string, unknown>;
  const existing = g[GLOBAL_KEY] as Store | undefined;
  if (existing) return existing;

  const created: Store = {
    subscribersByUserId: new Map(),
  };
  g[GLOBAL_KEY] = created;
  return created;
}

export function publishUserEvent(userId: number, event: string, data: unknown) {
  const store = getStore();
  const subs = store.subscribersByUserId.get(userId);
  if (!subs || subs.size === 0) return;

  for (const sub of subs) {
    try {
      sub.send(event, data);
    } catch {
      // If a subscriber is stale, close it and let cleanup remove it.
      try {
        sub.close();
      } catch {
        // ignore
      }
    }
  }
}

export async function publishUserEventExternal(
  userId: number,
  event: string,
  data: unknown,
) {
  // Always publish locally (SSE in dev / single-node)
  publishUserEvent(userId, event, data);

  // Also publish via Pusher when configured (needed for Vercel/serverless)
  try {
    const { getPusherServer, userChannelName } = await import(
      "@/lib/pusherServer"
    );
    const pusher = getPusherServer();
    if (!pusher) return;
    await pusher.trigger(userChannelName(userId), event, data);
  } catch {
    // ignore: realtime provider not configured
  }
}

export function createUserEventStream(userId: number, signal: AbortSignal) {
  const store = getStore();

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let keepAlive: ReturnType<typeof setInterval> | null = null;

      const sendRaw = (text: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(text));
      };

      const send = (event: string, data: unknown) => {
        sendRaw(`event: ${event}\n`);
        sendRaw(`data: ${JSON.stringify(data)}\n\n`);
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (keepAlive) clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      const subscriber: Subscriber = { userId, send, close };

      let set = store.subscribersByUserId.get(userId);
      if (!set) {
        set = new Set();
        store.subscribersByUserId.set(userId, set);
      }
      set.add(subscriber);

      // Initial handshake event
      send("ready", { userId, ts: Date.now() });

      // Keep-alive comment every 25s (prevents some proxies from timing out)
      keepAlive = setInterval(() => {
        sendRaw(": keep-alive\n\n");
      }, 25_000);

      const cleanup = () => {
        set?.delete(subscriber);
        if (set && set.size === 0) store.subscribersByUserId.delete(userId);
        close();
      };

      signal.addEventListener("abort", cleanup, { once: true });
    },
  });
}
