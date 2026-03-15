"use client";
import { useRouter } from "next/navigation";
import { AdminDashboard } from "@/app/portals/AdminDashboard";
import {
  User as UserType,
  Product,
  Order,
  CustomOrder,
  Settings,
} from "@/app/types";
import { usePortalState } from "@/app/portals/usePortalState";
import PortalShellClient from "@/app/portals/PortalShellClient";

type Props = {
  user: UserType;
  initialProducts: Product[];
  initialOrders: Order[];
  initialCustomOrders: CustomOrder[];
  initialSettings: Settings;
};

export default function AdminPageClient({
  user,
  initialProducts,
  initialOrders,
  initialCustomOrders,
  initialSettings,
}: Props) {
  const router = useRouter();
  const {
    seenOrderIds,
    seenCustomOrderIds,
    markAsSeen,
    hasNewOrders,
    hasNewCustomOrders,
    handleLogout,
  } = usePortalState(user.role);

  return (
    <PortalShellClient
      user={user}
      hasNewOrders={hasNewOrders}
      hasNewCustomOrders={hasNewCustomOrders}
      onLogout={async () => {
        await handleLogout();
        router.replace("/login");
      }}
    >
      <AdminDashboard
        user={user}
        initialProducts={initialProducts}
        initialOrders={initialOrders}
        initialCustomOrders={initialCustomOrders}
        initialSettings={initialSettings}
        seenOrderIds={seenOrderIds}
        seenCustomOrderIds={seenCustomOrderIds}
        markAsSeen={markAsSeen}
        hasNewOrders={hasNewOrders}
        hasNewCustomOrders={hasNewCustomOrders}
      />
    </PortalShellClient>
  );
}
