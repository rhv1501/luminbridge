"use client";

/* eslint-disable react-hooks/exhaustive-deps */

import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../ui/cn";
import type { Order } from "../types";

export default function NotificationBell({
  userId,
  userRole,
  hasNewOrders,
  hasNewCustomOrders,
}: {
  userId: number;
  userRole?: string;
  hasNewOrders?: (orders: Order[]) => boolean;
  hasNewCustomOrders?: (
    customOrders: import("../types").CustomOrder[],
    proposals?: import("../types").CustomOrderProposal[],
  ) => boolean;
}) {
  const [notifications, setNotifications] = useState<
    import("../types").Notification[]
  >([]);
  const [isOpen, setIsOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customOrders, setCustomOrders] = useState<
    import("../types").CustomOrder[]
  >([]);
  const [proposals, setProposals] = useState<
    import("../types").CustomOrderProposal[]
  >([]);
  const [markingNotificationId, setMarkingNotificationId] = useState<
    number | null
  >(null);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = async () => {
    const res = await fetch(`/api/notifications?userId=${userId}`);
    const data = await res.json();
    setNotifications(data);
  };

  const fetchOrders = async () => {
    if (hasNewOrders || hasNewCustomOrders) {
      const promises = [
        fetch(`/api/orders?userId=${userId}`),
        fetch(`/api/custom-orders?userId=${userId}`),
      ];
      if (userRole === "buyer") {
        promises.push(
          fetch(`/api/custom-order-proposals?role=buyer&userId=${userId}`),
        );
      }

      const [oRes, coRes, pRes] = await Promise.all(promises);

      if (oRes.ok) setOrders(await oRes.json());
      if (coRes.ok) setCustomOrders(await coRes.json());
      if (pRes && pRes.ok) setProposals(await pRes.json());
    }
  };

  useEffect(() => {
    let disposed = false;
    let es: EventSource | null = null;
    let pusherCleanup: (() => void) | null = null;
    let pendingRefresh = false;
    let refreshInFlight = false;

    const refresh = async () => {
      if (disposed) return;
      if (refreshInFlight) {
        pendingRefresh = true;
        return;
      }
      refreshInFlight = true;
      try {
        await fetchNotifications();
        await fetchOrders();
      } finally {
        refreshInFlight = false;
        if (pendingRefresh) {
          pendingRefresh = false;
          void refresh();
        }
      }
    };

    void refresh();

    // Prefer push updates over polling:
    // - On Vercel: use managed realtime (Pusher)
    // - Locally/self-host: SSE works fine
    (async () => {
      try {
        const { getPusherClient, userChannelName } =
          await import("@/lib/pusherClient");
        const pusher = getPusherClient();
        if (pusher) {
          const channel = pusher.subscribe(userChannelName(userId));
          const handler = () => void refresh();
          channel.bind("notifications", handler);
          channel.bind("refresh", handler);
          pusherCleanup = () => {
            try {
              channel.unbind("notifications", handler);
              channel.unbind("refresh", handler);
              pusher.unsubscribe(userChannelName(userId));
            } catch {
              // ignore
            }
          };
          return;
        }
      } catch {
        // ignore
      }

      try {
        es = new EventSource(`/api/notifications/stream?userId=${userId}`);
        es.addEventListener("notifications", () => {
          void refresh();
        });
        es.addEventListener("refresh", () => {
          void refresh();
        });
      } catch {
        // If SSE is unavailable, we fall back to the initial fetch only.
      }
    })();

    return () => {
      disposed = true;
      try {
        es?.close();
      } catch {
        // ignore
      }
      try {
        pusherCleanup?.();
      } catch {
        // ignore
      }
    };
  }, [userId, userRole]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const hasNewItems =
    (hasNewOrders && hasNewOrders(orders)) ||
    (hasNewCustomOrders && hasNewCustomOrders(customOrders, proposals));

  const handleMarkAsRead = async (n: import("../types").Notification) => {
    if (markingAll) return;
    if (markingNotificationId) return;
    setMarkingNotificationId(n.id);
    try {
      const res = await fetch(`/api/notifications/${n.id}/read`, {
        method: "PATCH",
      });
      if (!res.ok) {
        console.error("Failed to mark notification as read");
        return;
      }
      await fetchNotifications();
    } finally {
      setMarkingNotificationId(null);
    }

    if (n.type === "order") {
      window.dispatchEvent(
        new CustomEvent("navigate", {
          detail: { tab: "orders", id: n.related_id },
        }),
      );
    } else if (n.type === "product") {
      window.dispatchEvent(
        new CustomEvent("navigate", {
          detail: { tab: "products", id: n.related_id },
        }),
      );
    } else if (n.type === "custom-order") {
      window.dispatchEvent(
        new CustomEvent("navigate", {
          detail: { tab: "custom-orders", id: n.related_id },
        }),
      );
    } else {
      // Fallback based on message content
      if (n.message.toLowerCase().includes("order")) {
        window.dispatchEvent(
          new CustomEvent("navigate", { detail: { tab: "orders" } }),
        );
      } else if (n.message.toLowerCase().includes("product")) {
        window.dispatchEvent(
          new CustomEvent("navigate", { detail: { tab: "products" } }),
        );
      }
    }
    setIsOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        console.error("Failed to mark all notifications as read");
        return;
      }
      await fetchNotifications();
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-zinc-500 hover:text-zinc-900 transition-colors relative focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:ring-offset-2 focus:ring-offset-white rounded-lg"
      >
        <Bell size={20} />
        {(unreadCount > 0 || hasNewItems) && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-zinc-200 rounded-xl shadow-xl z-50 overflow-hidden"
          >
            <div className="p-3 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
              <h3 className="font-bold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={markingAll || !!markingNotificationId}
                  className={cn(
                    "text-[10px] text-zinc-500 hover:text-zinc-900 font-medium inline-flex items-center gap-2",
                    (markingAll || !!markingNotificationId) &&
                      "opacity-60 cursor-not-allowed hover:text-zinc-500",
                  )}
                >
                  {markingAll && (
                    <span className="inline-flex" aria-hidden="true">
                      <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    </span>
                  )}
                  {markingAll ? "Marking…" : "Mark all as read"}
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 text-sm">
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "p-3 border-b border-zinc-50 text-sm transition-colors cursor-pointer",
                      !n.is_read ? "bg-blue-50/50" : "hover:bg-zinc-50",
                      markingNotificationId === n.id &&
                        "opacity-60 pointer-events-none",
                    )}
                    onClick={() => handleMarkAsRead(n)}
                    aria-busy={markingNotificationId === n.id || undefined}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-zinc-800",
                            !n.is_read && "font-medium",
                          )}
                        >
                          {n.message}
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-1">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                      {markingNotificationId === n.id && (
                        <span className="inline-flex mt-0.5" aria-hidden="true">
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
