"use client";

/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useState } from "react";
import { useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useForm } from "react-hook-form";
import {
  Plus,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  LogOut,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "@/app/ui/Card";
import { Button } from "@/app/ui/Button";
import { Input } from "@/app/ui/Input";
import { cn } from "@/app/ui/cn";
import { Order, Product, User as UserType } from "@/app/types";
import { NavigateDetail, ProductFormValues } from "@/app/portals/types";
import { SkeletonCardGrid } from "@/app/ui/Skeleton";

let xlsxImport: Promise<typeof import("xlsx")> | null = null;
async function loadXlsx() {
  if (!xlsxImport) xlsxImport = import("xlsx");
  return xlsxImport;
}

export const FactoryDashboard = ({
  user,
  initialProducts,
  initialOrders,
  initialCustomOrders,
  seenOrderIds,
  seenCustomOrderIds,
  seenOrderStatuses,
  markAsSeen,
  hasNewOrders,
  hasNewCustomOrders,
}: {
  user: UserType;
  initialProducts?: Product[];
  initialOrders?: Order[];
  initialCustomOrders?: import("@/app/types").CustomOrder[];
  seenOrderIds: number[];
  seenCustomOrderIds: number[];
  seenOrderStatuses: Record<number, string>;
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
  const [isLoading, setIsLoading] = useState<boolean>(!initialProducts);
  const [error, setError] = useState<string | null>(null);
  const didInitialFetch = useRef(!!initialProducts);
  const [activeTab, setActiveTab] = useState<
    "products" | "orders" | "custom-orders"
  >("products");
  const [showUpload, setShowUpload] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [downloadingOrders, setDownloadingOrders] = useState<
    null | "daily" | "weekly" | "monthly"
  >(null);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(
    null,
  );
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [submittingProposal, setSubmittingProposal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [rejectOrderId, setRejectOrderId] = useState<number | null>(null);
  const [selectedCustomOrder, setSelectedCustomOrder] = useState<
    import("@/app/types").CustomOrder | null
  >(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting: submittingProduct },
  } = useForm<ProductFormValues>();
  const [photoBase64, setPhotoBase64] = useState("");
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalPhotoBase64, setProposalPhotoBase64] = useState("");
  const [proposalDescription, setProposalDescription] = useState("");
  const [proposalPrice, setProposalPrice] = useState("");

  const fetchData = async () => {
    try {
      const [pRes, oRes, coRes] = await Promise.all([
        fetch(`/api/products?role=factory&userId=${user.id}`),
        fetch(`/api/orders?role=factory&userId=${user.id}`),
        fetch(`/api/custom-orders?role=factory`),
      ]);
      if (!pRes.ok || !oRes.ok || !coRes.ok) throw new Error("fetch failed");
      setProducts(await pRes.json());
      setOrders(await oRes.json());
      setCustomOrders(await coRes.json());
      setIsLoading(false);
      setError(null);
    } catch {
      setError("Failed to load data. Retrying shortly…");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!didInitialFetch.current) fetchData();

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
        // If SSE isn't available, we simply keep the initial fetch.
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
  }, []);

  const handleProposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomOrder) return;

    if (submittingProposal) return;
    setSubmittingProposal(true);

    try {
      const res = await fetch(
        `/api/custom-orders/${selectedCustomOrder.id}/proposals`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            factory_id: user.id,
            photo: proposalPhotoBase64,
            description: proposalDescription,
            price_cny: parseFloat(proposalPrice),
          }),
        },
      );

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        showToast(data?.error || "Failed to submit proposal");
        return;
      }

      setShowProposalModal(false);
      setSelectedCustomOrder(null);
      setProposalPhotoBase64("");
      setProposalDescription("");
      setProposalPrice("");
      showToast("Proposal submitted successfully!");
      fetchData();
    } catch (err) {
      console.error(err);
      showToast("Failed to submit proposal");
    } finally {
      setSubmittingProposal(false);
    }
  };

  const handleProposalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProposalPhotoBase64(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const handleNavigate = async (event: Event) => {
      const detail = (event as CustomEvent<NavigateDetail>).detail;
      if (detail?.tab === "orders") setActiveTab("orders");
      if (detail?.tab === "products") setActiveTab("products");
      if (detail?.tab === "custom-orders") {
        setActiveTab("custom-orders");
        if (detail?.id) {
          try {
            const res = await fetch("/api/custom-orders?role=factory");
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

  const updateOrderStatus = async (
    orderId: number,
    status: string,
    reason?: string,
  ) => {
    if (updatingOrderId) return;
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejection_reason: reason }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        showToast(data?.error || "Failed to update order");
        return;
      }
      fetchData();
      showToast("Order updated");
    } catch {
      showToast("Network error while updating order");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRejectSubmit = () => {
    if (!rejectionReason.trim()) {
      showToast("Rejection reason is required");
      return;
    }
    if (rejectOrderId) {
      updateOrderStatus(rejectOrderId, "rejected", rejectionReason);
      setRejectOrderId(null);
      setRejectionReason("");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhotoBase64(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsBulkUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await loadXlsx();
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data =
          XLSX.utils.sheet_to_json<
            Record<string, string | number | null | undefined>
          >(ws);

        // Map Excel columns to our product fields
        // Expected columns: Name, Description, Specifications, Price (CNY), Photo URL, Category
        const productsToUpload = data
          .map((row) => ({
            name: String(row["Name"] ?? row["name"] ?? "").trim(),
            description: String(row["Description"] ?? row["description"] ?? ""),
            specifications: String(
              row["Specifications"] ?? row["specifications"] ?? "",
            ),
            factory_price_cny: Number(row["Price (CNY)"] ?? row["price"] ?? 0),
            photo: String(row["Photo URL"] ?? row["photo_url"] ?? ""),
            category: String(row["Category"] ?? row["category"] ?? "Other"),
            factory_id: user.id,
          }))
          .filter((p) => p.name.length > 0);

        if (productsToUpload.length === 0) {
          showToast(
            "No valid products found in Excel. Please check the column headers: Name, Description, Specifications, Price (CNY), Photo URL, Category",
          );
          return;
        }

        // Upload each product
        for (const product of productsToUpload) {
          await fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(product),
          });
        }

        showToast(`Successfully uploaded ${productsToUpload.length} products!`);
        fetchData();
      } catch (err) {
        console.error(err);
        showToast(
          "Error parsing Excel file. Please ensure it is a valid .xlsx or .csv file.",
        );
      } finally {
        setIsBulkUploading(false);
        e.target.value = ""; // Reset input
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = async () => {
    if (downloadingTemplate) return;
    setDownloadingTemplate(true);
    const template = [
      {
        Name: "Example Product",
        Description: "High quality LED light",
        Specifications: "Wattage: 10W, Material: Aluminum",
        "Price (CNY)": 45.5,
        "Photo URL": "https://picsum.photos/seed/light/800/600",
        Category: "Chandeliers",
      },
    ];
    try {
      const XLSX = await loadXlsx();
      const ws = XLSX.utils.json_to_sheet(template);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      XLSX.writeFile(wb, "LuminaBridge_Product_Template.xlsx");
      showToast("Template downloaded");
    } catch (err) {
      console.error(err);
      showToast("Failed to download template");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const onSubmit = async (data: ProductFormValues) => {
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          photo: photoBase64,
          factory_id: user.id,
          factory_price_cny: Number(data.factory_price_cny),
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        showToast(payload?.error || "Failed to submit product");
        return;
      }

      reset();
      setPhotoBase64("");
      setShowUpload(false);
      fetchData();
      showToast("Product submitted for review");
    } catch {
      showToast("Network error while submitting product");
    }
  };

  const handleDelete = async (id: number) => {
    if (deletingProductId) return;
    setDeletingProductId(id);
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (res.ok) {
        setConfirmDeleteId(null);
        fetchData();
        showToast("Product deleted");
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to delete product");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error while deleting product");
    } finally {
      setDeletingProductId(null);
    }
  };

  const downloadOrders = async (timeframe: "daily" | "weekly" | "monthly") => {
    if (downloadingOrders) return;
    setDownloadingOrders(timeframe);
    const now = new Date();
    let filteredOrders = orders;

    if (timeframe === "daily") {
      filteredOrders = orders.filter(
        (o) => new Date(o.created_at).toDateString() === now.toDateString(),
      );
    } else if (timeframe === "weekly") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredOrders = orders.filter((o) => new Date(o.created_at) >= weekAgo);
    } else if (timeframe === "monthly") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filteredOrders = orders.filter((o) => new Date(o.created_at) >= monthAgo);
    }

    const data = filteredOrders.map((o) => {
      const product = products.find((p) => p.id === o.product_id);
      return {
        "Order ID": o.id,
        "Buyer ID": o.buyer_id,
        "Product Code (ID)": o.product_id,
        "Product Name": o.product_name,
        Quantity: o.quantity,
        Status: o.status,
        Date: new Date(o.created_at).toLocaleDateString(),
        "Product Photo": o.product_photo || product?.photo || "N/A",
      };
    });

    if (data.length === 0) {
      showToast(`No orders found for the ${timeframe} timeframe.`);
      setDownloadingOrders(null);
      return;
    }

    try {
      const XLSX = await loadXlsx();
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Orders");

      // Use manual blob download for better compatibility in iframes
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);

      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = `Orders_${timeframe}_${now.toISOString().split("T")[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (clickErr) {
        console.warn("Download click failed, trying window.open", clickErr);
        window.open(url, "_blank");
      }

      URL.revokeObjectURL(url);

      showToast(`Downloaded ${timeframe} report successfully.`);
    } catch (err) {
      console.error("Download error:", err);
      showToast(
        "Error downloading report. Please try opening the app in a new tab.",
      );
    } finally {
      setDownloadingOrders(null);
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-serif font-bold">Factory Portal</h2>
          <p className="text-zinc-500">
            Manage your product catalog and submissions
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full md:w-auto md:flex-col md:items-end md:justify-end">
          <div className="flex bg-zinc-100 p-1 rounded-lg w-full md:w-auto overflow-x-auto">
            {(["products", "orders", "custom-orders"] as const).map((tab) => (
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
            ))}
          </div>

          {/* Actions: keep mobile layout, but give desktop breathing room on a new row */}
          <div className="w-full md:w-auto">
            {/* Mobile (<md): keep actions in one row (scrollable if needed) */}
            <div className="md:hidden">
              <div className="grid grid-cols-3 gap-2 w-full">
                <div className="min-w-0">
                  <Button
                    onClick={downloadTemplate}
                    variant="outline"
                    className="w-full min-h-9 px-2 py-1 text-[11px] gap-0.5 justify-center flex-col text-center"
                    loading={downloadingTemplate}
                  >
                    <Download size={12} />
                    <span className="whitespace-normal leading-tight">
                      Template
                    </span>
                  </Button>
                </div>

                <div className="relative min-w-0">
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleExcelUpload}
                    disabled={isBulkUploading}
                  />
                  <Button
                    variant="outline"
                    className="w-full min-h-9 px-2 py-1 text-[11px] gap-0.5 justify-center flex-col text-center"
                    disabled={isBulkUploading}
                    loading={isBulkUploading}
                  >
                    <FileSpreadsheet size={12} />
                    <span className="whitespace-normal leading-tight">
                      {isBulkUploading ? "Uploading..." : "Excel Upload"}
                    </span>
                  </Button>
                </div>

                <div className="min-w-0">
                  <Button
                    onClick={() => setShowUpload(!showUpload)}
                    variant={showUpload ? "outline" : "primary"}
                    className="w-full min-h-9 px-2 py-1 text-[11px] gap-0.5 justify-center flex-col text-center"
                  >
                    {showUpload ? (
                      <span className="whitespace-normal leading-tight">
                        Cancel
                      </span>
                    ) : (
                      <>
                        <Plus size={14} />
                        <span className="whitespace-normal leading-tight">
                          Add Product
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Desktop (md+): all actions on next line with larger gaps */}
            <div className="hidden md:flex flex-wrap justify-end gap-4 pt-2">
              <Button
                onClick={downloadTemplate}
                variant="outline"
                className="text-xs"
                loading={downloadingTemplate}
              >
                <Download size={14} /> Template
              </Button>

              <div className="relative">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleExcelUpload}
                  disabled={isBulkUploading}
                />
                <Button
                  variant="outline"
                  className="text-xs"
                  disabled={isBulkUploading}
                  loading={isBulkUploading}
                >
                  <FileSpreadsheet size={14} />{" "}
                  {isBulkUploading ? "Uploading..." : "Excel Upload"}
                </Button>
              </div>

              <Button
                onClick={() => setShowUpload(!showUpload)}
                variant={showUpload ? "outline" : "primary"}
              >
                {showUpload ? (
                  "Cancel"
                ) : (
                  <>
                    <Plus size={18} /> Add New Product
                  </>
                )}
              </Button>
            </div>
          </div>
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
      {!isLoading && !error && activeTab === "products" && (
        <>
          <AnimatePresence>
            {showUpload && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <Card className="p-6 bg-zinc-50/50">
                  <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  >
                    <div className="space-y-4">
                      <Input
                        label="Product Name"
                        {...register("name")}
                        required
                      />
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-zinc-700">
                          Category
                        </label>
                        <select
                          {...register("category")}
                          className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                          required
                        >
                          <option value="">Select Category</option>
                          <option value="Chandeliers">Chandeliers</option>
                          <option value="Wall Lights">Wall Lights</option>
                          <option value="Solar Lights">Solar Lights</option>
                          <option value="Hanging Lights">Hanging Lights</option>
                          <option value="Ceiling Lights">Ceiling Lights</option>
                          <option value="Outdoor Lights">Outdoor Lights</option>
                        </select>
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
                          Specifications (e.g. Wattage, Material)
                        </label>
                        <textarea
                          {...register("specifications")}
                          className="w-full px-3 py-2 border border-zinc-300 rounded-lg h-24 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <Input
                        label="Factory Price (CNY)"
                        type="number"
                        step="0.01"
                        {...register("factory_price_cny")}
                        required
                      />
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-zinc-700">
                          Product Photo
                        </label>
                        <div className="border-2 border-dashed border-zinc-300 rounded-xl p-4 text-center hover:border-zinc-400 transition-colors">
                          {photoBase64 ? (
                            <div className="relative group">
                              <img
                                src={photoBase64}
                                className="h-48 w-full object-contain rounded-lg"
                                alt="Preview"
                              />
                              <button
                                type="button"
                                onClick={() => setPhotoBase64("")}
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
                                id="photo-upload"
                                accept="image/*"
                                onChange={handleFileChange}
                              />
                              <label
                                htmlFor="photo-upload"
                                className="mt-4 inline-block px-4 py-2 bg-white border border-zinc-300 rounded-lg text-sm font-medium cursor-pointer hover:bg-zinc-50"
                              >
                                Select Image
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        loading={submittingProduct}
                      >
                        Submit for Review
                      </Button>
                    </div>
                  </form>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {products.map((product) => (
              <Card
                key={product.id}
                className="flex flex-col cursor-pointer hover:shadow-md transition-shadow"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button")) return;
                  setSelectedProduct(product);
                }}
              >
                <div className="h-48 bg-zinc-100 relative">
                  {product.photo ? (
                    <img
                      src={product.photo}
                      className="w-full h-full object-cover"
                      alt={product.name}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400">
                      <ImageIcon size={48} />
                    </div>
                  )}
                  <div
                    className={cn(
                      "absolute top-3 right-3 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                      product.status === "published"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700",
                    )}
                  >
                    {product.status}
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-lg">{product.name}</h3>
                    {product.category && (
                      <span className="px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded text-[10px] font-medium whitespace-nowrap ml-2">
                        {product.category}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500 line-clamp-2 mt-1">
                    {product.description}
                  </p>
                  <div className="mt-auto pt-4 flex justify-between items-center border-t border-zinc-100">
                    <div className="flex items-center gap-1 text-zinc-900 font-mono font-bold">
                      <span className="text-xs text-zinc-400">CNY</span>
                      {product.factory_price_cny.toFixed(2)}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-[10px] text-zinc-400 uppercase font-bold mr-2">
                        ID: #{product.id}
                      </div>
                      {confirmDeleteId === product.id ? (
                        <div className="flex gap-1">
                          <Button
                            onClick={() => setConfirmDeleteId(null)}
                            variant="outline"
                            className="text-[10px] px-2 py-1 h-auto"
                            disabled={deletingProductId === product.id}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => handleDelete(product.id)}
                            variant="danger"
                            className="text-[10px] px-2 py-1 h-auto"
                            loading={deletingProductId === product.id}
                          >
                            Confirm
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setConfirmDeleteId(product.id);
                          }}
                          className="p-2 text-zinc-400 hover:text-red-600 transition-colors rounded-md hover:bg-red-50"
                          title="Delete Product"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {!isLoading && !error && activeTab === "orders" && (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0 sm:justify-end">
            <Button
              onClick={() => downloadOrders("daily")}
              variant="outline"
              className="text-xs flex-shrink-0"
              loading={downloadingOrders === "daily"}
              disabled={!!downloadingOrders && downloadingOrders !== "daily"}
            >
              <Download size={14} /> Daily Report
            </Button>
            <Button
              onClick={() => downloadOrders("weekly")}
              variant="outline"
              className="text-xs flex-shrink-0"
              loading={downloadingOrders === "weekly"}
              disabled={!!downloadingOrders && downloadingOrders !== "weekly"}
            >
              <Download size={14} /> Weekly Report
            </Button>
            <Button
              onClick={() => downloadOrders("monthly")}
              variant="outline"
              className="text-xs flex-shrink-0"
              loading={downloadingOrders === "monthly"}
              disabled={!!downloadingOrders && downloadingOrders !== "monthly"}
            >
              <Download size={14} /> Monthly Report
            </Button>
          </div>
          <div className="space-y-3 md:hidden">
            {orders.map((order) => {
              const isNew = !seenOrderIds.includes(order.id);
              const isReorder =
                order.status === "pending" &&
                seenOrderStatuses[order.id] &&
                seenOrderStatuses[order.id] !== "pending";
              const isUnseen = isNew || isReorder;

              return (
                <Card
                  key={order.id}
                  className={cn("p-4", isUnseen && "bg-blue-50")}
                  onClick={() => {
                    setSelectedOrder(order);
                    markAsSeen("order", order.id, order.status);
                  }}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {order.product_photo && (
                          <img
                            src={order.product_photo}
                            alt={order.product_name}
                            className="w-10 h-10 object-cover rounded-md border border-zinc-200 flex-shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-mono text-xs text-zinc-500">
                            #{order.id}
                          </p>
                          <p className="font-medium truncate">
                            {order.product_name}
                          </p>
                        </div>
                      </div>
                      <p className="font-mono text-sm">Qty {order.quantity}</p>
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
                      <div
                        className="flex flex-wrap justify-end gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {order.status === "pending" && (
                          <>
                            <Button
                              onClick={() =>
                                updateOrderStatus(order.id, "accepted")
                              }
                              variant="primary"
                              className="px-2 py-1 text-[10px] h-auto"
                              loading={updatingOrderId === order.id}
                            >
                              Accept
                            </Button>
                            <Button
                              onClick={() => setRejectOrderId(order.id)}
                              variant="outline"
                              className="px-2 py-1 text-[10px] h-auto"
                              disabled={updatingOrderId === order.id}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {order.status === "accepted" && (
                          <Button
                            onClick={() =>
                              updateOrderStatus(order.id, "fulfilled")
                            }
                            variant="secondary"
                            className="px-2 py-1 text-[10px] h-auto"
                            loading={updatingOrderId === order.id}
                          >
                            Mark Fulfilled
                          </Button>
                        )}
                      </div>
                    </div>
                    {order.status === "rejected" && order.rejection_reason && (
                      <p className="text-[10px] text-red-600 italic">
                        Reason: {order.rejection_reason}
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          <Card className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left p-4 text-xs font-bold uppercase text-zinc-400">
                    Order ID
                  </th>
                  <th className="text-left p-4 text-xs font-bold uppercase text-zinc-400">
                    Product
                  </th>
                  <th className="text-left p-4 text-xs font-bold uppercase text-zinc-400">
                    Qty
                  </th>
                  <th className="text-left p-4 text-xs font-bold uppercase text-zinc-400">
                    Status
                  </th>
                  <th className="text-right p-4 text-xs font-bold uppercase text-zinc-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {orders.map((order) => {
                  const isNew = !seenOrderIds.includes(order.id);
                  const isReorder =
                    order.status === "pending" &&
                    seenOrderStatuses[order.id] &&
                    seenOrderStatuses[order.id] !== "pending";
                  const isUnseen = isNew || isReorder;

                  return (
                    <tr
                      key={order.id}
                      className={cn(
                        "hover:bg-zinc-50/50 transition-colors cursor-pointer",
                        isUnseen && "bg-blue-50",
                      )}
                      onClick={() => {
                        setSelectedOrder(order);
                        markAsSeen("order", order.id, order.status);
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
                      <td className="p-4 font-mono">{order.quantity}</td>
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
                      <td
                        className="p-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-2">
                          {order.status === "pending" && (
                            <>
                              <Button
                                onClick={() =>
                                  updateOrderStatus(order.id, "accepted")
                                }
                                variant="primary"
                                className="px-2 py-1 text-[10px] h-auto"
                                loading={updatingOrderId === order.id}
                              >
                                Accept
                              </Button>
                              <Button
                                onClick={() => setRejectOrderId(order.id)}
                                variant="outline"
                                className="px-2 py-1 text-[10px] h-auto"
                                disabled={updatingOrderId === order.id}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {order.status === "accepted" && (
                            <Button
                              onClick={() =>
                                updateOrderStatus(order.id, "fulfilled")
                              }
                              variant="secondary"
                              className="px-2 py-1 text-[10px] h-auto"
                              loading={updatingOrderId === order.id}
                            >
                              Mark Fulfilled
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Rejection Modal */}
      <AnimatePresence>
        {rejectOrderId && (
          <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl p-5 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-lg font-bold mb-4">
                Reject Order #{rejectOrderId}
              </h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700">
                    Reason for Rejection
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg h-24 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                    placeholder="Please provide a reason..."
                    required
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRejectOrderId(null);
                      setRejectionReason("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button variant="danger" onClick={handleRejectSubmit}>
                    Confirm Rejection
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {!isLoading && !error && activeTab === "custom-orders" && (
        <div className="space-y-4">
          {customOrders.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-zinc-200">
              <ImageIcon className="mx-auto text-zinc-300 mb-4" size={48} />
              <p className="text-zinc-500">No custom orders available.</p>
            </div>
          ) : (
            customOrders.map((order) => (
              <Card
                key={order.id}
                className={cn(
                  "p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50/50 transition-colors",
                  !seenCustomOrderIds.includes(order.id) && "bg-blue-50/30",
                )}
                onClick={() => {
                  setSelectedCustomOrder(order);
                  markAsSeen("custom-order", order.id);
                }}
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-16 h-16 bg-zinc-100 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={order.photo}
                      alt="Custom Order"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold">Custom Order #{order.id}</h4>
                    <p className="text-xs text-zinc-500 truncate">
                      Buyer: {order.buyer_company || order.buyer_email} •{" "}
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
                      {selectedCustomOrder.status === "found"
                        ? "fulfilled"
                        : selectedCustomOrder.status}
                    </span>
                  </div>

                  {(selectedCustomOrder.status === "pending" ||
                    selectedCustomOrder.status === "sourcing") && (
                    <div className="pt-4 border-t border-zinc-100 flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={async () => {
                          await fetch(
                            `/api/custom-orders/${selectedCustomOrder.id}`,
                            {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ status: "rejected" }),
                            },
                          );
                          setSelectedCustomOrder(null);
                          fetchData();
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => setShowProposalModal(true)}
                      >
                        Yes we have!
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Proposal Modal */}
      <AnimatePresence>
        {showProposalModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto"
            onClick={() => setShowProposalModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl p-5 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-xl font-bold mb-4">Submit Proposal</h3>
              <form onSubmit={handleProposalSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700">
                    Product Photo
                  </label>
                  <div className="border-2 border-dashed border-zinc-300 rounded-xl p-4 text-center hover:border-zinc-400 transition-colors">
                    {proposalPhotoBase64 ? (
                      <div className="relative group">
                        <img
                          src={proposalPhotoBase64}
                          className="h-48 w-full object-contain rounded-lg"
                          alt="Preview"
                        />
                        <button
                          type="button"
                          onClick={() => setProposalPhotoBase64("")}
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
                        <p className="text-sm text-zinc-500">Click to upload</p>
                        <input
                          type="file"
                          className="hidden"
                          id="proposal-photo-upload"
                          accept="image/*"
                          onChange={handleProposalFileChange}
                          required
                        />
                        <label
                          htmlFor="proposal-photo-upload"
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
                    Description
                  </label>
                  <textarea
                    value={proposalDescription}
                    onChange={(e) => setProposalDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg h-24 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700">
                    Price (CNY)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={proposalPrice}
                    onChange={(e) => setProposalPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowProposalModal(false)}
                    disabled={submittingProposal}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" loading={submittingProposal}>
                    Submit Proposal
                  </Button>
                </div>
              </form>
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
                      <div className="text-sm">
                        <span className="text-zinc-500">Factory Price:</span>
                        <span className="ml-2 font-mono font-bold">
                          CNY {selectedProduct.factory_price_cny.toFixed(2)}
                        </span>
                      </div>
                    </div>
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
