"use client";

import { useState } from "react";
import { Order, User as UserType, UserRole } from "@/app/types";

type SeenType = "order" | "custom-order" | "proposal" | "order-status";

/**
 * Manages client-only "seen" tracking and notification badge logic.
 * User identity is now sourced from the server (via page.tsx props).
 */
export function usePortalState(userRole: UserRole) {
  const [seenOrderIds, setSeenOrderIds] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("seenOrderIds");
    return saved ? JSON.parse(saved) : [];
  });

  const [seenCustomOrderIds, setSeenCustomOrderIds] = useState<number[]>(
    () => {
      if (typeof window === "undefined") return [];
      const saved = localStorage.getItem("seenCustomOrderIds");
      return saved ? JSON.parse(saved) : [];
    },
  );

  const [seenProposalIds, setSeenProposalIds] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("seenProposalIds");
    return saved ? JSON.parse(saved) : [];
  });

  const [seenOrderStatuses, setSeenOrderStatuses] = useState<
    Record<number, string>
  >(() => {
    if (typeof window === "undefined") return {};
    const saved = localStorage.getItem("seenOrderStatuses");
    return saved ? JSON.parse(saved) : {};
  });

  const markAsSeen = (type: SeenType, id: number, status?: string) => {
    if (type === "order") {
      if (!seenOrderIds.includes(id)) {
        const next = [...seenOrderIds, id];
        setSeenOrderIds(next);
        localStorage.setItem("seenOrderIds", JSON.stringify(next));
      }
      if (status) {
        const next = { ...seenOrderStatuses, [id]: status };
        setSeenOrderStatuses(next);
        localStorage.setItem("seenOrderStatuses", JSON.stringify(next));
      }
      return;
    }

    if (type === "custom-order") {
      if (!seenCustomOrderIds.includes(id)) {
        const next = [...seenCustomOrderIds, id];
        setSeenCustomOrderIds(next);
        localStorage.setItem("seenCustomOrderIds", JSON.stringify(next));
      }
      return;
    }

    if (type === "proposal") {
      if (!seenProposalIds.includes(id)) {
        const next = [...seenProposalIds, id];
        setSeenProposalIds(next);
        localStorage.setItem("seenProposalIds", JSON.stringify(next));
      }
      return;
    }

    if (status) {
      const next = { ...seenOrderStatuses, [id]: status };
      setSeenOrderStatuses(next);
      localStorage.setItem("seenOrderStatuses", JSON.stringify(next));
    }
  };

  const hasNewOrders = (orders: Order[]) => {
    if (userRole === "buyer") {
      return orders.some((o) => {
        if (o.status === "pending") return false;
        return seenOrderStatuses[o.id] !== o.status;
      });
    }
    return orders.some((o) => {
      if (!seenOrderIds.includes(o.id)) return true;
      if (
        o.status === "pending" &&
        seenOrderStatuses[o.id] &&
        seenOrderStatuses[o.id] !== "pending"
      ) {
        return true;
      }
      return false;
    });
  };

  const hasNewCustomOrders = (
    customOrders: import("@/app/types").CustomOrder[],
    proposals: import("@/app/types").CustomOrderProposal[] = [],
  ) => {
    if (userRole === "buyer") {
      return proposals.some((p) => !seenProposalIds.includes(p.id));
    }
    return customOrders.some((co) => !seenCustomOrderIds.includes(co.id));
  };

  /** Clears the server-side session cookie and all client-side tracking data */
  const handleLogout = async () => {
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => null);
    [
      "lumina_user",
      "seenOrderIds",
      "seenCustomOrderIds",
      "seenProposalIds",
      "seenOrderStatuses",
    ].forEach((k) => localStorage.removeItem(k));
  };

  return {
    seenOrderIds,
    seenCustomOrderIds,
    seenOrderStatuses,
    markAsSeen,
    hasNewOrders,
    hasNewCustomOrders,
    handleLogout,
  };
}

// Re-export for reference; the actual User type lives in @/app/types
export type { UserType };

