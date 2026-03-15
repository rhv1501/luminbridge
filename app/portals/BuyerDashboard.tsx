"use client";

/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useState } from "react";
import { useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Package,
  Plus,
  ShoppingCart,
  Clock,
  Image as ImageIcon,
  LogOut,
  X,
} from "lucide-react";
import { Card } from "@/app/ui/Card";
import { Button } from "@/app/ui/Button";
import { Input } from "@/app/ui/Input";
import { cn } from "@/app/ui/cn";
import { Order, Product, User as UserType } from "@/app/types";
import { NavigateDetail } from "@/app/portals/types";
import { SkeletonCardGrid } from "@/app/ui/Skeleton";

export const BuyerDashboard = (props: {
  user: UserType;
  initialProducts?: Product[];
  initialOrders?: Order[];
  initialCustomOrders?: import("@/app/types").CustomOrder[];
  initialAllProposals?: import("@/app/types").CustomOrderProposal[];
  seenOrderIds: number[];
  seenCustomOrderIds: number[];
  markAsSeen: (
    type: "order" | "custom-order" | "proposal" | "order-status",
    id: number,
    status?: string,
  ) => void;
  hasNewOrders: (orders: Order[]) => boolean;
  hasNewCustomOrders: (
    customOrders: import("@/app/types").CustomOrder[],
    proposals?: import("@/app/types").CustomOrderProposal[],
  ) => boolean;
}) => {
  const {
    user,
    initialProducts,
    initialOrders,
    initialCustomOrders,
    initialAllProposals,
    markAsSeen,
    hasNewOrders,
    hasNewCustomOrders,
  } = props;
  const [products, setProducts] = useState<Product[]>(initialProducts ?? []);
  const [orders, setOrders] = useState<Order[]>(initialOrders ?? []);
  const [customOrders, setCustomOrders] = useState<
    import("@/app/types").CustomOrder[]
  >(initialCustomOrders ?? []);
  const [proposals, setProposals] = useState<
    import("@/app/types").CustomOrderProposal[]
  >([]);
  const [allProposals, setAllProposals] = useState<
    import("@/app/types").CustomOrderProposal[]
  >(initialAllProposals ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(!initialProducts);
  const [error, setError] = useState<string | null>(null);
  const didInitialFetch = useRef(!!initialProducts);
  const [activeTab, setActiveTab] = useState<
    "catalog" | "my-orders" | "custom-orders"
  >("catalog");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [confirmCancelOrderId, setConfirmCancelOrderId] = useState<
    number | null
  >(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const [placingOrder, setPlacingOrder] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [cancelingOrderId, setCancelingOrderId] = useState<number | null>(null);
  const [reorderingOrderId, setReorderingOrderId] = useState<number | null>(
    null,
  );
  const [submittingCustomOrder, setSubmittingCustomOrder] = useState(false);
  const [confirmingProposalId, setConfirmingProposalId] = useState<
    number | null
  >(null);
  const [closingCustomOrderId, setClosingCustomOrderId] = useState<
    number | null
  >(null);

  const [showCustomOrderModal, setShowCustomOrderModal] = useState(false);
  const [selectedCustomOrder, setSelectedCustomOrder] = useState<
    import("@/app/types").CustomOrder | null
  >(null);
  const [customPhotoBase64, setCustomPhotoBase64] = useState("");
  const [customRequirements, setCustomRequirements] = useState("");

  const categories = [
    "All",
    "Chandeliers",
    "Wall Lights",
    "Solar Lights",
    "Hanging Lights",
    "Ceiling Lights",
    "Outdoor Lights",
  ];

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchData = async () => {
    try {
      const [pRes, oRes, coRes, apRes] = await Promise.all([
        fetch("/api/products?role=buyer"),
        fetch(`/api/orders?role=buyer&userId=${user.id}`),
        fetch(`/api/custom-orders?role=buyer&userId=${user.id}`),
        fetch(`/api/custom-order-proposals?role=buyer&userId=${user.id}`),
      ]);
      if (!pRes.ok || !oRes.ok || !coRes.ok) throw new Error("fetch failed");
      setProducts(await pRes.json());
      setOrders(await oRes.json());
      setCustomOrders(await coRes.json());
      if (apRes.ok) setAllProposals(await apRes.json());
      setIsLoading(false);
      setError(null);
    } catch {
      setError("Failed to load data. Please refresh.");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!didInitialFetch.current) fetchData();
    didInitialFetch.current = true;
  }, []);

  // Realtime refresh (Pusher on Vercel, SSE fallback locally)
  useEffect(() => {
    let disposed = false;
    let es: EventSource | null = null;
    let pusherCleanup: (() => void) | null = null;
    let refreshInFlight = false;
    let pendingRefresh = false;

    const refresh = async () => {
      if (disposed) return;
      if (refreshInFlight) {
        pendingRefresh = true;
        return;
      }
      refreshInFlight = true;
      try {
        await fetchData();
      } finally {
        refreshInFlight = false;
        if (pendingRefresh) {
          pendingRefresh = false;
          void refresh();
        }
      }
    };

    (async () => {
      try {
        const { getPusherClient, userChannelName } =
          await import("@/lib/pusherClient");
        const pusher = getPusherClient();
        if (pusher) {
          const channel = pusher.subscribe(userChannelName(user.id));
          const handler = () => void refresh();
          channel.bind("notifications", handler);
          channel.bind("refresh", handler);
          pusherCleanup = () => {
            try {
              channel.unbind("notifications", handler);
              channel.unbind("refresh", handler);
              pusher.unsubscribe(userChannelName(user.id));
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
        es = new EventSource(`/api/notifications/stream?userId=${user.id}`);
        es.addEventListener("notifications", () => {
          void refresh();
        });
        es.addEventListener("refresh", () => {
          void refresh();
        });
      } catch {
        // ignore
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
  }, [user.id]);

  useEffect(() => {
    if (selectedCustomOrder) {
      fetch(`/api/custom-orders/${selectedCustomOrder.id}/proposals?role=buyer`)
        .then((res) => res.json())
        .then((data: import("@/app/types").CustomOrderProposal[]) => {
          setProposals(data);
          data.forEach((p) => markAsSeen("proposal", p.id));
        });
    } else {
      setProposals([]);
    }
  }, [selectedCustomOrder]);

  useEffect(() => {
    const handleNavigate = async (event: Event) => {
      const detail = (event as CustomEvent<NavigateDetail>).detail;
      if (detail?.tab === "orders") setActiveTab("my-orders");
      if (detail?.tab === "products") setActiveTab("catalog");
      if (detail?.tab === "custom-orders") {
        setActiveTab("custom-orders");
        if (detail?.id) {
          try {
            const res = await fetch(
              `/api/custom-orders?role=buyer&userId=${user.id}`,
            );
            const data =
              (await res.json()) as import("@/app/types").CustomOrder[];
            setCustomOrders(data);
            const order = data.find((o) => o.id === detail.id);
            if (order) {
              setSelectedCustomOrder(order);
              markAsSeen("custom-order", order.id);
            }
          } catch (err) {
            console.error("Failed to fetch custom order details", err);
          }
        }
      }
    };
    window.addEventListener("navigate", handleNavigate);
    return () => window.removeEventListener("navigate", handleNavigate);
  }, []);

  const placeOrder = async () => {
    if (!selectedProduct) return;
    if (placingOrder) return;
    setPlacingOrder(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          buyer_id: user.id,
          quantity,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        showToast(data?.error || "Failed to place order");
        return;
      }
      setSelectedProduct(null);
      setViewingProduct(null);
      setQuantity(1);
      fetchData();
      setActiveTab("my-orders");
      showToast("Pre-order placed");
    } catch {
      showToast("Network error while placing order");
    } finally {
      setPlacingOrder(false);
    }
  };

  const updateOrderQuantity = async () => {
    if (!editingOrder) return;
    const orderId = editingOrder.id;
    if (updatingOrderId) return;
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        showToast(data?.error || "Failed to update quantity");
        return;
      }
      setEditingOrder(null);
      setQuantity(1);
      fetchData();
      showToast("Quantity updated");
    } catch {
      showToast("Network error while updating quantity");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const cancelOrder = async (orderId: number) => {
    if (cancelingOrderId) return;
    setCancelingOrderId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        showToast(data?.error || "Failed to cancel order");
        return;
      }
      setConfirmCancelOrderId(null);
      fetchData();
      showToast("Order cancelled");
    } catch {
      showToast("Network error while cancelling order");
    } finally {
      setCancelingOrderId(null);
    }
  };

  const handleReorder = async (order: Order) => {
    if (reorderingOrderId) return;
    setReorderingOrderId(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending", rejection_reason: null }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        showToast(data?.error || "Failed to reorder");
        return;
      }
      fetchData();
      showToast("Reorder requested");
    } catch {
      showToast("Network error while reordering");
    } finally {
      setReorderingOrderId(null);
    }
  };

  const submitCustomOrder = async () => {
    if (!customPhotoBase64 || !customRequirements.trim()) {
      showToast("Please provide both a photo and requirements.");
      return;
    }
    if (submittingCustomOrder) return;
    setSubmittingCustomOrder(true);
    try {
      const res = await fetch("/api/custom-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyer_id: user.id,
          photo: customPhotoBase64,
          requirements: customRequirements,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        showToast(data?.error || "Failed to submit request");
        return;
      }
      const newOrder = (await res.json().catch(() => null)) as {
        id?: number;
      } | null;
      if (newOrder?.id) {
        markAsSeen("custom-order", newOrder.id);
      }
      setShowCustomOrderModal(false);
      setCustomPhotoBase64("");
      setCustomRequirements("");
      fetchData();
      setActiveTab("custom-orders");
      showToast("Request submitted");
    } catch {
      showToast("Network error while submitting request");
    } finally {
      setSubmittingCustomOrder(false);
    }
  };

  const handleCustomPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCustomPhotoBase64(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const isWithin24Hours = (dateString: string) => {
    const orderDate = new Date(dateString).getTime();
    const now = new Date().getTime();
    return now - orderDate < 24 * 60 * 60 * 1000;
  };

  const isNewArrival = (dateString?: string) => {
    if (!dateString) return false;
    const productDate = new Date(dateString).getTime();
    const now = new Date().getTime();
    return now - productDate < 7 * 24 * 60 * 60 * 1000; // 7 days
  };

  const filteredProducts = products.filter(
    (p) => selectedCategory === "All" || p.category === selectedCategory,
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-8 relative">
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 font-medium max-w-[calc(100vw-2rem)] text-center"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-serif font-bold">Buyer Portal</h2>
          <p className="text-zinc-500">
            Browse latest lighting collections and place pre-orders
          </p>
        </div>
        <div className="flex bg-zinc-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab("catalog")}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-all relative whitespace-nowrap flex-shrink-0",
              activeTab === "catalog"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700",
            )}
          >
            Catalog
          </button>
          <button
            onClick={() => setActiveTab("my-orders")}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-all relative whitespace-nowrap flex-shrink-0",
              activeTab === "my-orders"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700",
            )}
          >
            My Orders
            {hasNewOrders(orders) && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("custom-orders")}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-all relative whitespace-nowrap flex-shrink-0",
              activeTab === "custom-orders"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700",
            )}
          >
            Custom Orders
            {hasNewCustomOrders(customOrders, allProposals) && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {isLoading && <SkeletonCardGrid count={6} />}
      {!isLoading && error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-4">
          <span>{error}</span>
          <button
            onClick={() => {
              setError(null);
              setIsLoading(true);
              fetchData();
            }}
            className="underline font-medium ml-auto flex-shrink-0"
          >
            Retry now
          </button>
        </div>
      )}
      {!isLoading && !error && activeTab === "catalog" && (
        <div className="space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                  selectedCategory === cat
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className="group hover:shadow-xl transition-all duration-300 border-zinc-100 cursor-pointer"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button")) return;
                  setViewingProduct(product);
                }}
              >
                <div className="h-64 bg-zinc-100 overflow-hidden relative">
                  <img
                    src={product.photo}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    alt={product.name}
                  />
                  {isNewArrival(product.created_at) && (
                    <div className="absolute top-3 left-3 bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-md">
                      New Arrival
                    </div>
                  )}
                  {product.category && (
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur text-zinc-800 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm">
                      {product.category}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProduct(product);
                        setQuantity(1);
                      }}
                      variant="secondary"
                      className="w-full"
                    >
                      Quick Order
                    </Button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-xl">{product.name}</h3>
                    <div className="text-emerald-600 font-mono font-bold text-lg">
                      <span className="text-xs align-top mt-1 mr-0.5">₹</span>
                      {product.buyer_price_inr?.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <p className="text-sm text-zinc-500 line-clamp-2 mb-4">
                    {product.description}
                  </p>
                  <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Package size={12} /> Pre-order Only
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> 15-20 Days Lead Time
                    </span>
                  </div>
                </div>
              </Card>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full text-center py-12 text-zinc-500">
                No products found in this category.
              </div>
            )}
          </div>
        </div>
      )}

      {!isLoading && !error && activeTab === "my-orders" && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-zinc-200">
              <ShoppingCart className="mx-auto text-zinc-300 mb-4" size={48} />
              <p className="text-zinc-500">
                You haven&apos;t placed any orders yet.
              </p>
              <Button
                onClick={() => setActiveTab("catalog")}
                variant="outline"
                className="mt-4"
              >
                Browse Catalog
              </Button>
            </div>
          ) : (
            orders.map((order) => {
              const canEditOrCancel =
                order.status === "pending" && isWithin24Hours(order.created_at);
              return (
                <Card
                  key={order.id}
                  className={cn(
                    "p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50 transition-colors",
                    hasNewOrders([order]) && "bg-blue-50/30",
                  )}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button")) return;
                    setSelectedOrder(order);
                    markAsSeen("order", order.id);
                    markAsSeen("order-status", order.id, order.status);
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-400 overflow-hidden">
                      {order.product_photo ? (
                        <img
                          src={order.product_photo}
                          alt={order.product_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package size={24} />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold">{order.product_name}</h4>
                      <p className="text-xs text-zinc-500">
                        Order ID: #{order.id} •{" "}
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                      {order.status === "rejected" &&
                        order.rejection_reason && (
                          <p className="text-xs text-red-600 mt-1 font-medium bg-red-50 p-2 rounded-lg border border-red-100">
                            Reason: {order.rejection_reason}
                          </p>
                        )}
                    </div>
                  </div>
                  <div className="flex items-center flex-wrap gap-3 sm:gap-8 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-center">
                      <p className="text-[10px] text-zinc-400 uppercase font-bold">
                        Quantity
                      </p>
                      <p className="font-bold">{order.quantity}</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <span
                        className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          order.status === "pending" &&
                            "bg-amber-100 text-amber-700",
                          order.status === "accepted" &&
                            "bg-blue-100 text-blue-700",
                          order.status === "rejected" &&
                            "bg-red-100 text-red-700",
                          order.status === "fulfilled" &&
                            "bg-emerald-100 text-emerald-700",
                          order.status === "cancelled" &&
                            "bg-zinc-100 text-zinc-700",
                        )}
                      >
                        {order.status}
                      </span>
                      <div className="flex gap-2">
                        {canEditOrCancel && (
                          <>
                            <Button
                              onClick={() => {
                                setEditingOrder(order);
                                setQuantity(order.quantity);
                              }}
                              variant="outline"
                              className="text-[10px] px-2 py-1 h-auto"
                            >
                              Edit Qty
                            </Button>
                            {confirmCancelOrderId === order.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-zinc-500">
                                  Sure?
                                </span>
                                <Button
                                  onClick={() => cancelOrder(order.id)}
                                  variant="danger"
                                  className="text-[10px] px-2 py-1 h-auto"
                                  loading={cancelingOrderId === order.id}
                                >
                                  Yes
                                </Button>
                                <Button
                                  onClick={() => setConfirmCancelOrderId(null)}
                                  variant="outline"
                                  className="text-[10px] px-2 py-1 h-auto"
                                  disabled={cancelingOrderId === order.id}
                                >
                                  No
                                </Button>
                              </div>
                            ) : (
                              <Button
                                onClick={() =>
                                  setConfirmCancelOrderId(order.id)
                                }
                                variant="danger"
                                className="text-[10px] px-2 py-1 h-auto"
                                disabled={cancelingOrderId === order.id}
                              >
                                Cancel
                              </Button>
                            )}
                          </>
                        )}
                        {order.status === "rejected" && (
                          <Button
                            onClick={() => handleReorder(order)}
                            variant="secondary"
                            className="text-[10px] px-2 py-1 h-auto"
                            loading={reorderingOrderId === order.id}
                          >
                            Reorder
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {!isLoading && !error && activeTab === "custom-orders" && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <Button
              onClick={() => setShowCustomOrderModal(true)}
              variant="primary"
            >
              <Plus size={18} /> New Custom Order
            </Button>
          </div>
          <div className="space-y-4">
            {customOrders.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-zinc-200">
                <ImageIcon className="mx-auto text-zinc-300 mb-4" size={48} />
                <p className="text-zinc-500">
                  You haven&apos;t placed any custom orders yet.
                </p>
              </div>
            ) : (
              customOrders.map((order) => (
                <Card
                  key={order.id}
                  className={cn(
                    "p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50/50 transition-colors",
                    hasNewCustomOrders(
                      [order],
                      allProposals.filter(
                        (p) => p.custom_order_id === order.id,
                      ),
                    ) && "bg-blue-50/30",
                  )}
                  onClick={() => {
                    setSelectedCustomOrder(order);
                    markAsSeen("custom-order", order.id);
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-zinc-100 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={order.photo}
                        alt="Custom Order"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="font-bold">Custom Order #{order.id}</h4>
                      <p className="text-xs text-zinc-500">
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                      <p className="text-sm text-zinc-700 mt-1 line-clamp-2">
                        {order.requirements}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center flex-wrap gap-3 sm:gap-8 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right flex flex-col items-end gap-2">
                      <span
                        className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          order.status === "pending" &&
                            "bg-amber-100 text-amber-700",
                          order.status === "sourcing" &&
                            "bg-blue-100 text-blue-700",
                          order.status === "found" &&
                            "bg-emerald-100 text-emerald-700",
                          order.status === "rejected" &&
                            "bg-red-100 text-red-700",
                        )}
                      >
                        {order.status === "found" ? "fulfilled" : order.status}
                      </span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Custom Order Details Modal */}
      <AnimatePresence>
        {selectedCustomOrder && (
          <div
            className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto"
            onClick={() => setSelectedCustomOrder(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold">
                    Custom Order #{selectedCustomOrder.id}
                  </h3>
                  <p className="text-zinc-500 text-sm">
                    Placed on{" "}
                    {new Date(selectedCustomOrder.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCustomOrder(null)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <div className="aspect-square bg-zinc-100 rounded-xl overflow-hidden mb-4">
                    <img
                      src={selectedCustomOrder.photo}
                      alt="Custom Order"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      Requirements
                    </h4>
                    <p className="text-sm text-zinc-800 whitespace-pre-wrap">
                      {selectedCustomOrder.requirements}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      Status
                    </h4>
                    <span
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                        selectedCustomOrder.status === "pending" &&
                          "bg-amber-100 text-amber-700",
                        selectedCustomOrder.status === "sourcing" &&
                          "bg-blue-100 text-blue-700",
                        selectedCustomOrder.status === "found" &&
                          "bg-emerald-100 text-emerald-700",
                        selectedCustomOrder.status === "rejected" &&
                          "bg-red-100 text-red-700",
                      )}
                    >
                      {selectedCustomOrder.status === "found"
                        ? "fulfilled"
                        : selectedCustomOrder.status}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      Proposals
                    </h4>
                    <div className="space-y-4">
                      {proposals.length === 0 ? (
                        <p className="text-sm text-zinc-500 italic">
                          No proposals available yet.
                        </p>
                      ) : (
                        proposals.map((proposal) => (
                          <div
                            key={proposal.id}
                            className="border border-zinc-200 rounded-lg p-4"
                          >
                            <div className="flex gap-4">
                              <div className="w-20 h-20 bg-zinc-100 rounded-lg overflow-hidden flex-shrink-0">
                                <img
                                  src={proposal.photo}
                                  alt="Proposal"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h5 className="font-bold text-sm">
                                      Proposal #{proposal.id}
                                    </h5>
                                    <p className="text-xs text-zinc-500">
                                      {new Date(
                                        proposal.created_at,
                                      ).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div className="text-emerald-600 font-mono font-bold">
                                    <span className="text-xs align-top mt-1 mr-0.5">
                                      ₹
                                    </span>
                                    {proposal.price_inr?.toLocaleString(
                                      "en-IN",
                                    )}
                                  </div>
                                </div>
                                <p className="text-sm text-zinc-800 mt-2">
                                  {proposal.description}
                                </p>
                                <div className="mt-3 flex justify-end gap-2">
                                  <Button
                                    className="px-3 py-1 text-sm"
                                    onClick={async () => {
                                      if (confirmingProposalId) return;
                                      setConfirmingProposalId(proposal.id);
                                      // Mark proposal as accepted
                                      try {
                                        const pRes = await fetch(
                                          `/api/custom-order-proposals/${proposal.id}`,
                                          {
                                            method: "PATCH",
                                            headers: {
                                              "Content-Type":
                                                "application/json",
                                            },
                                            body: JSON.stringify({
                                              status: "accepted",
                                            }),
                                          },
                                        );
                                        const oRes = await fetch(
                                          `/api/custom-orders/${selectedCustomOrder.id}`,
                                          {
                                            method: "PATCH",
                                            headers: {
                                              "Content-Type":
                                                "application/json",
                                            },
                                            body: JSON.stringify({
                                              status: "found",
                                            }),
                                          },
                                        );
                                        if (!pRes.ok || !oRes.ok) {
                                          showToast("Failed to confirm order");
                                          return;
                                        }
                                        setSelectedCustomOrder(null);
                                        fetchData();
                                        showToast("Order confirmed!");
                                      } catch {
                                        showToast(
                                          "Network error while confirming order",
                                        );
                                      } finally {
                                        setConfirmingProposalId(null);
                                      }
                                    }}
                                    loading={
                                      confirmingProposalId === proposal.id
                                    }
                                  >
                                    Confirm Order
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  {selectedCustomOrder.status !== "found" &&
                    selectedCustomOrder.status !== "rejected" && (
                      <div className="pt-6 border-t border-zinc-100">
                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={async () => {
                            if (closingCustomOrderId) return;
                            setClosingCustomOrderId(selectedCustomOrder.id);
                            try {
                              const res = await fetch(
                                `/api/custom-orders/${selectedCustomOrder.id}`,
                                {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({ status: "found" }),
                                },
                              );
                              if (!res.ok) {
                                const data = (await res
                                  .json()
                                  .catch(() => null)) as {
                                  error?: string;
                                } | null;
                                showToast(
                                  data?.error || "Failed to close custom order",
                                );
                                return;
                              }
                              setSelectedCustomOrder(null);
                              fetchData();
                              showToast("Requirement marked as fulfilled");
                            } catch {
                              showToast("Network error while closing order");
                            } finally {
                              setClosingCustomOrderId(null);
                            }
                          }}
                          loading={
                            closingCustomOrderId === selectedCustomOrder.id
                          }
                        >
                          Requirement Fulfilled (Close Order)
                        </Button>
                      </div>
                    )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Order Details Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div
            className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto"
            onClick={() => setSelectedOrder(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold">
                    Order #{selectedOrder.id}
                  </h3>
                  <p className="text-zinc-500 text-sm">
                    Placed on{" "}
                    {new Date(selectedOrder.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      Product
                    </h4>
                    {selectedOrder.product_photo && (
                      <img
                        src={selectedOrder.product_photo}
                        alt={selectedOrder.product_name}
                        className="w-24 h-24 object-cover rounded-lg mb-2"
                      />
                    )}
                    <p className="font-medium">{selectedOrder.product_name}</p>
                    <p className="text-sm text-zinc-600">
                      Quantity: {selectedOrder.quantity}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      Status
                    </h4>
                    <span
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                        selectedOrder.status === "pending" &&
                          "bg-amber-100 text-amber-700",
                        selectedOrder.status === "accepted" &&
                          "bg-blue-100 text-blue-700",
                        selectedOrder.status === "rejected" &&
                          "bg-red-100 text-red-700",
                        selectedOrder.status === "fulfilled" &&
                          "bg-emerald-100 text-emerald-700",
                        selectedOrder.status === "cancelled" &&
                          "bg-zinc-100 text-zinc-700",
                      )}
                    >
                      {selectedOrder.status}
                    </span>
                    {selectedOrder.status === "rejected" &&
                      selectedOrder.rejection_reason && (
                        <p className="text-sm text-red-600 italic mt-2">
                          Reason: {selectedOrder.rejection_reason}
                        </p>
                      )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Details Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div
            className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold">{selectedProduct.name}</h3>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                      selectedProduct.status === "published"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700",
                    )}
                  >
                    {selectedProduct.status}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <div className="aspect-square bg-zinc-100 rounded-xl overflow-hidden mb-4">
                    <img
                      src={selectedProduct.photo}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      Description
                    </h4>
                    <p className="text-sm text-zinc-800 whitespace-pre-wrap">
                      {selectedProduct.description}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      Specifications
                    </h4>
                    <p className="text-sm text-zinc-800 whitespace-pre-wrap">
                      {selectedProduct.specifications}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      Pricing
                    </h4>
                    <div className="flex flex-col gap-1">
                      {selectedProduct.buyer_price_inr && (
                        <div className="text-sm">
                          <span className="text-zinc-500">Price:</span>
                          <span className="ml-2 font-mono font-bold text-emerald-600">
                            INR {selectedProduct.buyer_price_inr.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Order Modal */}
      <AnimatePresence>
        {showCustomOrderModal && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCustomOrderModal(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-6"
            >
              <h3 className="text-xl font-bold mb-4">New Custom Order</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700">
                    Reference Photo
                  </label>
                  <div className="border-2 border-dashed border-zinc-300 rounded-xl p-4 text-center hover:border-zinc-400 transition-colors">
                    {customPhotoBase64 ? (
                      <div className="relative group">
                        <img
                          src={customPhotoBase64}
                          className="h-48 w-full object-contain rounded-lg"
                          alt="Preview"
                        />
                        <button
                          type="button"
                          onClick={() => setCustomPhotoBase64("")}
                          className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <LogOut size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="py-8">
                        <ImageIcon
                          className="mx-auto text-zinc-400 mb-2"
                          size={32}
                        />
                        <p className="text-sm text-zinc-500">
                          Click to upload or drag and drop
                        </p>
                        <input
                          type="file"
                          className="hidden"
                          id="custom-photo-upload"
                          accept="image/*"
                          onChange={handleCustomPhotoChange}
                        />
                        <label
                          htmlFor="custom-photo-upload"
                          className="mt-4 inline-block px-4 py-2 bg-white border border-zinc-300 rounded-lg text-sm font-medium cursor-pointer hover:bg-zinc-50"
                        >
                          Select Image
                        </label>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700">
                    Requirements
                  </label>
                  <textarea
                    value={customRequirements}
                    onChange={(e) => setCustomRequirements(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg h-24 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                    placeholder="Describe the product, material, dimensions, quantity needed..."
                    required
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowCustomOrderModal(false)}
                    disabled={submittingCustomOrder}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={submitCustomOrder}
                    loading={submittingCustomOrder}
                  >
                    Submit Request
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Order Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="h-48 bg-zinc-100">
                <img
                  src={selectedProduct.photo}
                  className="w-full h-full object-cover"
                  alt=""
                />
              </div>
              <div className="p-6 sm:p-8">
                <h3 className="text-2xl font-bold mb-2">
                  {selectedProduct.name}
                </h3>
                <p className="text-zinc-500 text-sm mb-6">
                  {selectedProduct.description}
                </p>

                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-4 bg-zinc-50 rounded-xl">
                    <div>
                      <p className="text-xs text-zinc-400 uppercase font-bold">
                        Price per unit
                      </p>
                      <p className="text-xl font-mono font-bold text-emerald-600">
                        ₹
                        {selectedProduct.buyer_price_inr?.toLocaleString(
                          "en-IN",
                        )}
                      </p>
                    </div>
                    <div className="w-full sm:w-32">
                      <Input
                        label="Quantity"
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setQuantity(parseInt(e.target.value || "0"))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-lg font-bold pt-4 border-t border-zinc-100">
                    <span>Total Estimated</span>
                    <span>
                      ₹
                      {(
                        (selectedProduct.buyer_price_inr || 0) * quantity
                      ).toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Button
                      onClick={() => setSelectedProduct(null)}
                      variant="outline"
                      disabled={placingOrder}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={placeOrder}
                      variant="secondary"
                      loading={placingOrder}
                    >
                      Confirm Pre-order
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* View Product Modal */}
        {viewingProduct && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingProduct(null)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] overflow-y-auto"
            >
              <div className="md:w-1/2 bg-zinc-100 min-h-[300px]">
                <img
                  src={viewingProduct.photo}
                  className="w-full h-full object-cover"
                  alt={viewingProduct.name}
                />
              </div>
              <div className="p-6 sm:p-8 md:w-1/2 overflow-y-auto">
                <h3 className="text-3xl font-bold mb-2">
                  {viewingProduct.name}
                </h3>
                <div className="text-emerald-600 font-mono font-bold text-2xl mb-6">
                  <span className="text-sm align-top mt-1 mr-0.5">₹</span>
                  {viewingProduct.buyer_price_inr?.toLocaleString("en-IN")}
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-bold uppercase text-zinc-400 mb-2">
                      Description
                    </h4>
                    <p className="text-zinc-700 text-sm leading-relaxed">
                      {viewingProduct.description}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold uppercase text-zinc-400 mb-2">
                      Specifications
                    </h4>
                    <p className="text-zinc-700 text-sm leading-relaxed whitespace-pre-wrap">
                      {viewingProduct.specifications}
                    </p>
                  </div>

                  <div className="pt-6 border-t border-zinc-100 flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <Button
                      onClick={() => setViewingProduct(null)}
                      variant="outline"
                      className="flex-1"
                    >
                      Close
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedProduct(viewingProduct);
                        setViewingProduct(null);
                        setQuantity(1);
                      }}
                      variant="secondary"
                      className="flex-1"
                    >
                      Order Now
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Edit Order Modal */}
        {editingOrder && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingOrder(null)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 sm:p-8">
                <h3 className="text-2xl font-bold mb-2">
                  Edit Order #{editingOrder.id}
                </h3>
                <p className="text-zinc-500 text-sm mb-6">
                  {editingOrder.product_name}
                </p>

                <div className="space-y-6">
                  <div className="w-full">
                    <Input
                      label="New Quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setQuantity(parseInt(e.target.value || "0"))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Button
                      onClick={() => setEditingOrder(null)}
                      variant="outline"
                      disabled={updatingOrderId === editingOrder.id}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={updateOrderQuantity}
                      variant="secondary"
                      loading={updatingOrderId === editingOrder.id}
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App ---
