import Pusher from "pusher";

let cached: Pusher | null = null;

export function getPusherServer(): Pusher | null {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) return null;

  if (cached) return cached;

  cached = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

  return cached;
}

export function userChannelName(userId: number) {
  return `private-user-${userId}`;
}
