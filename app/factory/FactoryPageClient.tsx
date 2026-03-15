"use client";
import { useRouter } from "next/navigation";
import { FactoryDashboard } from "@/app/portals/FactoryDashboard";
import { User as UserType, Product, Order, CustomOrder } from "@/app/types";
import { usePortalState } from "@/app/portals/usePortalState";
import PortalShellClient from "@/app/portals/PortalShellClient";

type Props = {
  user: UserType;
  initialProducts: Product[];
  initialOrders: Order[];
  initialCustomOrders: CustomOrder[];
};

export default function FactoryPageClient({
  user,
  initialProducts,
  initialOrders,
  initialCustomOrders,
}: Props) {
  const router = useRouter();
  const {
    seenOrderIds,
    seenCustomOrderIds,
    seenOrderStatuses,
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
      <FactoryDashboard
        user={user}
        initialProducts={initialProducts}
        initialOrders={initialOrders}
        initialCustomOrders={initialCustomOrders}
        seenOrderIds={seenOrderIds}
        seenCustomOrderIds={seenCustomOrderIds}
        seenOrderStatuses={seenOrderStatuses}
        markAsSeen={markAsSeen}
        hasNewOrders={hasNewOrders}
        hasNewCustomOrders={hasNewCustomOrders}
      />
    </PortalShellClient>
  );
}
