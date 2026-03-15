import Pusher from "pusher-js";

let cached: Pusher | null = null;

export function getPusherClient(): Pusher | null {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!key || !cluster) return null;
  if (cached) return cached;

  cached = new Pusher(key, {
    cluster,
    authEndpoint: "/api/realtime/auth",
  });

  return cached;
}

export function userChannelName(userId: number) {
  return `private-user-${userId}`;
}
