"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // In dev, service worker caching can serve stale _next bundles and make it
    // look like old code (e.g. polling) is still running.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => undefined);

      // Best-effort cache cleanup
      if ("caches" in window) {
        caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys
                .filter((k) => k.startsWith("lumibridge-pwa-"))
                .map((k) => caches.delete(k)),
            ),
          )
          .catch(() => undefined);
      }
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .catch((error) => console.error("SW registration failed:", error));
  }, []);

  return null;
}
