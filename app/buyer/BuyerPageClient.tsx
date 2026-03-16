"use client";
import { useRouter } from "next/navigation";
import { BuyerDashboard } from "@/app/portals/BuyerDashboard";
import {
  User as UserType,
  Product,
  Order,
  CustomOrder,
  CustomOrderProposal,
} from "@/app/types";
import { usePortalState } from "@/app/portals/usePortalState";
import PortalShellClient from "@/app/portals/PortalShellClient";

type Props = {
  user: UserType;
  initialProducts: Product[];
  initialOrders: Order[];
  initialCustomOrders: CustomOrder[];
  initialAllProposals: CustomOrderProposal[];
};

export default function BuyerPageClient({
  user,
  initialProducts,
  initialOrders,
  initialCustomOrders,
  initialAllProposals,
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
        router.replace("/buyer/login");
      }}
    >
      <BuyerDashboard
        user={user}
        initialProducts={initialProducts}
        initialOrders={initialOrders}
        initialCustomOrders={initialCustomOrders}
        initialAllProposals={initialAllProposals}
        seenOrderIds={seenOrderIds}
        seenCustomOrderIds={seenCustomOrderIds}
        markAsSeen={markAsSeen}
        hasNewOrders={hasNewOrders}
        hasNewCustomOrders={hasNewCustomOrders}
      />
    </PortalShellClient>
  );
}
