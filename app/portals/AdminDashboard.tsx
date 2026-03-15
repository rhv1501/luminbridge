"use client";

/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useState } from "react";
import { useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useForm } from "react-hook-form";
import {
  ShoppingCart,
  Clock,
  CheckCircle,
  Settings as SettingsIcon,
  Edit,
  X,
} from "lucide-react";
import { Card } from "@/app/ui/Card";
import { Button } from "@/app/ui/Button";
import { Input } from "@/app/ui/Input";
import { cn } from "@/app/ui/cn";
import { Order, Product, Settings } from "@/app/types";
import { NavigateDetail, ProductFormValues } from "@/app/portals/types";
import { SkeletonCardGrid } from "@/app/ui/Skeleton";

export const AdminDashboard = ({
  user,
  initialProducts,
  initialOrders,
  initialCustomOrders,
  initialSettings,
  seenOrderIds,
  seenCustomOrderIds,
  markAsSeen,
  hasNewOrders,
  hasNewCustomOrders,
}: {
  user: import("@/app/types").User;
  initialProducts?: Product[];
  initialOrders?: Order[];
  initialCustomOrders?: import("@/app/types").CustomOrder[];
  initialSettings?: Settings;
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
  const [products, setProducts] = useState<Product[]>(initialProducts ?? []);
  const [orders, setOrders] = useState<Order[]>(initialOrders ?? []);
  const [customOrders, setCustomOrders] = useState<
    import("@/app/types").CustomOrder[]
  >(initialCustomOrders ?? []);
  const [settings, setSettings] = useState<Settings>(
    initialSettings ?? { exchange_rate: "12.0", admin_markup: "1.2" },
  );
  const [isLoading, setIsLoading] = useState<boolean>(!initialProducts);
  const [error, setError] = useState<string | null>(null);
  const didInitialFetch = useRef(!!initialProducts);
  const [activeTab, setActiveTab] = useState<
    "products" | "orders" | "custom-orders" | "settings"
  >("products");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedCustomOrder, setSelectedCustomOrder] = useState<
    import("@/app/types").CustomOrder | null
  >(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [proposals, setProposals] = useState<
    import("@/app/types").CustomOrderProposal[]
  >([]);
  const [publishingProposalId, setPublishingProposalId] = useState<
    number | null
  >(null);
  const [publishingPrice, setPublishingPrice] = useState<string>("");
  const { register, handleSubmit, setValue } = useForm<ProductFormValues>();

  const [publishingProductId, setPublishingProductId] = useState<number | null>(
    null,
  );
  const [unpublishingProductId, setUnpublishingProductId] = useState<
    number | null
  >(null);
  const [savingEditedProduct, setSavingEditedProduct] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [updatingCustomOrderStatusId, setUpdatingCustomOrderStatusId] =
    useState<number | null>(null);
  const [publishingProposalConfirmingId, setPublishingProposalConfirmingId] =
    useState<number | null>(null);

  const fetchData = async () => {
    try {
      const [pRes, oRes, sRes, coRes] = await Promise.all([
        fetch("/api/products?role=admin"),
        fetch("/api/orders?role=admin"),
        fetch("/api/settings"),
        fetch("/api/custom-orders?role=admin"),
      ]);
      if (!pRes.ok || !oRes.ok || !sRes.ok || !coRes.ok)
        throw new Error("fetch failed");
      setProducts(await pRes.json());
      setOrders(await oRes.json());
      setSettings(await sRes.json());
      setCustomOrders(await coRes.json());
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
      fetch(`/api/custom-orders/${selectedCustomOrder.id}/proposals?role=admin`)
        .then((res) => res.json())
        .then(setProposals);
    } else {
      setProposals([]);
    }
  }, [selectedCustomOrder]);

  useEffect(() => {
    const handleNavigate = async (event: Event) => {
      const detail = (event as CustomEvent<NavigateDetail>).detail;
      if (detail?.tab === "orders") setActiveTab("orders");
      if (detail?.tab === "products") setActiveTab("products");
      if (detail?.tab === "custom-orders") {
        setActiveTab("custom-orders");
        if (detail?.id) {
          try {
            const res = await fetch("/api/custom-orders?role=admin");
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

  const handlePublish = async (product: Product) => {
    const inrPrice =
      product.factory_price_cny *
      parseFloat(settings.exchange_rate) *
      parseFloat(settings.admin_markup);
    if (publishingProductId) return;
    setPublishingProductId(product.id);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyer_price_inr: inrPrice,
          status: "published",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        showToast(data?.error || "Failed to publish product");
        return;
      }
      fetchData();
      showToast(product.status === "published" ? "Price updated" : "Published");
    } catch {
      showToast("Network error while publishing");
    } finally {
      setPublishingProductId(null);
    }
  };

  const handleUnpublish = async (id: number) => {
    if (unpublishingProductId) return;
    setUnpublishingProductId(id);
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "pending",
          buyer_price_inr: null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        showToast(data?.error || "Failed to unpublish product");
        return;
      }
      fetchData();
      showToast("Unpublished");
    } catch {
      showToast("Network error while unpublishing");
    } finally {
      setUnpublishingProductId(null);
    }
  };

  const onEditSubmit = async (data: ProductFormValues) => {
    if (!editingProduct) return;
    if (savingEditedProduct) return;
    setSavingEditedProduct(true);
    try {
      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          factory_price_cny: Number(data.factory_price_cny),
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        showToast(payload?.error || "Failed to save changes");
        return;
      }
      setEditingProduct(null);
      fetchData();
      showToast("Saved");
    } catch {
      showToast("Network error while saving");
    } finally {
      setSavingEditedProduct(false);
    }
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setValue("name", product.name);
    setValue("description", product.description);
    setValue("specifications", product.specifications);
    setValue("factory_price_cny", product.factory_price_cny);
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const refreshSelectedCustomOrderProposals = async (customOrderId: number) => {
    try {
      const res = await fetch(
        `/api/custom-orders/${customOrderId}/proposals?role=admin`,
      );
      if (!res.ok) throw new Error("fetch failed");
      setProposals(await res.json());
    } catch {
      showToast("Failed to refresh proposals");
    }
  };

  const updateCustomOrderStatus = async (orderId: number, status: string) => {
    if (updatingCustomOrderStatusId) return;

    const previousStatus = customOrders.find((o) => o.id === orderId)?.status;
    setUpdatingCustomOrderStatusId(orderId);
    setCustomOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: status as any } : o)),
    );
    try {
      const res = await fetch(`/api/custom-orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        showToast(payload?.error || "Failed to update status");
        if (previousStatus) {
          setCustomOrders((prev) =>
            prev.map((o) =>
              o.id === orderId ? { ...o, status: previousStatus as any } : o,
            ),
          );
        }
        return;
      }
      await fetchData();
      showToast("Status updated");
    } catch {
      showToast("Network error while updating status");
      if (previousStatus) {
        setCustomOrders((prev) =>
          prev.map((o) =>
            o.id === orderId ? { ...o, status: previousStatus as any } : o,
          ),
        );
      }
    } finally {
      setUpdatingCustomOrderStatusId(null);
    }
  };

  const confirmPublishProposal = async (
    proposalId: number,
    customOrderId: number,
  ) => {
    if (publishingProposalConfirmingId) return;

    const price = Number(publishingPrice);
    if (!Number.isFinite(price) || price <= 0) {
      showToast("Enter a valid buyer price");
      return;
    }

    setPublishingProposalConfirmingId(proposalId);
    try {
      const res = await fetch(`/api/custom-order-proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published", price_inr: price }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        showToast(payload?.error || "Failed to publish proposal");
        return;
      }
      setPublishingProposalId(null);
      await refreshSelectedCustomOrderProposals(customOrderId);
      showToast("Proposal published to buyer");
    } catch {
      showToast("Network error while publishing proposal");
    } finally {
      setPublishingProposalConfirmingId(null);
    }
  };

  const saveSettings = async () => {
    if (savingSettings) return;
    setSavingSettings(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        showToast(payload?.error || "Failed to save settings");
        return;
      }
      showToast("Settings saved");
    } catch {
      showToast("Network error while saving settings");
    } finally {
      setSavingSettings(false);
    }
  };

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
          <h2 className="text-2xl font-serif font-bold">Admin Control Panel</h2>
          <p className="text-zinc-500">
            Manage global settings, products, and orders
          </p>
        </div>
        <div className="flex bg-zinc-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
          {(["products", "orders", "custom-orders", "settings"] as const).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize relative whitespace-nowrap flex-shrink-0",
                  activeTab === tab
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700",
                )}
              >
                {tab.replace("-", " ")}
                {tab === "orders" && hasNewOrders(orders) && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
                {tab === "custom-orders" &&
                  hasNewCustomOrders(customOrders) && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                  )}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
              <ShoppingCart size={24} />
            </div>
            <div>
              <p className="text-sm text-zinc-500 font-medium">Total Orders</p>
              <h3 className="text-2xl font-bold">
                {orders.length + customOrders.length}
              </h3>
            </div>
          </div>
        </Card>
        <Card className="p-6 bg-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-sm text-zinc-500 font-medium">
                Pending Orders
              </p>
              <h3 className="text-2xl font-bold">
                {orders.filter((o) => o.status === "pending").length +
                  customOrders.filter((o) => o.status === "pending").length}
              </h3>
            </div>
          </div>
        </Card>
        <Card className="p-6 bg-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
              <CheckCircle size={24} />
            </div>
            <div>
              <p className="text-sm text-zinc-500 font-medium">
                Fulfilled Orders
              </p>
              <h3 className="text-2xl font-bold">
                {orders.filter((o) => o.status === "fulfilled").length +
                  customOrders.filter((o) => o.status === "found").length}
              </h3>
            </div>
          </div>
        </Card>
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
      {!isLoading && !error && activeTab === "products" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {products.map((product) => (
              <Card
                key={product.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 cursor-pointer hover:bg-zinc-50 transition-colors"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button")) return;
                  setSelectedProduct(product);
                }}
              >
                <div className="w-24 h-24 bg-zinc-100 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={product.photo}
                    className="w-full h-full object-cover"
                    alt=""
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">{product.name}</h3>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                        product.status === "published"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700",
                      )}
                    >
                      {product.status}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 items-center">
                    <span className="text-[10px] font-bold text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded">
                      {product.factory_company || "Unknown Factory"}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      WeChat: {product.factory_wechat || "N/A"}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Mob: {product.factory_mobile || "N/A"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {product.description}
                  </p>
                  <div className="flex flex-wrap gap-4 mt-2">
                    <div className="text-xs">
                      <span className="text-zinc-400">Factory Price:</span>
                      <span className="ml-1 font-mono font-bold">
                        CNY {product.factory_price_cny.toFixed(2)}
                      </span>
                    </div>
                    {product.buyer_price_inr && (
                      <div className="text-xs">
                        <span className="text-zinc-400">Buyer Price:</span>
                        <span className="ml-1 font-mono font-bold text-emerald-600">
                          INR {product.buyer_price_inr.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <div className="text-right text-[10px] text-zinc-400 font-mono mb-1">
                      EST. INR:{" "}
                      {(
                        product.factory_price_cny *
                        parseFloat(settings.exchange_rate) *
                        parseFloat(settings.admin_markup)
                      ).toFixed(2)}
                    </div>
                    <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                      <Button
                        onClick={() => startEdit(product)}
                        variant="outline"
                        className="text-xs py-1.5 px-3"
                      >
                        <Edit size={14} /> Edit
                      </Button>
                      <Button
                        onClick={() => handlePublish(product)}
                        variant={
                          product.status === "published"
                            ? "outline"
                            : "secondary"
                        }
                        className="text-xs py-1.5"
                        loading={publishingProductId === product.id}
                        disabled={unpublishingProductId === product.id}
                      >
                        {product.status === "published"
                          ? "Update Price"
                          : "Publish to India"}
                      </Button>
                      {product.status === "published" && (
                        <Button
                          onClick={() => handleUnpublish(product.id)}
                          variant="outline"
                          className="text-xs py-1.5 px-3 text-amber-600 border-amber-200 hover:bg-amber-50"
                          loading={unpublishingProductId === product.id}
                          disabled={publishingProductId === product.id}
                        >
                          Unpublish
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingProduct(null)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-5 sm:p-8">
                <h3 className="text-2xl font-bold mb-6">
                  Edit Product Details
                </h3>
                <form
                  onSubmit={handleSubmit(onEditSubmit)}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Product Name"
                      {...register("name")}
                      required
                    />
                    <Input
                      label="Factory Price (CNY)"
                      type="number"
                      step="0.01"
                      {...register("factory_price_cny")}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-zinc-700">
                      Description
                    </label>
                    <textarea
                      {...register("description")}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg h-24 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-zinc-700">
                      Specifications
                    </label>
                    <textarea
                      {...register("specifications")}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg h-24 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                      required
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
                    <Button
                      onClick={() => setEditingProduct(null)}
                      variant="outline"
                      className="flex-1"
                      disabled={savingEditedProduct}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      loading={savingEditedProduct}
                    >
                      Save Changes
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {!isLoading && !error && activeTab === "orders" && (
        <>
          <div className="space-y-3 md:hidden">
            {orders.map((order) => (
              <Card
                key={order.id}
                className={cn(
                  "p-4",
                  !seenOrderIds.includes(order.id) && "bg-blue-50/30",
                )}
                onClick={() => {
                  setSelectedOrder(order);
                  markAsSeen("order", order.id);
                }}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-zinc-500">
                        #{order.id}
                      </p>
                      <p className="font-medium truncate">
                        {order.product_name}
                      </p>
                    </div>
                    <span className="font-bold">{order.quantity}</span>
                  </div>
                  <div className="text-xs text-zinc-600 space-y-0.5">
                    <p className="font-semibold">
                      {order.buyer_company || "N/A"}
                    </p>
                    <p className="truncate">{order.buyer_email}</p>
                    <p className="truncate">{order.buyer_whatsapp}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider w-fit",
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
                    <p className="text-[10px] text-zinc-400">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[900px] text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-bottom border-zinc-200">
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Order ID
                  </th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Product
                  </th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Buyer Details
                  </th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Qty
                  </th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Status
                  </th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className={cn(
                      "hover:bg-zinc-50/50 transition-colors cursor-pointer",
                      !seenOrderIds.includes(order.id) && "bg-blue-50/30",
                    )}
                    onClick={() => {
                      setSelectedOrder(order);
                      markAsSeen("order", order.id);
                    }}
                  >
                    <td className="p-4 font-mono text-sm">#{order.id}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {order.product_photo && (
                          <img
                            src={order.product_photo}
                            alt={order.product_name}
                            className="w-10 h-10 object-cover rounded-md border border-zinc-200"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <span className="font-medium">
                          {order.product_name}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-bold">
                        {order.buyer_company || "N/A"}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {order.buyer_email}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {order.buyer_whatsapp}
                      </div>
                    </td>
                    <td className="p-4 font-bold">{order.quantity}</td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className={cn(
                            "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider w-fit",
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
                        {order.status === "rejected" &&
                          order.rejection_reason && (
                            <span className="text-[10px] text-red-600 italic mt-1">
                              Reason: {order.rejection_reason}
                            </span>
                          )}
                      </div>
                    </td>
                    <td className="p-4 text-xs text-zinc-400">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {!isLoading && !error && activeTab === "custom-orders" && (
        <>
          <div className="space-y-3 md:hidden">
            {customOrders.map((order) => (
              <Card
                key={order.id}
                className={cn(
                  "p-4",
                  !seenCustomOrderIds.includes(order.id) && "bg-blue-50",
                )}
                onClick={() => {
                  setSelectedCustomOrder(order);
                  markAsSeen("custom-order", order.id);
                }}
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 bg-zinc-100 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={order.photo}
                        alt="Custom Order"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-zinc-500">
                        #{order.id}
                      </p>
                      <p className="font-semibold truncate">
                        {order.buyer_company || "N/A"}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {order.buyer_email}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-700 line-clamp-2">
                    {order.requirements}
                  </p>
                  <div
                    className="flex items-center justify-between gap-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider w-fit",
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
                      {order.status}
                    </span>
                    <select
                      value={order.status}
                      onChange={async (e) => {
                        await updateCustomOrderStatus(order.id, e.target.value);
                      }}
                      disabled={updatingCustomOrderStatusId === order.id}
                      className="text-xs border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="pending">Pending</option>
                      <option value="sourcing">Sourcing</option>
                      <option value="found">Found</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[980px] text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-bottom border-zinc-200">
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Order ID
                  </th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Photo
                  </th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Buyer Details
                  </th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Requirements
                  </th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Status
                  </th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {customOrders.map((order) => (
                  <tr
                    key={order.id}
                    className={cn(
                      "hover:bg-zinc-50/50 transition-colors cursor-pointer",
                      !seenCustomOrderIds.includes(order.id) && "bg-blue-50",
                    )}
                    onClick={() => {
                      setSelectedCustomOrder(order);
                      markAsSeen("custom-order", order.id);
                    }}
                  >
                    <td className="p-4 font-mono text-sm">#{order.id}</td>
                    <td className="p-4">
                      <div className="w-16 h-16 bg-zinc-100 rounded-lg overflow-hidden">
                        <img
                          src={order.photo}
                          alt="Custom Order"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-bold">
                        {order.buyer_company || "N/A"}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {order.buyer_email}
                      </div>
                    </td>
                    <td
                      className="p-4 text-sm max-w-xs truncate"
                      title={order.requirements}
                    >
                      {order.requirements}
                    </td>
                    <td className="p-4">
                      <span
                        className={cn(
                          "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider w-fit",
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
                        {order.status}
                      </span>
                    </td>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={order.status}
                        onChange={async (e) => {
                          await updateCustomOrderStatus(
                            order.id,
                            e.target.value,
                          );
                        }}
                        disabled={updatingCustomOrderStatusId === order.id}
                        className="text-xs border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="pending">Pending</option>
                        <option value="sourcing">Sourcing</option>
                        <option value="found">Found</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
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
                      Buyer Details
                    </h4>
                    <p className="font-medium">
                      {selectedCustomOrder.buyer_company || "N/A"}
                    </p>
                    <p className="text-sm text-zinc-600">
                      {selectedCustomOrder.buyer_email}
                    </p>
                  </div>
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
                      {selectedCustomOrder.status}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      Proposals
                    </h4>
                    <div className="space-y-4">
                      {proposals.length === 0 ? (
                        <p className="text-sm text-zinc-500 italic">
                          No proposals yet.
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
                                      {proposal.factory_company ||
                                        "Unknown Factory"}
                                    </h5>
                                    <p className="text-xs text-zinc-500">
                                      {new Date(
                                        proposal.created_at,
                                      ).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <span
                                    className={cn(
                                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                                      proposal.status === "pending" &&
                                        "bg-amber-100 text-amber-700",
                                      proposal.status === "published" &&
                                        "bg-blue-100 text-blue-700",
                                      proposal.status === "accepted" &&
                                        "bg-emerald-100 text-emerald-700",
                                      proposal.status === "rejected" &&
                                        "bg-red-100 text-red-700",
                                    )}
                                  >
                                    {proposal.status}
                                  </span>
                                </div>
                                <p className="text-sm text-zinc-800 mt-2 whitespace-pre-wrap">
                                  {proposal.description}
                                </p>
                                <div className="mt-3 flex flex-col gap-2">
                                  <div className="text-xs flex justify-between items-center">
                                    <span className="text-zinc-500">
                                      Factory Price:
                                    </span>
                                    <span className="font-mono font-bold">
                                      CNY {proposal.price_cny.toFixed(2)}
                                    </span>
                                  </div>

                                  {proposal.status === "pending" &&
                                    (publishingProposalId === proposal.id ? (
                                      <div className="flex items-center gap-2 mt-2">
                                        <div className="flex-1">
                                          <Input
                                            label="Buyer Price (INR)"
                                            type="number"
                                            value={publishingPrice}
                                            disabled={
                                              publishingProposalConfirmingId ===
                                              proposal.id
                                            }
                                            onChange={(
                                              e: React.ChangeEvent<HTMLInputElement>,
                                            ) =>
                                              setPublishingPrice(e.target.value)
                                            }
                                          />
                                        </div>
                                        <Button
                                          className="h-9"
                                          loading={
                                            publishingProposalConfirmingId ===
                                            proposal.id
                                          }
                                          disabled={
                                            !!publishingProposalConfirmingId &&
                                            publishingProposalConfirmingId !==
                                              proposal.id
                                          }
                                          onClick={async () => {
                                            if (!selectedCustomOrder) return;
                                            await confirmPublishProposal(
                                              proposal.id,
                                              selectedCustomOrder.id,
                                            );
                                          }}
                                        >
                                          Confirm
                                        </Button>
                                        <Button
                                          variant="outline"
                                          className="h-9"
                                          disabled={
                                            publishingProposalConfirmingId ===
                                            proposal.id
                                          }
                                          onClick={() =>
                                            setPublishingProposalId(null)
                                          }
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        className="w-full mt-2 text-xs"
                                        onClick={() => {
                                          const calculatedPrice = (
                                            proposal.price_cny *
                                            parseFloat(settings.exchange_rate) *
                                            parseFloat(settings.admin_markup)
                                          ).toFixed(2);
                                          setPublishingPrice(calculatedPrice);
                                          setPublishingProposalId(proposal.id);
                                        }}
                                      >
                                        Publish (Est. INR{" "}
                                        {(
                                          proposal.price_cny *
                                          parseFloat(settings.exchange_rate) *
                                          parseFloat(settings.admin_markup)
                                        ).toFixed(2)}
                                        )
                                      </Button>
                                    ))}

                                  {proposal.status === "published" && (
                                    <div className="text-xs flex justify-between items-center">
                                      <span className="text-zinc-500">
                                        Buyer Price:
                                      </span>
                                      <span className="font-mono font-bold text-emerald-600">
                                        INR {proposal.price_inr?.toFixed(2)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
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
                <div>
                  <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    Buyer Details
                  </h4>
                  <p className="font-medium">
                    {selectedOrder.buyer_company || "N/A"}
                  </p>
                  <p className="text-sm text-zinc-600">
                    {selectedOrder.buyer_email}
                  </p>
                  <p className="text-sm text-zinc-600">
                    {selectedOrder.buyer_whatsapp}
                  </p>
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
                      Factory Details
                    </h4>
                    <p className="font-medium">
                      {selectedProduct.factory_company || "Unknown Factory"}
                    </p>
                    <p className="text-sm text-zinc-600">
                      WeChat: {selectedProduct.factory_wechat || "N/A"}
                    </p>
                    <p className="text-sm text-zinc-600">
                      Mob: {selectedProduct.factory_mobile || "N/A"}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      Pricing
                    </h4>
                    <div className="flex flex-col gap-1">
                      <div className="text-sm">
                        <span className="text-zinc-500">Factory Price:</span>
                        <span className="ml-2 font-mono font-bold">
                          CNY {selectedProduct.factory_price_cny.toFixed(2)}
                        </span>
                      </div>
                      {selectedProduct.buyer_price_inr && (
                        <div className="text-sm">
                          <span className="text-zinc-500">Buyer Price:</span>
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

      {!isLoading && !error && activeTab === "settings" && (
        <Card className="p-6 sm:p-8 max-w-2xl mx-auto">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <SettingsIcon size={20} /> Pricing Algorithm
          </h3>
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Input
                label="Exchange Rate (1 CNY to INR)"
                type="number"
                step="0.01"
                value={settings.exchange_rate}
                disabled={savingSettings}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSettings({ ...settings, exchange_rate: e.target.value })
                }
              />
              <Input
                label="Admin Markup (Multiplier)"
                type="number"
                step="0.01"
                value={settings.admin_markup}
                disabled={savingSettings}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSettings({ ...settings, admin_markup: e.target.value })
                }
              />
            </div>
            <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200">
              <p className="text-xs text-zinc-500 uppercase font-bold mb-2">
                Formula Preview
              </p>
              <p className="text-lg font-mono">
                Buyer Price = Factory Price (CNY) × {settings.exchange_rate} ×{" "}
                {settings.admin_markup}
              </p>
            </div>
            <Button
              onClick={saveSettings}
              className="w-full"
              loading={savingSettings}
            >
              Save Global Settings
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
