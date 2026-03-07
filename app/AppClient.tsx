"use client";

import React, { useState, useEffect } from "react";
import {
  Package,
  Plus,
  ShoppingCart,
  Settings as SettingsIcon,
  LogOut,
  CheckCircle,
  Clock,
  Image as ImageIcon,
  DollarSign,
  TrendingUp,
  FileText,
  User,
  ArrowRight,
  Globe,
  Factory,
  Edit,
  Trash2,
  FileSpreadsheet,
  Download,
  Upload,
  Bell,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "motion/react";
import { useForm } from "react-hook-form";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { User as UserType, Product, Order, Settings, UserRole } from "./types";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Card = ({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  key?: React.Key;
  onClick?: (e: React.MouseEvent) => void;
}) => (
  <div
    className={cn(
      "bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden",
      className,
    )}
    onClick={onClick}
  >
    {children}
  </div>
);

const Button = ({
  children,
  onClick,
  variant = "primary",
  className,
  type = "button",
  disabled = false,
  title,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: "primary" | "secondary" | "outline" | "danger";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
}) => {
  const variants = {
    primary:
      "bg-zinc-900 text-white border-2 border-zinc-900 shadow-[4px_4px_0px_0px_rgba(24,24,27,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(24,24,27,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
    secondary:
      "bg-emerald-600 text-white border-2 border-emerald-800 shadow-[4px_4px_0px_0px_rgba(6,95,70,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(6,95,70,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
    outline:
      "bg-white border-2 border-zinc-900 text-zinc-900 shadow-[4px_4px_0px_0px_rgba(24,24,27,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(24,24,27,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
    danger:
      "bg-red-600 text-white border-2 border-red-800 shadow-[4px_4px_0px_0px_rgba(153,27,27,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(153,27,27,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "px-4 py-2 rounded-lg font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 flex items-center justify-center gap-2",
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
};

const Input = ({ label, ...props }: any) => (
  <div className="space-y-1">
    {label && (
      <label className="text-sm font-medium text-zinc-700">{label}</label>
    )}
    <input
      {...props}
      className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
    />
  </div>
);

const NotificationBell = ({
  userId,
  userRole,
  hasNewOrders,
  hasNewCustomOrders,
}: {
  userId: number;
  userRole?: string;
  hasNewOrders?: (orders: Order[]) => boolean;
  hasNewCustomOrders?: (
    customOrders: import("./types").CustomOrder[],
    proposals?: import("./types").CustomOrderProposal[],
  ) => boolean;
}) => {
  const [notifications, setNotifications] = useState<
    import("./types").Notification[]
  >([]);
  const [isOpen, setIsOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customOrders, setCustomOrders] = useState<
    import("./types").CustomOrder[]
  >([]);
  const [proposals, setProposals] = useState<
    import("./types").CustomOrderProposal[]
  >([]);

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
    fetchNotifications();
    fetchOrders();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchOrders();
    }, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [userId, userRole]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const hasNewItems =
    (hasNewOrders && hasNewOrders(orders)) ||
    (hasNewCustomOrders && hasNewCustomOrders(customOrders, proposals));

  const handleMarkAsRead = async (n: import("./types").Notification) => {
    await fetch(`/api/notifications/${n.id}/read`, { method: "PATCH" });
    fetchNotifications();

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
    await fetch("/api/notifications/read-all", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    fetchNotifications();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-zinc-500 hover:text-zinc-900 transition-colors relative"
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
            className="absolute right-0 mt-2 w-80 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 overflow-hidden"
          >
            <div className="p-3 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
              <h3 className="font-bold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-[10px] text-zinc-500 hover:text-zinc-900 font-medium"
                >
                  Mark all as read
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
                    )}
                    onClick={() => handleMarkAsRead(n)}
                  >
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
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Views ---

const Login = ({ onLogin }: { onLogin: (user: UserType) => void }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [role, setRole] = useState<UserRole>("buyer");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [wechatId, setWechatId] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/login";
      const body = isSignup
        ? {
            email,
            role,
            company_name: companyName,
            wechat_id: wechatId,
            mobile_number: mobileNumber,
            whatsapp_number: whatsappNumber,
          }
        : { email };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const user = await res.json();
        onLogin(user);
      } else {
        const data = await res.json();
        setError(data.error || (isSignup ? "Signup failed" : "Invalid email"));
      }
    } catch (err) {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-900 text-white rounded-2xl mb-4">
            <Globe size={32} />
          </div>
          <h1 className="text-3xl font-serif font-bold">LuminaBridge</h1>
          <p className="text-zinc-500 mt-2 italic">
            {role === "factory"
              ? "Factory Portal"
              : "Connecting Lighting Factories to Global Markets"}
          </p>
        </div>

        <Card className="p-8">
          <div className="flex bg-zinc-100 p-1 rounded-lg mb-6">
            <button
              onClick={() => setIsSignup(false)}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                !isSignup
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700",
              )}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsSignup(true)}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                isSignup
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700",
              )}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div className="space-y-4 mb-4">
                <Input
                  label="Company Name"
                  placeholder="Your company name"
                  value={companyName}
                  onChange={(e: any) => setCompanyName(e.target.value)}
                  required
                />
              </div>
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e: any) => setEmail(e.target.value)}
              required
            />

            {isSignup && role === "factory" && (
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="WeChat ID"
                  placeholder="ID"
                  value={wechatId}
                  onChange={(e: any) => setWechatId(e.target.value)}
                  required
                />
                <Input
                  label="Mobile Number"
                  placeholder="Number"
                  value={mobileNumber}
                  onChange={(e: any) => setMobileNumber(e.target.value)}
                  required
                />
              </div>
            )}

            {isSignup && role === "buyer" && (
              <Input
                label="WhatsApp Number"
                placeholder="Include country code"
                value={whatsappNumber}
                onChange={(e: any) => setWhatsappNumber(e.target.value)}
                required
              />
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? isSignup
                  ? "Creating account..."
                  : "Signing in..."
                : isSignup
                  ? "Create Account"
                  : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-zinc-100 text-center">
            <button
              onClick={() => {
                setRole(role === "buyer" ? "factory" : "buyer");
                setIsSignup(false);
                setError("");
              }}
              className="text-sm text-zinc-500 hover:text-zinc-900 underline"
            >
              {role === "buyer"
                ? "Are you a factory? Go to Factory Portal"
                : "Are you a buyer? Go to Buyer Portal"}
            </button>
          </div>

          {!isSignup && (
            <div className="mt-6 pt-6 border-t border-zinc-100">
              <p className="text-xs text-zinc-400 text-center uppercase tracking-widest font-bold">
                Demo Accounts
              </p>
              <div className="grid grid-cols-1 gap-2 mt-4">
                <button
                  onClick={() => setEmail("admin@lumina.com")}
                  className="text-xs text-zinc-600 hover:text-zinc-900 text-left px-2 py-1 rounded hover:bg-zinc-50 transition-colors"
                >
                  Admin: admin@lumina.com
                </button>
                <button
                  onClick={() => {
                    setEmail("factory@china.com");
                    setRole("factory");
                  }}
                  className="text-xs text-zinc-600 hover:text-zinc-900 text-left px-2 py-1 rounded hover:bg-zinc-50 transition-colors"
                >
                  Factory: factory@china.com
                </button>
                <button
                  onClick={() => {
                    setEmail("buyer@india.com");
                    setRole("buyer");
                  }}
                  className="text-xs text-zinc-600 hover:text-zinc-900 text-left px-2 py-1 rounded hover:bg-zinc-50 transition-colors"
                >
                  Buyer: buyer@india.com
                </button>
              </div>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

const FactoryDashboard = ({
  user,
  seenOrderIds,
  seenCustomOrderIds,
  seenOrderStatuses,
  markAsSeen,
  hasNewOrders,
  hasNewCustomOrders,
}: {
  user: UserType;
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
    customOrders: import("./types").CustomOrder[],
    proposals?: import("./types").CustomOrderProposal[],
  ) => boolean;
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customOrders, setCustomOrders] = useState<
    import("./types").CustomOrder[]
  >([]);
  const [activeTab, setActiveTab] = useState<
    "products" | "orders" | "custom-orders"
  >("products");
  const [showUpload, setShowUpload] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [rejectOrderId, setRejectOrderId] = useState<number | null>(null);
  const [selectedCustomOrder, setSelectedCustomOrder] = useState<
    import("./types").CustomOrder | null
  >(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const { register, handleSubmit, reset, setValue } = useForm();
  const [photoBase64, setPhotoBase64] = useState("");
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalPhotoBase64, setProposalPhotoBase64] = useState("");
  const [proposalDescription, setProposalDescription] = useState("");
  const [proposalPrice, setProposalPrice] = useState("");

  const fetchData = async () => {
    const [pRes, oRes, coRes] = await Promise.all([
      fetch(`/api/products?role=factory&userId=${user.id}`),
      fetch(`/api/orders?role=factory&userId=${user.id}`),
      fetch(`/api/custom-orders?role=factory`),
    ]);
    setProducts(await pRes.json());
    setOrders(await oRes.json());
    setCustomOrders(await coRes.json());
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleProposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomOrder) return;

    try {
      await fetch(`/api/custom-orders/${selectedCustomOrder.id}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factory_id: user.id,
          photo: proposalPhotoBase64,
          description: proposalDescription,
          price_cny: parseFloat(proposalPrice),
        }),
      });

      setShowProposalModal(false);
      setSelectedCustomOrder(null);
      setProposalPhotoBase64("");
      setProposalDescription("");
      setProposalPrice("");
      showToast("Proposal submitted successfully!");
      fetchData();
    } catch (err) {
      showToast("Failed to submit proposal");
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
    const handleNavigate = async (e: any) => {
      if (e.detail.tab === "orders") setActiveTab("orders");
      if (e.detail.tab === "products") setActiveTab("products");
      if (e.detail.tab === "custom-orders") {
        setActiveTab("custom-orders");
        if (e.detail.id) {
          try {
            const res = await fetch("/api/custom-orders?role=factory");
            const data = await res.json();
            setCustomOrders(data);
            const order = data.find((o: any) => o.id === e.detail.id);
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
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, rejection_reason: reason }),
    });
    fetchData();
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
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        // Map Excel columns to our product fields
        // Expected columns: Name, Description, Specifications, Price (CNY), Photo URL, Category
        const productsToUpload = data
          .map((row) => ({
            name: row["Name"] || row["name"],
            description: row["Description"] || row["description"],
            specifications: row["Specifications"] || row["specifications"],
            factory_price_cny: parseFloat(
              row["Price (CNY)"] || row["price"] || 0,
            ),
            photo: row["Photo URL"] || row["photo_url"] || "",
            category: row["Category"] || row["category"] || "Other",
            factory_id: user.id,
          }))
          .filter((p) => p.name);

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

  const downloadTemplate = () => {
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
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "LuminaBridge_Product_Template.xlsx");
  };

  const onSubmit = async (data: any) => {
    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        photo: photoBase64,
        factory_id: user.id,
        factory_price_cny: parseFloat(data.factory_price_cny),
      }),
    });
    reset();
    setPhotoBase64("");
    setShowUpload(false);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (res.ok) {
        setConfirmDeleteId(null);
        fetchData();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to delete product");
      }
    } catch (err) {
      showToast("Network error while deleting product");
    }
  };

  const downloadOrders = (timeframe: "daily" | "weekly" | "monthly") => {
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
      return;
    }

    try {
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
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 relative">
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 font-medium"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-serif font-bold">Factory Portal</h2>
          <p className="text-zinc-500">
            Manage your product catalog and submissions
          </p>
        </div>
        <div className="flex bg-zinc-100 p-1 rounded-lg mr-4">
          {(["products", "orders", "custom-orders"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize relative",
                activeTab === tab
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700",
              )}
            >
              {tab.replace("-", " ")}
              {tab === "orders" && hasNewOrders(orders) && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
              {tab === "custom-orders" && hasNewCustomOrders(customOrders) && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <Button
            onClick={downloadTemplate}
            variant="outline"
            className="text-xs"
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

      {activeTab === "products" && (
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
                      <Button type="submit" className="w-full">
                        Submit for Review
                      </Button>
                    </div>
                  </form>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 text-[10px] font-bold bg-zinc-100 text-zinc-600 rounded hover:bg-zinc-200"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="px-2 py-1 text-[10px] font-bold bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Confirm
                          </button>
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

      {activeTab === "orders" && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => downloadOrders("daily")}
              variant="outline"
              className="text-xs"
            >
              <Download size={14} /> Daily Report
            </Button>
            <Button
              onClick={() => downloadOrders("weekly")}
              variant="outline"
              className="text-xs"
            >
              <Download size={14} /> Weekly Report
            </Button>
            <Button
              onClick={() => downloadOrders("monthly")}
              variant="outline"
              className="text-xs"
            >
              <Download size={14} /> Monthly Report
            </Button>
          </div>
          <Card className="overflow-hidden">
            <table className="w-full">
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
                              >
                                Accept
                              </Button>
                              <Button
                                onClick={() => setRejectOrderId(order.id)}
                                variant="outline"
                                className="px-2 py-1 text-[10px] h-auto"
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md"
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

      {activeTab === "custom-orders" && (
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
                      Buyer: {order.buyer_company || order.buyer_email} •{" "}
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                    <p className="text-sm text-zinc-700 mt-1 line-clamp-2">
                      {order.requirements}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedCustomOrder(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowProposalModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg"
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
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Submit Proposal</Button>
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedOrder(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
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
                <div className="grid grid-cols-2 gap-4">
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
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

const AdminDashboard = ({
  seenOrderIds,
  seenCustomOrderIds,
  markAsSeen,
  hasNewOrders,
  hasNewCustomOrders,
}: {
  seenOrderIds: number[];
  seenCustomOrderIds: number[];
  markAsSeen: (
    type: "order" | "custom-order" | "proposal" | "order-status",
    id: number,
    status?: string,
  ) => void;
  hasNewOrders: (orders: Order[]) => boolean;
  hasNewCustomOrders: (
    customOrders: import("./types").CustomOrder[],
    proposals?: import("./types").CustomOrderProposal[],
  ) => boolean;
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  console.log("AdminDashboard rendering, products count:", products.length);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customOrders, setCustomOrders] = useState<
    import("./types").CustomOrder[]
  >([]);
  const [settings, setSettings] = useState<Settings>({
    exchange_rate: "12.0",
    admin_markup: "1.2",
  });
  const [activeTab, setActiveTab] = useState<
    "products" | "orders" | "custom-orders" | "settings"
  >("products");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedCustomOrder, setSelectedCustomOrder] = useState<
    import("./types").CustomOrder | null
  >(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [proposals, setProposals] = useState<
    import("./types").CustomOrderProposal[]
  >([]);
  const [publishingProposalId, setPublishingProposalId] = useState<
    number | null
  >(null);
  const [publishingPrice, setPublishingPrice] = useState<string>("");
  const { register, handleSubmit, reset, setValue } = useForm();

  const fetchData = async () => {
    const [pRes, oRes, sRes, coRes] = await Promise.all([
      fetch("/api/products?role=admin"),
      fetch("/api/orders?role=admin"),
      fetch("/api/settings"),
      fetch("/api/custom-orders?role=admin"),
    ]);
    setProducts(await pRes.json());
    setOrders(await oRes.json());
    setSettings(await sRes.json());
    setCustomOrders(await coRes.json());
  };

  useEffect(() => {
    fetchData();
  }, []);

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
    const handleNavigate = async (e: any) => {
      if (e.detail.tab === "orders") setActiveTab("orders");
      if (e.detail.tab === "products") setActiveTab("products");
      if (e.detail.tab === "custom-orders") {
        setActiveTab("custom-orders");
        if (e.detail.id) {
          try {
            const res = await fetch("/api/custom-orders?role=admin");
            const data = await res.json();
            setCustomOrders(data);
            const order = data.find((o: any) => o.id === e.detail.id);
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
    await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyer_price_inr: inrPrice,
        status: "published",
      }),
    });
    fetchData();
  };

  const handleUnpublish = async (id: number) => {
    await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "pending",
        buyer_price_inr: null,
      }),
    });
    fetchData();
  };

  const onEditSubmit = async (data: any) => {
    if (!editingProduct) return;
    await fetch(`/api/products/${editingProduct.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        factory_price_cny: parseFloat(data.factory_price_cny),
      }),
    });
    setEditingProduct(null);
    fetchData();
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

  const saveSettings = async () => {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    showToast("Settings saved");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 relative">
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 font-medium"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-serif font-bold">Admin Control Panel</h2>
          <p className="text-zinc-500">
            Manage global settings, products, and orders
          </p>
        </div>
        <div className="flex bg-zinc-100 p-1 rounded-lg">
          {(["products", "orders", "custom-orders", "settings"] as const).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize relative",
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

      {activeTab === "products" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {products.map((product) => (
              <Card
                key={product.id}
                className="p-4 flex items-center gap-6 cursor-pointer hover:bg-zinc-50 transition-colors"
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
                  <div className="mt-1 flex gap-3 items-center">
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
                  <div className="flex gap-4 mt-2">
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
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-2">
                    <div className="text-right text-[10px] text-zinc-400 font-mono mb-1">
                      EST. INR:{" "}
                      {(
                        product.factory_price_cny *
                        parseFloat(settings.exchange_rate) *
                        parseFloat(settings.admin_markup)
                      ).toFixed(2)}
                    </div>
                    <div className="flex gap-2">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
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
                  <div className="flex gap-4 pt-4">
                    <Button
                      onClick={() => setEditingProduct(null)}
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1">
                      Save Changes
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {activeTab === "orders" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
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
                      <span className="font-medium">{order.product_name}</span>
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
      )}

      {activeTab === "custom-orders" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
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
                        await fetch(`/api/custom-orders/${order.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: e.target.value }),
                        });
                        fetchData();
                      }}
                      className="text-xs border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:border-zinc-500"
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
      )}

      {/* Custom Order Details Modal */}
      <AnimatePresence>
        {selectedCustomOrder && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedCustomOrder(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
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
                                            onChange={(e: any) =>
                                              setPublishingPrice(e.target.value)
                                            }
                                          />
                                        </div>
                                        <Button
                                          className="h-9"
                                          onClick={async () => {
                                            await fetch(
                                              `/api/custom-order-proposals/${proposal.id}`,
                                              {
                                                method: "PATCH",
                                                headers: {
                                                  "Content-Type":
                                                    "application/json",
                                                },
                                                body: JSON.stringify({
                                                  status: "published",
                                                  price_inr:
                                                    parseFloat(publishingPrice),
                                                }),
                                              },
                                            );
                                            setPublishingProposalId(null);
                                            // Refresh proposals
                                            fetch(
                                              `/api/custom-orders/${selectedCustomOrder.id}/proposals?role=admin`,
                                            )
                                              .then((res) => res.json())
                                              .then(setProposals);
                                            showToast(
                                              "Proposal published to buyer",
                                            );
                                          }}
                                        >
                                          Confirm
                                        </Button>
                                        <Button
                                          variant="outline"
                                          className="h-9"
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedOrder(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
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
                <div className="grid grid-cols-2 gap-4">
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
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

      {activeTab === "settings" && (
        <Card className="p-8 max-w-2xl mx-auto">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <SettingsIcon size={20} /> Pricing Algorithm
          </h3>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <Input
                label="Exchange Rate (1 CNY to INR)"
                type="number"
                step="0.01"
                value={settings.exchange_rate}
                onChange={(e: any) =>
                  setSettings({ ...settings, exchange_rate: e.target.value })
                }
              />
              <Input
                label="Admin Markup (Multiplier)"
                type="number"
                step="0.01"
                value={settings.admin_markup}
                onChange={(e: any) =>
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
            <Button onClick={saveSettings} className="w-full">
              Save Global Settings
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

const BuyerDashboard = ({
  user,
  seenOrderIds,
  seenCustomOrderIds,
  markAsSeen,
  hasNewOrders,
  hasNewCustomOrders,
}: {
  user: UserType;
  seenOrderIds: number[];
  seenCustomOrderIds: number[];
  markAsSeen: (
    type: "order" | "custom-order" | "proposal" | "order-status",
    id: number,
    status?: string,
  ) => void;
  hasNewOrders: (orders: Order[]) => boolean;
  hasNewCustomOrders: (
    customOrders: import("./types").CustomOrder[],
    proposals?: import("./types").CustomOrderProposal[],
  ) => boolean;
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customOrders, setCustomOrders] = useState<
    import("./types").CustomOrder[]
  >([]);
  const [proposals, setProposals] = useState<
    import("./types").CustomOrderProposal[]
  >([]);
  const [allProposals, setAllProposals] = useState<
    import("./types").CustomOrderProposal[]
  >([]);
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

  const [showCustomOrderModal, setShowCustomOrderModal] = useState(false);
  const [selectedCustomOrder, setSelectedCustomOrder] = useState<
    import("./types").CustomOrder | null
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

  const fetchData = async () => {
    const [pRes, oRes, coRes, apRes] = await Promise.all([
      fetch("/api/products?role=buyer"),
      fetch(`/api/orders?role=buyer&userId=${user.id}`),
      fetch(`/api/custom-orders?role=buyer&userId=${user.id}`),
      fetch(`/api/custom-order-proposals?role=buyer&userId=${user.id}`),
    ]);
    setProducts(await pRes.json());
    setOrders(await oRes.json());
    setCustomOrders(await coRes.json());
    if (apRes.ok) setAllProposals(await apRes.json());
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedCustomOrder) {
      fetch(`/api/custom-orders/${selectedCustomOrder.id}/proposals?role=buyer`)
        .then((res) => res.json())
        .then((data) => {
          setProposals(data);
          data.forEach((p: any) => markAsSeen("proposal", p.id));
        });
    } else {
      setProposals([]);
    }
  }, [selectedCustomOrder]);

  useEffect(() => {
    const handleNavigate = async (e: any) => {
      if (e.detail.tab === "orders") setActiveTab("my-orders");
      if (e.detail.tab === "products") setActiveTab("catalog");
      if (e.detail.tab === "custom-orders") {
        setActiveTab("custom-orders");
        if (e.detail.id) {
          try {
            const res = await fetch(
              `/api/custom-orders?role=buyer&userId=${user.id}`,
            );
            const data = await res.json();
            setCustomOrders(data);
            const order = data.find((o: any) => o.id === e.detail.id);
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
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: selectedProduct.id,
        buyer_id: user.id,
        quantity,
      }),
    });
    setSelectedProduct(null);
    setViewingProduct(null);
    setQuantity(1);
    fetchData();
    setActiveTab("my-orders");
  };

  const updateOrderQuantity = async () => {
    if (!editingOrder) return;
    await fetch(`/api/orders/${editingOrder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    setEditingOrder(null);
    setQuantity(1);
    fetchData();
  };

  const cancelOrder = async (orderId: number) => {
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    setConfirmCancelOrderId(null);
    fetchData();
  };

  const handleReorder = async (order: Order) => {
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending", rejection_reason: null }),
    });
    fetchData();
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const submitCustomOrder = async () => {
    if (!customPhotoBase64 || !customRequirements.trim()) {
      showToast("Please provide both a photo and requirements.");
      return;
    }
    const res = await fetch("/api/custom-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyer_id: user.id,
        photo: customPhotoBase64,
        requirements: customRequirements,
      }),
    });
    const newOrder = await res.json();
    if (newOrder && newOrder.id) {
      markAsSeen("custom-order", newOrder.id);
    }
    setShowCustomOrderModal(false);
    setCustomPhotoBase64("");
    setCustomRequirements("");
    fetchData();
    setActiveTab("custom-orders");
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
    <div className="p-6 max-w-7xl mx-auto space-y-8 relative">
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 font-medium"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-serif font-bold">Buyer Portal</h2>
          <p className="text-zinc-500">
            Browse latest lighting collections and place pre-orders
          </p>
        </div>
        <div className="flex bg-zinc-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("catalog")}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-all relative",
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
              "px-4 py-1.5 rounded-md text-sm font-medium transition-all relative",
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
              "px-4 py-1.5 rounded-md text-sm font-medium transition-all relative",
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

      {activeTab === "catalog" && (
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

      {activeTab === "my-orders" && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-zinc-200">
              <ShoppingCart className="mx-auto text-zinc-300 mb-4" size={48} />
              <p className="text-zinc-500">
                You haven't placed any orders yet.
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
                  <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
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
                                >
                                  Yes
                                </Button>
                                <Button
                                  onClick={() => setConfirmCancelOrderId(null)}
                                  variant="outline"
                                  className="text-[10px] px-2 py-1 h-auto"
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

      {activeTab === "custom-orders" && (
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
                  You haven't placed any custom orders yet.
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
                  <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedCustomOrder(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
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
                                      // Mark proposal as accepted
                                      await fetch(
                                        `/api/custom-order-proposals/${proposal.id}`,
                                        {
                                          method: "PATCH",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            status: "accepted",
                                          }),
                                        },
                                      );
                                      // Mark order as found
                                      await fetch(
                                        `/api/custom-orders/${selectedCustomOrder.id}`,
                                        {
                                          method: "PATCH",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            status: "found",
                                          }),
                                        },
                                      );
                                      setSelectedCustomOrder(null);
                                      fetchData();
                                      showToast("Order confirmed!");
                                    }}
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
                            await fetch(
                              `/api/custom-orders/${selectedCustomOrder.id}`,
                              {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ status: "found" }),
                              },
                            );
                            setSelectedCustomOrder(null);
                            fetchData();
                            showToast("Requirement marked as fulfilled");
                          }}
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedOrder(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
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
                <div className="grid grid-cols-2 gap-4">
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden p-6"
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
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={submitCustomOrder}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="h-48 bg-zinc-100">
                <img
                  src={selectedProduct.photo}
                  className="w-full h-full object-cover"
                  alt=""
                />
              </div>
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-2">
                  {selectedProduct.name}
                </h3>
                <p className="text-zinc-500 text-sm mb-6">
                  {selectedProduct.description}
                </p>

                <div className="space-y-6">
                  <div className="flex justify-between items-center p-4 bg-zinc-50 rounded-xl">
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
                    <div className="w-32">
                      <Input
                        label="Quantity"
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e: any) =>
                          setQuantity(parseInt(e.target.value))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-lg font-bold pt-4 border-t border-zinc-100">
                    <span>Total Estimated</span>
                    <span>
                      ₹
                      {(
                        (selectedProduct.buyer_price_inr || 0) * quantity
                      ).toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      onClick={() => setSelectedProduct(null)}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                    <Button onClick={placeOrder} variant="secondary">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
              className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
            >
              <div className="md:w-1/2 bg-zinc-100 min-h-[300px]">
                <img
                  src={viewingProduct.photo}
                  className="w-full h-full object-cover"
                  alt={viewingProduct.name}
                />
              </div>
              <div className="p-8 md:w-1/2 overflow-y-auto">
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

                  <div className="pt-6 border-t border-zinc-100 flex gap-4">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
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
                      onChange={(e: any) =>
                        setQuantity(parseInt(e.target.value))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      onClick={() => setEditingOrder(null)}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                    <Button onClick={updateOrderQuantity} variant="secondary">
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

export default function App() {
  const [user, setUser] = useState<UserType | null>(null);
  const [seenOrderIds, setSeenOrderIds] = useState<number[]>(() => {
    const saved = localStorage.getItem("seenOrderIds");
    return saved ? JSON.parse(saved) : [];
  });
  const [seenCustomOrderIds, setSeenCustomOrderIds] = useState<number[]>(() => {
    const saved = localStorage.getItem("seenCustomOrderIds");
    return saved ? JSON.parse(saved) : [];
  });
  const [seenProposalIds, setSeenProposalIds] = useState<number[]>(() => {
    const saved = localStorage.getItem("seenProposalIds");
    return saved ? JSON.parse(saved) : [];
  });
  const [seenOrderStatuses, setSeenOrderStatuses] = useState<
    Record<number, string>
  >(() => {
    const saved = localStorage.getItem("seenOrderStatuses");
    return saved ? JSON.parse(saved) : {};
  });

  const markAsSeen = (
    type: "order" | "custom-order" | "proposal" | "order-status",
    id: number,
    status?: string,
  ) => {
    if (type === "order") {
      if (!seenOrderIds.includes(id)) {
        const newSeen = [...seenOrderIds, id];
        setSeenOrderIds(newSeen);
        localStorage.setItem("seenOrderIds", JSON.stringify(newSeen));
      }
      if (status) {
        const newStatuses = { ...seenOrderStatuses, [id]: status };
        setSeenOrderStatuses(newStatuses);
        localStorage.setItem("seenOrderStatuses", JSON.stringify(newStatuses));
      }
    } else if (type === "custom-order") {
      if (!seenCustomOrderIds.includes(id)) {
        const newSeen = [...seenCustomOrderIds, id];
        setSeenCustomOrderIds(newSeen);
        localStorage.setItem("seenCustomOrderIds", JSON.stringify(newSeen));
      }
    } else if (type === "proposal") {
      if (!seenProposalIds.includes(id)) {
        const newSeen = [...seenProposalIds, id];
        setSeenProposalIds(newSeen);
        localStorage.setItem("seenProposalIds", JSON.stringify(newSeen));
      }
    } else if (type === "order-status" && status) {
      const newSeen = { ...seenOrderStatuses, [id]: status };
      setSeenOrderStatuses(newSeen);
      localStorage.setItem("seenOrderStatuses", JSON.stringify(newSeen));
    }
  };

  const hasNewOrders = (orders: Order[]) => {
    if (user?.role === "buyer") {
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
      )
        return true;
      return false;
    });
  };

  const hasNewCustomOrders = (
    customOrders: import("./types").CustomOrder[],
    proposals: import("./types").CustomOrderProposal[] = [],
  ) => {
    if (user?.role === "buyer") {
      return proposals.some((p) => !seenProposalIds.includes(p.id));
    }
    return customOrders.some((co) => !seenCustomOrderIds.includes(co.id));
  };

  useEffect(() => {
    const saved = localStorage.getItem("lumina_user");
    if (saved) setUser(JSON.parse(saved));
  }, []);

  const handleLogin = (u: UserType) => {
    setUser(u);
    localStorage.setItem("lumina_user", JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("lumina_user");
  };

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-zinc-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-900 text-white rounded-lg flex items-center justify-center">
              <Globe size={18} />
            </div>
            <span className="font-serif font-bold text-xl tracking-tight">
              LuminaBridge
            </span>
          </div>

          <div className="flex items-center gap-6">
            <NotificationBell
              userId={user.id}
              userRole={user.role}
              hasNewOrders={hasNewOrders}
              hasNewCustomOrders={hasNewCustomOrders}
            />
            <div className="flex items-center gap-3 px-3 py-1.5 bg-zinc-50 rounded-full border border-zinc-100">
              <div className="w-6 h-6 bg-zinc-200 rounded-full flex items-center justify-center text-zinc-500">
                <User size={14} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-zinc-400 leading-none">
                  {user.role}
                </span>
                <span className="text-xs font-medium text-zinc-700 leading-none mt-0.5">
                  {user.email}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-zinc-400 hover:text-red-600 transition-colors"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      <main>
        {user.role === "factory" && (
          <FactoryDashboard
            user={user}
            seenOrderIds={seenOrderIds}
            seenCustomOrderIds={seenCustomOrderIds}
            seenOrderStatuses={seenOrderStatuses}
            markAsSeen={markAsSeen}
            hasNewOrders={hasNewOrders}
            hasNewCustomOrders={hasNewCustomOrders}
          />
        )}
        {user.role === "admin" && (
          <AdminDashboard
            seenOrderIds={seenOrderIds}
            seenCustomOrderIds={seenCustomOrderIds}
            markAsSeen={markAsSeen}
            hasNewOrders={hasNewOrders}
            hasNewCustomOrders={hasNewCustomOrders}
          />
        )}
        {user.role === "buyer" && (
          <BuyerDashboard
            user={user}
            seenOrderIds={seenOrderIds}
            seenCustomOrderIds={seenCustomOrderIds}
            markAsSeen={markAsSeen}
            hasNewOrders={hasNewOrders}
            hasNewCustomOrders={hasNewCustomOrders}
          />
        )}
      </main>

      <footer className="py-12 border-t border-zinc-200 mt-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <Globe size={16} />
            <span className="font-serif font-bold text-sm">
              LuminaBridge Global
            </span>
          </div>
          <div className="flex gap-8 text-xs font-bold uppercase tracking-widest text-zinc-400">
            <a href="#" className="hover:text-zinc-900 transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-zinc-900 transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-zinc-900 transition-colors">
              Support
            </a>
          </div>
          <p className="text-xs text-zinc-400">
            © 2026 LuminaBridge B2B. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
