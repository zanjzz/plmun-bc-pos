import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Minus,
  Moon,
  Package,
  PackageCheck,
  Printer,
  Plus,
  RotateCcw,
  Save,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Sun,
  Trash2,
  UserPlus,
  Users,
  UserX,
  Pencil,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { type AuthUser, authProvider, readStoredSession, type Role } from "./auth";
import Login from "./Login";
import {
  type AppNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications";
import {
  completeWalkInSale,
  createOnlineOrder,
  getOrders,
  type OnlineOrder,
  type OrderStatus,
  updateOrderStatus,
} from "./orders";
import {
  createProduct,
  deleteProduct,
  fallbackProducts,
  getProducts,
  isPhysicalProduct,
  isServiceProduct,
  type Product,
  updateProduct,
} from "./products";
import { createUser, getUsers, type ManagedUser, removeUser, updateUser } from "./users";

type ProductStore = {
  products: Product[];
  loading: boolean;
  addProduct: (product: Omit<Product, "id">) => Promise<void>;
  editProduct: (id: number, updates: Partial<Product>) => Promise<void>;
  removeProduct: (id: number) => Promise<void>;
  refreshProducts: () => Promise<void>;
};

const ProductContext = createContext<ProductStore | null>(null);

function useProductStore() {
  const store = useContext(ProductContext);
  if (!store) throw new Error("Product store is unavailable.");
  return store;
}

function ProductDataProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState(fallbackProducts);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch((error) => console.error("Unable to load Supabase products:", error))
      .finally(() => setLoading(false));
  }, []);

  const store: ProductStore = {
    products,
    loading,
    addProduct: async (input) => {
      const product = await createProduct(input);
      setProducts((current) => [...current, product]);
    },
    editProduct: async (id, updates) => {
      const product = await updateProduct(id, updates);
      setProducts((current) => current.map((item) => (item.id === id ? product : item)));
    },
    removeProduct: async (id) => {
      await deleteProduct(id);
      setProducts((current) => current.filter((item) => item.id !== id));
    },
    refreshProducts: async () => {
      setProducts(await getProducts());
    },
  };

  return <ProductContext.Provider value={store}>{children}</ProductContext.Provider>;
}

const orders = [
  {
    id: "ORD-1042",
    date: "Mar 12, 2025",
    items: "2 items",
    total: "₱70.00",
    status: "Ready for pickup",
  },
  { id: "ORD-1038", date: "Mar 08, 2025", items: "4 items", total: "₱155.00", status: "Completed" },
  { id: "ORD-1029", date: "Feb 24, 2025", items: "1 item", total: "₱45.00", status: "Completed" },
  { id: "ORD-1017", date: "Feb 16, 2025", items: "3 items", total: "₱110.00", status: "Completed" },
];

const navByRole: Record<Role, string[]> = {
  student: ["Home", "Products", "Services", "My orders"],
  staff: ["Dashboard", "POS terminal", "Order management"],
  admin: [
    "Dashboard",
    "Product management",
    "Inventory management",
    "Sales reports",
    "Inventory reports",
    "Transaction history",
    "User management",
  ],
};

const navIcons: Record<string, LucideIcon> = {
  Home,
  Products: Package,
  Services: Printer,
  "My orders": ClipboardList,
  Dashboard: LayoutDashboard,
  "POS terminal": ScanLine,
  "Order management": ClipboardList,
  "Product management": Package,
  "Inventory management": Boxes,
  "Sales reports": BarChart3,
  "Inventory reports": FileText,
  "Transaction history": History,
  "User management": Users,
};

const peso = (value: number) => `₱${value.toFixed(2)}`;

type Theme = "light" | "dark";

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="theme-toggle grid size-11 place-items-center rounded-lg border border-[#d8ddd4] bg-white/70 text-[#486056] transition hover:-translate-y-0.5 hover:border-[#8da092]"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}

const notificationTime = (value: string) => {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(elapsed / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(value).toLocaleDateString();
};

function NotificationCenter({
  user,
  setPage,
}: {
  user: AuthUser;
  setPage: (page: string) => void;
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [urgent, setUrgent] = useState<AppNotification | null>(null);
  const [suppressUrgent, setSuppressUrgent] = useState(false);
  const urgentPreferenceKey = `plmun-hide-urgent-notifications-${user.id}`;

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await getNotifications();
        if (!active) return;
        setNotifications(result.notifications);
        setUnreadCount(result.unreadCount);
        setError("");
        const urgentPopupsDisabled = window.localStorage.getItem(urgentPreferenceKey) === "true";
        if (!urgentPopupsDisabled) {
          const nextUrgent = result.notifications.find(
            (notification) => !notification.readAt && notification.metadata.urgent === true,
          );
          setUrgent((current) => current ?? nextUrgent ?? null);
        }
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Notifications are unavailable.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    const refresh = () => void load();
    void load();
    const interval = window.setInterval(load, 30000);
    window.addEventListener("notifications:refresh", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("notifications:refresh", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [urgentPreferenceKey]);

  const readNotification = async (notification: AppNotification, navigate = true) => {
    if (!notification.readAt) {
      try {
        const updated = await markNotificationRead(notification.id);
        setNotifications((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        setUnreadCount((current) => Math.max(0, current - 1));
      } catch {
        return;
      }
    }
    setUrgent(null);
    setOpen(false);
    if (navigate && notification.actionPage) setPage(notification.actionPage);
  };

  const dismissUrgent = async () => {
    if (!urgent) return;
    if (suppressUrgent) {
      window.localStorage.setItem(urgentPreferenceKey, "true");
    }
    await readNotification(urgent, false);
    setSuppressUrgent(false);
  };

  const reviewUrgent = async () => {
    if (!urgent) return;
    if (suppressUrgent) {
      window.localStorage.setItem(urgentPreferenceKey, "true");
    }
    await readNotification(urgent);
    setSuppressUrgent(false);
  };

  const markAllRead = async () => {
    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, readAt: notification.readAt ?? readAt })),
      );
      setUnreadCount(0);
      setUrgent(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Notifications could not be updated.");
    }
  };

  const notificationIcon = (notification: AppNotification) => {
    if (notification.type === "inventory") return <Boxes size={16} className="icon-warning" />;
    if (notification.type === "transaction")
      return <ShoppingCart size={16} className="icon-info" />;
    if (notification.type === "order") return <PackageCheck size={16} className="icon-success" />;
    return <Bell size={16} className="icon-info" />;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="notification-trigger relative grid size-11 place-items-center rounded-lg border border-[#d8ddd4] bg-white text-[#40564b] transition hover:border-[#92a397] hover:bg-[#edf1ec]"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notification-count absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-[#a13f32] px-1 text-[9px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <>
            <button
              className="fixed inset-0 z-[90] cursor-default bg-black/10 backdrop-blur-[1px]"
              onClick={() => setOpen(false)}
              aria-label="Close notifications"
            />
            <section
              role="dialog"
              aria-label="Notifications"
              className="notification-panel fixed z-[100] flex max-h-[min(72dvh,620px)] w-[min(410px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-[#d8ded6] bg-white shadow-[0_24px_80px_rgba(18,43,31,.24)]"
            >
              <header className="flex items-center justify-between gap-4 border-b border-[#e1e5df] px-4 py-4">
                <div>
                  <h2 className="text-base font-semibold text-[#193f31]">Notifications</h2>
                  <p className="mt-0.5 text-[10px] text-[#68766e]">
                    {unreadCount ? `${unreadCount} unread` : "You’re all caught up"}
                  </p>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="min-h-10 rounded-lg px-3 text-[10px] font-bold text-[#285c43] hover:bg-[#eaf1eb]"
                  >
                    Mark all as read
                  </button>
                )}
              </header>
              <div className="overflow-y-auto">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => readNotification(notification)}
                    className={`notification-item flex min-h-24 w-full gap-3 border-b border-[#e7eae5] p-4 text-left transition ${
                      notification.readAt ? "bg-white" : "bg-[#f0f6ef]"
                    }`}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white shadow-sm">
                      {notificationIcon(notification)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-xs font-bold text-[#29473a]">
                          {notification.title}
                        </span>
                        {!notification.readAt && (
                          <span className="mt-1 size-2 shrink-0 rounded-full bg-[#2f7651]" />
                        )}
                      </span>
                      <span className="mt-1 block text-[11px] leading-5 text-[#5e6d64]">
                        {notification.message}
                      </span>
                      <span className="mt-1.5 block text-[10px] font-semibold text-[#78857d]">
                        {notificationTime(notification.createdAt)}
                      </span>
                    </span>
                  </button>
                ))}
                {!loading && !notifications.length && (
                  <div className="grid min-h-52 place-items-center p-8 text-center">
                    <div>
                      <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#edf2ec] text-[#64756c]">
                        <Bell size={20} />
                      </span>
                      <h3 className="mt-3 text-sm font-semibold text-[#334d40]">
                        No notifications yet
                      </h3>
                      <p className="mt-1 text-xs text-[#69766e]">
                        Relevant updates will appear here.
                      </p>
                    </div>
                  </div>
                )}
                {loading && (
                  <div className="p-10 text-center text-xs text-[#68766e]">
                    Loading notifications…
                  </div>
                )}
                {error && (
                  <div className="m-3 rounded-lg border border-[#dfc6bd] bg-[#fbefeb] p-3 text-xs text-[#8b4333]">
                    {error}
                  </div>
                )}
              </div>
            </section>
          </>,
          document.body,
        )}

      {urgent &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#07110c]/65 p-4 backdrop-blur-sm">
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="urgent-notification-title"
              className="urgent-notification-modal w-full max-w-md rounded-2xl border border-[#e1d09a] bg-white p-6 shadow-[0_30px_100px_rgba(0,0,0,.4)]"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-[#f5edc9]">
                <AlertTriangle size={20} className="icon-warning" />
              </span>
              <h2
                id="urgent-notification-title"
                className="mt-4 text-xl font-semibold text-[#253f33]"
              >
                {urgent.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#5f6d65]">{urgent.message}</p>
              <label className="mt-5 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-[#d9ded7] bg-[#f7f8f5] px-3 text-xs font-semibold text-[#526159]">
                <input
                  type="checkbox"
                  checked={suppressUrgent}
                  onChange={(event) => setSuppressUrgent(event.target.checked)}
                  className="size-4 accent-[#184d37]"
                />
                Don’t show urgent popups again
              </label>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
                <Button className="w-full sm:flex-1" onClick={reviewUrgent}>
                  Review now
                </Button>
                <Button kind="secondary" className="w-full sm:flex-1" onClick={dismissUrgent}>
                  Dismiss
                </Button>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}

function Mark() {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/assets/plmun-logo.png"
        alt="PLMun seal"
        className="size-10 object-contain sm:size-11"
      />
      <div className="hidden leading-none sm:block">
        <div className="text-[12px] font-bold tracking-[.08em] text-[#163e30]">
          PLMUN BUSINESS CENTER
        </div>
        <div className="mt-1 text-[9px] tracking-wide text-[#7e877c]">Campus services</div>
      </div>
    </div>
  );
}

function Button({
  children,
  onClick,
  kind = "primary",
  className = "",
  disabled = false,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  kind?: "primary" | "secondary" | "ghost";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const styles =
    kind === "primary"
      ? "bg-[#184d37] text-white hover:bg-[#103d2b] shadow-sm"
      : kind === "secondary"
        ? "border border-[#bdc7bc] bg-white text-[#173d2f] hover:border-[#184d37]"
        : "text-[#476053] hover:bg-[#edf0e8]";
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2.5 text-xs font-semibold transition-all duration-200 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

function Pill({
  children,
  tone = "green",
}: {
  children: React.ReactNode;
  tone?: "green" | "amber" | "gray";
}) {
  const color =
    tone === "green"
      ? "status-pill-green"
      : tone === "amber"
        ? "status-pill-amber"
        : "status-pill-gray";
  return <span className={`status-pill ${color}`}>{children}</span>;
}

function AvailabilityBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <span className="status-badge status-unavailable">Out of stock</span>;
  if (stock < 20) return <span className="status-badge status-low">{stock} left</span>;
  return <span className="status-badge status-available">{stock} available</span>;
}

function Header({
  user,
  page,
  setPage,
  cartCount,
  onSignOut,
  theme,
  onToggleTheme,
}: {
  user: AuthUser;
  page: string;
  setPage: (p: string) => void;
  cartCount: number;
  onSignOut: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const role = user.role;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);
  useEffect(() => {
    if (!settingsOpen) return;
    const closeSettings = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("pointerdown", closeSettings);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeSettings);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [settingsOpen]);
  return (
    <header className="site-header sticky top-0 z-30 border-b border-[#dfe1d8]/80 bg-[#fbfcf7]/90 shadow-[0_1px_12px_rgba(28,61,45,.04)] backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1500px] items-center gap-2 px-3 sm:h-[72px] sm:gap-3 sm:px-7 lg:gap-4">
        <button
          onClick={() => setPage(role === "student" ? "Home" : "Dashboard")}
          aria-label="Go to dashboard"
        >
          <Mark />
        </button>
        {role === "student" && (
          <nav className="hidden h-full items-center gap-1 lg:flex">
            {navByRole.student.map((item) => (
              <button
                key={item}
                onClick={() => setPage(item)}
                className={`h-full border-b-2 px-2.5 text-xs font-semibold transition-colors ${page === item ? "border-[#184d37] text-[#184d37]" : "border-transparent text-[#687168] hover:text-[#184d37]"}`}
              >
                {item}
              </button>
            ))}
          </nav>
        )}
        <label
          className={`relative ml-auto hidden w-full max-w-[260px] ${
            role === "student" ? "xl:block" : "lg:block"
          }`}
        >
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8d958b]"
          />
          <input
            onFocus={() => setPage(role === "student" ? "Products" : page)}
            className="w-full rounded-md border border-[#dfe3da] bg-white py-2.5 pl-9 pr-3 text-xs outline-none focus:border-[#184d37]"
            placeholder="Search the system"
          />
        </label>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 md:ml-0">
          {role === "student" && (
            <button
              onClick={() => setPage("Cart")}
              className="relative grid size-11 place-items-center rounded-lg text-[#374c42] transition hover:bg-[#edf0e8]"
              aria-label={`Shopping cart with ${cartCount} items`}
            >
              <ShoppingCart size={18} />
              <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-[#184d37] px-1 py-0.5 text-center text-[8px] font-bold leading-none text-white">
                {cartCount}
              </span>
            </button>
          )}
          <NotificationCenter user={user} setPage={setPage} />
          <div className="flex items-center gap-1.5 sm:gap-2 lg:hidden">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <div className="hidden text-right sm:block">
              <div className="text-[11px] font-semibold text-[#263d32]">{user.name}</div>
              <div className="text-[9px] capitalize text-[#899087]">{role}</div>
            </div>
            <button
              onClick={onSignOut}
              className="hidden min-h-11 items-center gap-1.5 rounded-lg border border-[#d8ddd4] px-3 py-2 text-[10px] font-semibold text-[#486056] transition hover:border-[#184d37] hover:bg-white sm:flex"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
          <div ref={settingsRef} className="relative hidden items-center gap-3 lg:flex">
            <button
              type="button"
              onClick={() => setSettingsOpen((open) => !open)}
              className="settings-trigger grid size-11 place-items-center rounded-lg border border-[#d8ddd4] bg-white text-[#40564b] transition hover:border-[#92a397] hover:bg-[#edf1ec]"
              aria-label="Open account settings"
              aria-expanded={settingsOpen}
              aria-haspopup="menu"
            >
              <Settings size={17} />
            </button>
            {settingsOpen && (
              <div
                role="menu"
                className="settings-popover absolute right-0 top-[calc(100%+10px)] z-50 w-56 overflow-hidden rounded-xl border border-[#d8ded6] bg-white p-2 shadow-[0_18px_55px_rgba(19,43,31,.18)]"
              >
                <div className="border-b border-[#e5e8e2] px-3 py-2.5">
                  <div className="truncate text-xs font-semibold text-[#29473a]">{user.name}</div>
                  <div className="mt-0.5 text-[10px] capitalize text-[#6f7c74]">{role} account</div>
                </div>
                <button
                  role="menuitem"
                  onClick={() => {
                    onToggleTheme();
                    setSettingsOpen(false);
                  }}
                  className="settings-menu-item mt-1 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-semibold text-[#40564b]"
                >
                  {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
                  Use {theme === "light" ? "dark" : "light"} mode
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setSettingsOpen(false);
                    onSignOut();
                  }}
                  className="settings-signout flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-semibold"
                >
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            )}
            <div className="text-right">
              <div className="text-xs font-semibold text-[#263d32]">{user.name}</div>
              <div className="mt-0.5 text-[10px] capitalize text-[#718078]">{role}</div>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="grid size-11 place-items-center rounded-lg border border-[#d8ddd4] text-[#375446] lg:hidden"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
          >
            <Menu size={17} />
          </button>
        </div>
      </div>
      {mobileOpen &&
        createPortal(
          <div
            className="mobile-menu-backdrop fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#07110c]/55 p-4 backdrop-blur-sm lg:hidden"
            onMouseDown={() => setMobileOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              className="mobile-menu-dialog max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-white/20 bg-white p-4 shadow-[0_24px_80px_rgba(0,0,0,.28)]"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between px-1">
                <div>
                  <h2 className="text-base font-semibold text-[#1f4032]">Menu</h2>
                  <p className="mt-0.5 text-[10px] capitalize text-[#66756d]">{role} navigation</p>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="grid size-11 place-items-center rounded-xl text-[#65766c] hover:bg-[#eef1eb]"
                  aria-label="Close menu"
                >
                  <X size={19} />
                </button>
              </div>
              <nav className="space-y-1.5">
                {navByRole[role].map((item) => {
                  const Icon = navIcons[item] ?? ArrowRight;
                  return (
                    <button
                      key={item}
                      onClick={() => {
                        setPage(item);
                        setMobileOpen(false);
                      }}
                      className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition ${page === item ? "bg-[#e8efe8] text-[#184d37]" : "text-[#4d6056] hover:bg-[#f0f2ed]"}`}
                    >
                      <span className="grid size-8 place-items-center rounded-lg bg-white shadow-sm">
                        <Icon size={16} />
                      </span>
                      {item}
                    </button>
                  );
                })}
              </nav>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  onSignOut();
                }}
                className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#d8ddd4] px-3 py-3 text-xs font-semibold text-[#6b4a42]"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </div>,
          document.body,
        )}
    </header>
  );
}

function Sidebar({
  role,
  page,
  setPage,
}: {
  role: Role;
  page: string;
  setPage: (p: string) => void;
}) {
  if (role === "student") return null;
  return (
    <aside className="site-sidebar hidden w-[230px] shrink-0 border-r border-[#dfe1d8] bg-[#f8f9f3] p-4 lg:flex lg:h-full lg:flex-col lg:overflow-y-auto">
      <div className="space-y-1">
        {navByRole[role].map((item) => {
          const Icon = navIcons[item] ?? ArrowRight;
          return (
            <button
              key={item}
              onClick={() => setPage(item)}
              className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition-colors duration-200 ${page === item ? "bg-[#184d37] text-white shadow-[0_8px_18px_rgba(24,77,55,.16)]" : "text-[#57675e] hover:bg-[#e8ece4]"}`}
            >
              <Icon size={16} strokeWidth={1.8} /> {item}
            </button>
          );
        })}
      </div>
      <div className="mt-auto rounded-xl border border-[#dfe4da] bg-white p-4 text-[10px] leading-5 text-[#707a72] shadow-sm">
        <div className="mb-1 flex items-center gap-2 font-semibold text-[#274b3a]">
          <Clock3 size={14} /> Service hours
        </div>
        Monday–Friday, 8:00 AM–5:00 PM
      </div>
    </aside>
  );
}

function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-.02em] text-[#163c2e]">{title}</h1>
        {subtitle && <p className="mt-1 text-xs text-[#7d857e]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="back-button mb-4 inline-flex size-11 items-center justify-center rounded-xl border border-[#d8ddd4] bg-white text-[#486056] shadow-sm transition hover:-translate-x-0.5 hover:border-[#8da092] hover:text-[#184d37]"
      aria-label="Go back"
      title="Go back"
    >
      <ArrowLeft size={18} />
    </button>
  );
}

function ProductCard({
  product,
  add,
  open,
}: {
  product: Product;
  add: (p: Product) => void;
  open: (p: Product) => void;
}) {
  return (
    <article className="group overflow-hidden rounded-xl border border-[#dfe2d9] bg-white shadow-[0_2px_8px_rgba(30,55,42,.04)] transition-all duration-300 hover:-translate-y-1 hover:border-[#c8d3c5] hover:shadow-[0_16px_36px_rgba(30,55,42,.1)]">
      <button
        onClick={() => open(product)}
        className="block w-full overflow-hidden bg-[#eeeee6] text-left"
      >
        <img
          src={product.image}
          alt={product.name}
          className="h-40 w-full object-cover transition duration-700 group-hover:scale-[1.04]"
        />
      </button>
      <div className="p-4">
        <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#879087]">
          {product.category}
        </div>
        <button
          onClick={() => open(product)}
          className="mt-1 text-left text-sm font-semibold text-[#193f31] hover:underline"
        >
          {product.name}
        </button>
        <div className="mt-1 text-xs font-bold text-[#184d37]">{peso(product.price)}</div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <AvailabilityBadge stock={product.stock} />
          <Button
            disabled={product.stock <= 0}
            onClick={() => add(product)}
            className="gap-1.5 px-3 py-2"
          >
            <ShoppingCart size={13} /> Add
          </Button>
        </div>
      </div>
    </article>
  );
}

function StudentHome({
  setPage,
  add,
  open,
}: {
  setPage: (p: string) => void;
  add: (p: Product) => void;
  open: (p: Product) => void;
}) {
  const { products } = useProductStore();
  const steps = [
    {
      number: "01",
      title: "Order online",
      description: "Browse essentials and campus services from any device, whenever you need them.",
      icon: ShoppingBag,
      accent: "bg-[#e2ecdf] text-[#184d37]",
    },
    {
      number: "02",
      title: "We prepare it",
      description: "Business Center staff prepare every item and update your order in real time.",
      icon: Sparkles,
      accent: "bg-[#eeead8] text-[#6c5b22]",
    },
    {
      number: "03",
      title: "Pick up on campus",
      description:
        "Bring your order number to the counter and collect everything in one quick visit.",
      icon: MapPin,
      accent: "bg-[#e3e9ed] text-[#345c70]",
    },
  ];
  return (
    <>
      <section className="animate-enter relative mb-12 overflow-hidden rounded-[24px] border border-white/60 bg-[#e7eadf] shadow-[0_20px_50px_rgba(31,62,46,.08)]">
        <div className="pointer-events-none absolute -left-20 -top-20 size-64 rounded-full bg-white/45 blur-3xl" />
        <div className="grid items-stretch lg:grid-cols-[1.08fr_.92fr]">
          <div className="relative p-7 sm:p-11 lg:p-14 xl:p-16">
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.06] tracking-[-.05em] text-[#143b2d] sm:text-5xl xl:text-[56px]">
              Everything you need for a productive school day.
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-[#657068]">
              Shop school essentials, request printing services, and pick up your order on
              campus—without the long wait.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={() => setPage("Products")}
                className="group w-full gap-2 px-5 py-3 sm:w-[176px]"
              >
                Browse products
                <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
              </Button>
              <Button
                kind="secondary"
                onClick={() => setPage("Services")}
                className="w-full gap-2 px-5 py-3 sm:w-[176px]"
              >
                <Printer size={14} /> View services
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-[10px] font-medium text-[#647269]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="icon-success" /> Campus pickup
              </span>
              <span className="flex items-center gap-1.5">
                <Clock3 size={14} className="icon-info" /> Live order updates
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="icon-success" /> Secure student access
              </span>
            </div>
          </div>
          <div className="relative hidden min-h-[440px] overflow-hidden lg:block">
            <img
              src="/assets/stationery.jpg"
              alt="Notebook and pen on a desk"
              className="absolute inset-0 h-full w-full object-cover transition duration-1000 hover:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#e7eadf]/35 to-transparent" />
            <div className="absolute bottom-6 left-6 rounded-xl border border-white/50 bg-white/80 p-4 shadow-lg backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-[#184d37] text-white">
                  <Store size={17} />
                </span>
                <div>
                  <div className="text-xs font-semibold text-[#183e30]">Open today</div>
                  <div className="mt-0.5 text-[10px] text-[#718078]">8:00 AM — 5:00 PM</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="animate-enter [animation-delay:80ms]">
        <SectionTitle
          title="Featured products"
          subtitle="Student favorites, stocked and ready for campus pickup."
          action={
            <Button
              kind="ghost"
              onClick={() => setPage("Products")}
              className="flex items-center gap-2"
            >
              View all <ArrowRight size={14} />
            </Button>
          }
        />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {products
            .filter(isPhysicalProduct)
            .slice(0, 4)
            .map((p) => (
              <ProductCard key={p.id} product={p} add={add} open={open} />
            ))}
        </div>
      </section>

      <section className="animate-enter mt-16 [animation-delay:140ms]">
        <div className="mb-7 max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-[-.035em] text-[#163d2f] sm:text-3xl">
            From cart to campus counter in three easy steps.
          </h2>
          <p className="mt-3 text-xs leading-6 text-[#77827a]">
            Built around a student’s schedule, so getting essentials never gets in the way of class.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <article
                key={step.number}
                className="group relative min-h-[250px] overflow-hidden rounded-2xl border border-[#dce2d8] bg-white p-7 shadow-[0_8px_30px_rgba(31,62,46,.05)] transition-all duration-300 hover:-translate-y-1 hover:border-[#c4d1c2] hover:shadow-[0_18px_44px_rgba(31,62,46,.1)] sm:p-8"
              >
                <div className="absolute right-5 top-3 text-6xl font-bold tracking-[-.08em] text-[#edf0e9] transition group-hover:text-[#e7ece4]">
                  {step.number}
                </div>
                <span
                  className={`relative grid size-12 place-items-center rounded-xl ${step.accent}`}
                >
                  <Icon size={21} />
                </span>
                <h3 className="relative mt-10 text-lg font-semibold text-[#163d2f]">
                  {step.title}
                </h3>
                <p className="relative mt-3 max-w-xs text-xs leading-6 text-[#77827a]">
                  {step.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

function ProductsPage({
  serviceOnly,
  add,
  open,
}: {
  serviceOnly?: boolean;
  add: (p: Product) => void;
  open: (p: Product) => void;
}) {
  const { products } = useProductStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const sectionProducts = products.filter(serviceOnly ? isServiceProduct : isPhysicalProduct);
  const categories = ["All", ...new Set(sectionProducts.map((product) => product.category))];
  const shown = sectionProducts.filter(
    (p) =>
      (category === "All" || p.category === category) &&
      p.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <SectionTitle
        title={serviceOnly ? "Services" : "Products"}
        subtitle={
          serviceOnly
            ? "Convenient print and document services for students."
            : "Browse school supplies available for campus pickup."
        }
      />
      <div className="mb-6">
        <label className="relative block max-w-[420px]">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8b958d]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={serviceOnly ? "Search services" : "Search products"}
            className="w-full rounded-lg border border-[#d9dfd5] bg-white py-2.5 pl-9 pr-3 text-xs outline-none focus:border-[#184d37]"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3.5 py-2 text-[11px] font-semibold transition ${category === c ? "bg-[#184d37] text-white shadow-sm" : "border border-[#d7ddd3] bg-white text-[#56655d] hover:border-[#8fa191]"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((p) => (
          <ProductCard key={p.id} product={p} add={add} open={open} />
        ))}
      </div>
      {!shown.length && (
        <div className="rounded-lg border border-dashed border-[#cfd6cc] py-16 text-center text-sm text-[#7c857d]">
          No {serviceOnly ? "services" : "products"} match your search.
        </div>
      )}
    </>
  );
}

function CartPage({
  cart,
  setCart,
  setPage,
}: {
  cart: Record<number, number>;
  setCart: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  setPage: (p: string) => void;
}) {
  const { products } = useProductStore();
  const lines = products.filter((p) => cart[p.id]).map((p) => ({ ...p, quantity: cart[p.id] }));
  const total = lines.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const change = (id: number, delta: number) =>
    setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) + delta) }));
  return (
    <>
      <SectionTitle title="Shopping cart" subtitle="Review your order before checkout." />
      <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
        <div className="rounded-lg border border-[#dde2d8] bg-white">
          {lines.length ? (
            lines.map((p, i) => (
              <div
                key={p.id}
                className={`flex flex-wrap items-center gap-4 p-4 ${i ? "border-t border-[#e6e8e2]" : ""}`}
              >
                <img src={p.image} alt="" className="size-16 rounded-md object-cover" />
                <div className="min-w-[180px] flex-1">
                  <div className="text-sm font-semibold text-[#1b4334]">{p.name}</div>
                  <div className="mt-1 text-xs text-[#889188]">{peso(p.price)} each</div>
                </div>
                <div className="flex items-center rounded-md border border-[#d9ded5]">
                  <button onClick={() => change(p.id, -1)} className="px-3 py-2">
                    −
                  </button>
                  <span className="w-8 text-center text-xs">{p.quantity}</span>
                  <button onClick={() => change(p.id, 1)} className="px-3 py-2">
                    +
                  </button>
                </div>
                <div className="w-20 text-right text-xs font-bold">
                  {peso(p.price * p.quantity)}
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <div className="text-sm font-semibold text-[#294b3c]">Your cart is empty</div>
              <Button className="mt-4" onClick={() => setPage("Products")}>
                Browse products
              </Button>
            </div>
          )}
        </div>
        <aside className="h-fit rounded-lg border border-[#dce1d7] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#183e30]">Order summary</h2>
          <div className="mt-5 space-y-3 text-xs text-[#69736c]">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{peso(total)}</span>
            </div>
            <div className="flex justify-between">
              <span>Service fee</span>
              <span>₱0.00</span>
            </div>
            <div className="border-t border-[#e2e5de] pt-3 flex justify-between text-sm font-bold text-[#173d2f]">
              <span>Total</span>
              <span>{peso(total)}</span>
            </div>
          </div>
          <Button
            disabled={!lines.length}
            className="mt-5 w-full"
            onClick={() => setPage("Checkout")}
          >
            Proceed to checkout
          </Button>
          <button
            onClick={() => setPage("Products")}
            className="mt-3 w-full text-center text-[11px] font-semibold text-[#557064]"
          >
            Continue shopping
          </button>
        </aside>
      </div>
    </>
  );
}

function Checkout({
  cart,
  setCart,
  setPage,
}: {
  cart: Record<number, number>;
  setCart: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  setPage: (p: string) => void;
}) {
  const { products } = useProductStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const total = products.reduce((s, p) => s + (cart[p.id] || 0) * p.price, 0);
  const defaultPickupDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await createOnlineOrder({
        items: Object.entries(cart)
          .filter(([, quantity]) => quantity > 0)
          .map(([productId, quantity]) => ({ productId: Number(productId), quantity })),
        pickupDate: String(form.get("pickupDate") ?? ""),
        pickupWindow: String(form.get("pickupWindow") ?? ""),
        notes: String(form.get("notes") ?? ""),
      });
      setCart({});
      setPage("Confirmation");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We couldn’t place your order.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit}>
      <SectionTitle title="Checkout" subtitle="Complete your details and choose a pickup time." />
      <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
        <div className="space-y-4">
          <div className="rounded-lg border border-[#dde2d8] bg-white p-5">
            <h2 className="text-sm font-semibold text-[#173d2f]">Student information</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="field">
                Full name
                <input defaultValue="Alex Rivera" required />
              </label>
              <label className="field">
                Student ID
                <input defaultValue="2025-00142" required />
              </label>
              <label className="field sm:col-span-2">
                Email address
                <input type="email" defaultValue="alex.rivera@plmun.edu.ph" required />
              </label>
            </div>
          </div>
          <div className="rounded-lg border border-[#dde2d8] bg-white p-5">
            <h2 className="text-sm font-semibold text-[#173d2f]">Pickup information</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="field">
                Pickup date
                <input name="pickupDate" type="date" defaultValue={defaultPickupDate} required />
              </label>
              <label className="field">
                Pickup window
                <select name="pickupWindow" defaultValue="1:00–3:00 PM">
                  <option>9:00–11:00 AM</option>
                  <option>1:00–3:00 PM</option>
                  <option>3:00–5:00 PM</option>
                </select>
              </label>
              <label className="field sm:col-span-2">
                Notes
                <textarea name="notes" rows={3} placeholder="Add special instructions (optional)" />
              </label>
            </div>
          </div>
        </div>
        <aside className="h-fit rounded-lg border border-[#dde2d8] bg-white p-5">
          <h2 className="text-sm font-semibold">Order summary</h2>
          <div className="mt-4 space-y-3 text-xs">
            {products
              .filter((p) => cart[p.id])
              .map((p) => (
                <div key={p.id} className="flex justify-between text-[#657068]">
                  <span>
                    {cart[p.id]}× {p.name}
                  </span>
                  <span>{peso(p.price * cart[p.id])}</span>
                </div>
              ))}
            <div className="flex justify-between border-t pt-3 text-sm font-bold text-[#173d2f]">
              <span>Total</span>
              <span>{peso(total)}</span>
            </div>
          </div>
          {error && (
            <div className="mt-4 rounded-lg border border-[#dfc6bd] bg-[#fbefeb] p-3 text-xs text-[#8b4333]">
              {error}
            </div>
          )}
          <Button type="submit" disabled={saving} className="mt-5 w-full">
            {saving ? "Placing order…" : "Place order"}
          </Button>
        </aside>
      </div>
    </form>
  );
}

function OrdersPage({ setPage }: { setPage: (p: string) => void }) {
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    getOrders()
      .then(setOnlineOrders)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "We couldn’t load your orders."),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <SectionTitle
        title="My orders"
        subtitle="Track current orders and view your purchase history."
      />
      {error && (
        <div className="mb-4 rounded-lg border border-[#dfc6bd] bg-[#fbefeb] p-3 text-xs text-[#8b4333]">
          {error}
        </div>
      )}
      <div className="space-y-3 md:hidden">
        {onlineOrders.map((order) => (
          <article
            key={order.id}
            className="rounded-xl border border-[#dde1d8] bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[#1b4635]">{order.id}</div>
                <div className="mt-1 text-xs text-[#7d8780]">
                  {new Date(order.createdAt).toLocaleDateString()} ·{" "}
                  {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                </div>
              </div>
              <Pill
                tone={
                  order.status === "Awaiting restock"
                    ? "amber"
                    : order.status === "Ready for pickup" || order.status === "Confirmed"
                      ? "green"
                      : "gray"
                }
              >
                {order.status}
              </Pill>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#78847c]">{order.statusMessage}</p>
            <div className="mt-4 flex items-center justify-between border-t border-[#e2e6de] pt-3">
              <span className="text-sm font-semibold text-[#294c3d]">{peso(order.total)}</span>
              <Button kind="secondary" onClick={() => setPage("Order detail")} className="min-h-10">
                View order
              </Button>
            </div>
          </article>
        ))}
        {!loading && !onlineOrders.length && (
          <div className="rounded-xl border border-dashed border-[#ccd4ca] bg-white/60 py-12 text-center text-sm text-[#7e8881]">
            You haven’t placed an online order yet.
          </div>
        )}
      </div>
      <div className="hidden overflow-hidden rounded-xl border border-[#dde1d8] bg-white md:block">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order number</th>
                <th>Date</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {onlineOrders.map((order) => (
                <tr key={order.id}>
                  <td className="font-semibold text-[#1b4635]">{order.id}</td>
                  <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td>{order.items.reduce((sum, item) => sum + item.quantity, 0)} items</td>
                  <td>{peso(order.total)}</td>
                  <td>
                    <div className="max-w-[210px]">
                      <Pill
                        tone={
                          order.status === "Awaiting restock"
                            ? "amber"
                            : order.status === "Ready for pickup" || order.status === "Confirmed"
                              ? "green"
                              : "gray"
                        }
                      >
                        {order.status}
                      </Pill>
                      <div className="mt-1.5 text-[9px] leading-4 text-[#899189]">
                        {order.statusMessage}
                      </div>
                    </div>
                  </td>
                  <td>
                    <button
                      onClick={() => setPage("Order detail")}
                      className="font-semibold text-[#184d37]"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && !onlineOrders.length && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-[#879087]">
                    You haven’t placed an online order yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {loading && <div className="mt-4 text-xs text-[#7d857e]">Loading your orders…</div>}
    </>
  );
}

function Stats({ role }: { role: Role }) {
  const cards =
    role === "staff"
      ? [
          ["Today’s sales", "₱9,320"],
          ["Orders processed", "64"],
          ["Pending orders", "12"],
          ["Ready for pickup", "4"],
        ]
      : [
          ["Monthly sales", "₱12,450"],
          ["Transactions", "86"],
          ["Products", "48"],
          ["Low-stock items", "5"],
        ];
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-[#dfe3da] bg-white p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#879087]">
            {label}
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-[-.03em] text-[#173f30]">
            {value}
          </div>
          <div className="mt-2 text-[10px] text-[#718078]">↑ 8.2% from last period</div>
        </div>
      ))}
    </div>
  );
}

function Dashboard({ role, setPage }: { role: Role; setPage: (p: string) => void }) {
  const { products } = useProductStore();
  return (
    <>
      <SectionTitle
        title={role === "staff" ? "Staff dashboard" : "Administrator dashboard"}
        subtitle={`Welcome back, Alex. Here’s what’s happening ${role === "staff" ? "today" : "across the center"}.`}
        action={
          role === "admin" ? (
            <Button onClick={() => setPage("Sales reports")}>View reports</Button>
          ) : undefined
        }
      />
      <Stats role={role} />
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-lg border border-[#dfe3da] bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#193f31]">
              {role === "staff" ? "Incoming online orders" : "Sales overview"}
            </h2>
            <span className="text-[10px] text-[#889087]">Last 6 months</span>
          </div>
          {role === "staff" ? (
            <div className="mt-4">
              <div className="hidden table-wrap md:block">
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 3).map((o) => (
                      <tr key={o.id}>
                        <td>{o.id}</td>
                        <td>Student customer</td>
                        <td>{o.total}</td>
                        <td>
                          <Pill tone="amber">Preparing</Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 md:hidden">
                {orders.slice(0, 3).map((order) => (
                  <article
                    key={order.id}
                    className="rounded-xl border border-[#dfe3da] bg-[#f8faf6] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#294c3d]">{order.id}</div>
                        <div className="mt-1 text-xs text-[#7d8780]">Student customer</div>
                      </div>
                      <Pill tone="amber">Preparing</Pill>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-[#e2e6de] pt-3">
                      <span className="text-xs text-[#7d8780]">{order.items}</span>
                      <span className="text-sm font-semibold text-[#294c3d]">{order.total}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-8 flex h-44 items-end gap-5 border-b border-[#dfe4da] px-3">
              {[44, 72, 58, 85, 92, 66].map((n, i) => (
                <div key={i} className="flex h-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t-sm ${i === 4 ? "bg-[#184d37]" : "bg-[#a7b99c]"}`}
                    style={{ height: `${n}%` }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-lg border border-[#dfe3da] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#193f31]">
            {role === "staff" ? "Counter workspace" : "Low-stock products"}
          </h2>
          <div className="mt-4 space-y-3">
            {products.slice(0, 4).map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-b border-[#edf0ea] pb-3">
                <img src={p.image} alt="" className="size-9 rounded object-cover" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[#334e40]">{p.name}</div>
                  <div className="mt-1 text-[10px] text-[#727e76]">{peso(p.price)}</div>
                </div>
                <AvailabilityBadge stock={role === "staff" ? p.stock : Math.min(p.stock, 8)} />
              </div>
            ))}
          </div>
          {role === "admin" && (
            <Button
              className="mt-3 w-full"
              kind="secondary"
              onClick={() => setPage("Inventory management")}
            >
              Manage inventory
            </Button>
          )}
        </div>
      </div>
      {role === "staff" && (
        <button
          onClick={() => setPage("POS terminal")}
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 flex min-h-12 items-center gap-2 rounded-full bg-[#184d37] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_36px_rgba(12,45,31,.32)] transition hover:-translate-y-0.5 hover:bg-[#103d2b] sm:bottom-6 sm:right-6"
        >
          <ScanLine size={18} /> Start transaction
        </button>
      )}
    </>
  );
}

function ProductSelectionModal({
  products,
  currentSale,
  onAdd,
  onClose,
}: {
  products: Product[];
  currentSale: Record<number, number>;
  onAdd: (selection: Record<number, number>) => void;
  onClose: () => void;
}) {
  const [selection, setSelection] = useState<Record<number, number>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [availability, setAvailability] = useState("All");
  const categories = ["All", ...new Set(products.map((product) => product.category))];
  const shown = products.filter((product) => {
    const matchesQuery = product.name.toLowerCase().includes(query.trim().toLowerCase());
    const matchesCategory = category === "All" || product.category === category;
    const remaining = product.stock - (currentSale[product.id] || 0);
    const matchesAvailability =
      availability === "All" ||
      (availability === "Available" && remaining > 0) ||
      (availability === "Low stock" && remaining > 0 && remaining < 20) ||
      (availability === "Unavailable" && remaining <= 0);
    return matchesQuery && matchesCategory && matchesAvailability;
  });
  const selectedUnits = Object.values(selection).reduce((sum, quantity) => sum + quantity, 0);

  useEffect(() => {
    const previous = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const adjust = (product: Product, delta: number) => {
    const maximum = Math.max(0, product.stock - (currentSale[product.id] || 0));
    setSelection((current) => {
      const quantity = Math.max(0, Math.min(maximum, (current[product.id] || 0) + delta));
      return { ...current, [product.id]: quantity };
    });
  };

  return createPortal(
    <div
      className="pos-modal-backdrop fixed inset-0 z-[110] flex items-center justify-center bg-[#07110c]/65 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-products-title"
        className="pos-product-modal grid h-[min(94dvh,900px)] w-full max-w-6xl grid-rows-[auto_auto_1fr_auto] overflow-hidden rounded-2xl border border-white/20 bg-[#f8f9f5] shadow-[0_30px_100px_rgba(0,0,0,.36)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="border-b border-[#dfe3dc] bg-white px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="add-products-title" className="text-xl font-semibold text-[#173d2f]">
                Add products
              </h2>
              <p className="mt-1 text-xs text-[#6f7b74]">
                Search inventory, choose quantities, then add everything in one step.
              </p>
            </div>
            <span className="rounded-full bg-[#e2ecdf] px-3 py-1.5 text-[10px] font-bold text-[#174733]">
              {selectedUnits} selected
            </span>
          </div>
        </header>

        <div className="border-b border-[#dfe3dc] bg-white px-4 py-4 sm:px-6">
          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_190px_auto]">
            <label className="relative">
              <span className="sr-only">Search products</span>
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#78867e]"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by product name"
                className="min-h-11 w-full rounded-lg border border-[#ccd4cb] bg-white pl-10 pr-3 text-xs"
              />
            </label>
            <label>
              <span className="sr-only">Filter by availability</span>
              <select
                value={availability}
                onChange={(event) => setAvailability(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-[#ccd4cb] bg-white px-3 text-xs font-semibold text-[#42564b]"
              >
                <option>All</option>
                <option>Available</option>
                <option>Low stock</option>
                <option>Unavailable</option>
              </select>
            </label>
            <Button
              kind="secondary"
              className="gap-2"
              onClick={() => {
                setQuery("");
                setCategory("All");
                setAvailability("All");
              }}
            >
              <RotateCcw size={14} /> Reset filters
            </Button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {categories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`min-h-10 shrink-0 rounded-full border px-3.5 text-[10px] font-bold transition ${
                  category === item
                    ? "border-[#184d37] bg-[#184d37] text-white"
                    : "border-[#ccd4cb] bg-white text-[#4c6055] hover:border-[#7f9588]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((product) => {
              const remaining = Math.max(0, product.stock - (currentSale[product.id] || 0));
              const quantity = selection[product.id] || 0;
              return (
                <article
                  key={product.id}
                  className={`rounded-xl border bg-white p-3 transition ${
                    quantity
                      ? "border-[#59816b] shadow-[0_0_0_2px_rgba(24,77,55,.1)]"
                      : "border-[#dce2da]"
                  }`}
                >
                  <div className="flex gap-3">
                    <img
                      src={product.image}
                      alt=""
                      className="size-16 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-[#203f32]">
                        {product.name}
                      </div>
                      <div className="mt-1 text-[10px] text-[#6e7b73]">{product.category}</div>
                      <div className="mt-1 text-sm font-bold text-[#184d37]">
                        {peso(product.price)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <AvailabilityBadge stock={remaining} />
                    <div className="flex min-h-11 items-center overflow-hidden rounded-lg border border-[#cbd3ca] bg-[#f8faf7]">
                      <button
                        onClick={() => adjust(product, -1)}
                        disabled={!quantity}
                        className="grid size-11 place-items-center text-[#496155] transition hover:bg-[#e8eee8] disabled:opacity-35"
                        aria-label={`Decrease ${product.name} quantity`}
                      >
                        <Minus size={15} />
                      </button>
                      <span
                        className="w-8 text-center text-xs font-bold text-[#263f33]"
                        aria-live="polite"
                      >
                        {quantity}
                      </span>
                      <button
                        onClick={() => adjust(product, 1)}
                        disabled={quantity >= remaining}
                        className="grid size-11 place-items-center text-[#184d37] transition hover:bg-[#e8eee8] disabled:opacity-35"
                        aria-label={`Increase ${product.name} quantity`}
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {!shown.length && (
            <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-[#cbd3ca] text-center">
              <div>
                <Package size={24} className="mx-auto text-[#8b968f]" />
                <p className="mt-3 text-xs font-semibold text-[#53635a]">
                  No inventory matches these filters.
                </p>
              </div>
            </div>
          )}
        </div>

        <footer className="border-t border-[#dfe3dc] bg-white px-4 py-4 sm:px-6">
          <div className="ml-auto flex w-full flex-col gap-2 sm:max-w-lg sm:flex-row-reverse">
            <Button
              disabled={!selectedUnits}
              onClick={() => onAdd(selection)}
              className="w-full sm:flex-1"
            >
              Add to transaction · {selectedUnits} {selectedUnits === 1 ? "item" : "items"}
            </Button>
            <Button kind="secondary" onClick={onClose} className="w-full gap-2 sm:flex-1">
              <X size={15} /> Close
            </Button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function PosTerminal() {
  const { products, refreshProducts } = useProductStore();
  const [sale, setSale] = useState<Record<number, number>>({});
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [result, setResult] = useState<{
    transaction: { id: string; total: number };
    impactedOrders: OnlineOrder[];
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const total = products.reduce((s, p) => s + (sale[p.id] || 0) * p.price, 0);
  const saleLines = products.filter((product) => sale[product.id] > 0);
  const itemCount = saleLines.reduce((sum, product) => sum + sale[product.id], 0);
  const changeQuantity = (product: Product, delta: number) => {
    setSale((current) => {
      const quantity = Math.max(0, Math.min(product.stock, (current[product.id] || 0) + delta));
      return { ...current, [product.id]: quantity };
    });
  };
  const addSelection = (selection: Record<number, number>) => {
    setSale((current) => {
      const next = { ...current };
      products.forEach((product) => {
        if (selection[product.id]) {
          next[product.id] = Math.min(
            product.stock,
            (current[product.id] || 0) + selection[product.id],
          );
        }
      });
      return next;
    });
    setCatalogOpen(false);
  };
  const completeSale = async () => {
    setSaving(true);
    setError("");
    try {
      const completed = await completeWalkInSale(
        Object.entries(sale)
          .filter(([, quantity]) => quantity > 0)
          .map(([productId, quantity]) => ({ productId: Number(productId), quantity })),
      );
      setResult(completed);
      await refreshProducts();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The transaction could not be completed.",
      );
    } finally {
      setSaving(false);
    }
  };
  if (result)
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-[#dce1d7] bg-white p-10 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#dce9de] text-[#174733]">
          <CheckCircle2 size={22} className="icon-success" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold text-[#173d2f]">Transaction completed</h1>
        <p className="mt-2 text-xs text-[#78827a]">
          Receipt {result.transaction.id} · Total {peso(result.transaction.total)}
        </p>
        {result.impactedOrders.length > 0 && (
          <div className="mt-6 rounded-xl border border-[#e1d4a7] bg-[#faf5df] p-4 text-left">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#67581c]">
              <AlertTriangle size={16} className="icon-warning" /> {result.impactedOrders.length}{" "}
              online order
              {result.impactedOrders.length > 1 ? "s need" : " needs"} attention
            </div>
            <p className="mt-2 text-[10px] leading-5 text-[#7a6d39]">
              Walk-in inventory was prioritized. Affected online orders were automatically moved to
              “Awaiting restock” and are visible in Order management.
            </p>
          </div>
        )}
        <Button
          className="mt-6"
          onClick={() => {
            setResult(null);
            setSale({});
          }}
        >
          New transaction
        </Button>
      </div>
    );
  return (
    <>
      <SectionTitle
        title="POS terminal"
        subtitle="Build and complete a walk-in transaction from one workspace."
      />
      <div className="grid min-h-[calc(100dvh-250px)] gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,.55fr)]">
        <section className="flex min-h-[480px] flex-col overflow-hidden rounded-2xl border border-[#d8ded6] bg-white shadow-[0_12px_36px_rgba(27,58,43,.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e6df] p-4 sm:p-5">
            <div>
              <h2 className="text-base font-semibold text-[#193f31]">Current transaction</h2>
              <p className="mt-1 text-[10px] text-[#748078]">
                {itemCount
                  ? `${itemCount} ${itemCount === 1 ? "item" : "items"} selected`
                  : "No items added yet"}
              </p>
            </div>
            <Button onClick={() => setCatalogOpen(true)} className="w-full gap-2 sm:w-auto">
              <Plus size={16} /> Add products
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {saleLines.length ? (
              saleLines.map((product, index) => (
                <div
                  key={product.id}
                  className={`grid gap-4 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center sm:p-5 ${
                    index ? "border-t border-[#e7eae5]" : ""
                  }`}
                >
                  <img
                    src={product.image}
                    alt=""
                    className="size-14 rounded-lg object-cover sm:size-16"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[#234437]">
                      {product.name}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-[#184d37]">
                        {peso(product.price)} each
                      </span>
                      <AvailabilityBadge stock={product.stock - sale[product.id]} />
                    </div>
                  </div>
                  <div className="flex min-h-11 w-fit items-center overflow-hidden rounded-lg border border-[#ccd4cb]">
                    <button
                      onClick={() => changeQuantity(product, -1)}
                      className="grid size-11 place-items-center text-[#4d6256] hover:bg-[#edf2ed]"
                      aria-label={`Decrease ${product.name} quantity`}
                    >
                      <Minus size={15} />
                    </button>
                    <span className="w-9 text-center text-xs font-bold">{sale[product.id]}</span>
                    <button
                      onClick={() => changeQuantity(product, 1)}
                      disabled={sale[product.id] >= product.stock}
                      className="grid size-11 place-items-center text-[#184d37] hover:bg-[#edf2ed] disabled:opacity-35"
                      aria-label={`Increase ${product.name} quantity`}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                    <div className="text-sm font-bold text-[#203f32]">
                      {peso(product.price * sale[product.id])}
                    </div>
                    <button
                      onClick={() => setSale((current) => ({ ...current, [product.id]: 0 }))}
                      className="danger-button mt-1 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-[10px] font-bold"
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="grid min-h-[350px] place-items-center p-8 text-center">
                <div className="max-w-xs">
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e8eee7] text-[#315f49]">
                    <ShoppingCart size={23} />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-[#29483a]">
                    Start this transaction
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-[#78837c]">
                    Use Add products above to search inventory and select multiple items.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-[#d8ded6] bg-white p-5 shadow-[0_12px_36px_rgba(27,58,43,.06)] lg:sticky lg:top-24">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#193f31]">Transaction summary</h2>
            <Pill tone={itemCount ? "green" : "gray"}>{itemCount ? "In progress" : "Empty"}</Pill>
          </div>
          <div className="mt-5 space-y-3 text-xs text-[#66736b]">
            <div className="flex justify-between">
              <span>Selected items</span>
              <span className="font-semibold text-[#304b3d]">{itemCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-[#304b3d]">{peso(total)}</span>
            </div>
            <div className="flex justify-between">
              <span>Additional charges</span>
              <span className="font-semibold text-[#304b3d]">₱0.00</span>
            </div>
            <div className="flex justify-between border-t border-[#dfe4dd] pt-4 text-base font-bold text-[#173d2f]">
              <span>Total</span>
              <span>{peso(total)}</span>
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-[#dce3da] bg-[#f5f8f3] p-4">
            <div className="flex gap-3">
              <ShieldCheck size={17} className="icon-info mt-0.5 shrink-0" />
              <p className="text-[10px] leading-5 text-[#637169]">
                Inventory is validated again when the sale is completed. Online order conflicts are
                flagged automatically.
              </p>
            </div>
          </div>
          {error && (
            <div className="mt-4 rounded-lg border border-[#dfc6bd] bg-[#fbefeb] p-3 text-xs text-[#8b4333]">
              {error}
            </div>
          )}
          <Button disabled={!total || saving} className="mt-5 w-full" onClick={completeSale}>
            {saving ? "Processing…" : "Complete walk-in sale"}
          </Button>
          <button
            onClick={() => setSale({})}
            disabled={!itemCount || saving}
            className="danger-button mt-2 min-h-11 w-full rounded-lg border px-4 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-45"
          >
            Clear transaction
          </button>
        </aside>
      </div>
      {catalogOpen && (
        <ProductSelectionModal
          products={products}
          currentSale={sale}
          onAdd={addSelection}
          onClose={() => setCatalogOpen(false)}
        />
      )}
    </>
  );
}

function OrderManagementPage() {
  const { refreshProducts } = useProductStore();
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadOrders = async () => {
    setLoading(true);
    try {
      setOnlineOrders(await getOrders());
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Orders could not be loaded.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void loadOrders();
  }, []);
  const conflicts = onlineOrders.filter((order) => order.status === "Awaiting restock");
  const changeStatus = async (order: OnlineOrder, status: OrderStatus) => {
    try {
      const message =
        status === "Cancelled"
          ? "This order was cancelled because stock could not be secured."
          : status === "Ready for pickup"
            ? "Your order is prepared and ready at the Business Center counter."
            : status === "Confirmed"
              ? "Restocked inventory is now allocated to this order."
              : order.statusMessage;
      const updated = await updateOrderStatus(order.id, status, message);
      setOnlineOrders((current) =>
        current.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
      );
      if (status === "Ready for pickup") await refreshProducts();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The order could not be updated.");
    }
  };

  return (
    <>
      <SectionTitle
        title="Order management"
        subtitle="Review online orders and resolve stock conflicts created by counter sales."
        action={
          <Button kind="secondary" onClick={loadOrders}>
            Refresh orders
          </Button>
        }
      />
      {conflicts.length > 0 && (
        <div className="mb-5 rounded-xl border border-[#ded09c] bg-[#faf5df] p-4 sm:flex sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eadfae] text-[#66591e]">
              <AlertTriangle size={17} className="icon-warning" />
            </span>
            <div>
              <div className="text-xs font-semibold text-[#5f531e]">
                {conflicts.length} stock conflict{conflicts.length > 1 ? "s" : ""} need review
              </div>
              <p className="mt-1 text-[10px] leading-5 text-[#7a6e3b]">
                Walk-in sales were fulfilled first. Contact students or wait for restock before
                confirming these orders.
              </p>
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-[#dfc6bd] bg-[#fbefeb] p-3 text-xs text-[#8b4333]">
          {error}
        </div>
      )}
      <div className="space-y-3">
        {onlineOrders.map((order) => (
          <article
            key={order.id}
            className={`rounded-xl border bg-white p-5 shadow-sm ${order.status === "Awaiting restock" ? "border-[#ded09c]" : "border-[#dce1d7]"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-[#1b4635]">{order.id}</div>
                <div className="mt-1 text-[10px] text-[#879087]">
                  {order.customerName} · {new Date(order.createdAt).toLocaleString()}
                </div>
              </div>
              <Pill
                tone={
                  order.status === "Awaiting restock"
                    ? "amber"
                    : order.status === "Confirmed" || order.status === "Ready for pickup"
                      ? "green"
                      : "gray"
                }
              >
                {order.status}
              </Pill>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px]">
              <div>
                <div className="text-xs text-[#58665e]">
                  {order.items.map((item) => `${item.quantity}× ${item.name}`).join(" · ")}
                </div>
                <div className="mt-2 text-[10px] leading-5 text-[#879087]">
                  {order.statusMessage}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {order.status === "Awaiting restock" && (
                  <>
                    <Button kind="secondary" onClick={() => changeStatus(order, "Confirmed")}>
                      Check stock &amp; confirm
                    </Button>
                    <button
                      onClick={() => changeStatus(order, "Cancelled")}
                      className="danger-button flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-[10px] font-semibold"
                    >
                      <XCircle size={13} className="icon-danger" /> Cancel
                    </button>
                  </>
                )}
                {order.status === "Confirmed" && (
                  <Button onClick={() => changeStatus(order, "Ready for pickup")}>
                    Ready for pickup
                  </Button>
                )}
              </div>
            </div>
          </article>
        ))}
        {!loading && !onlineOrders.length && (
          <div className="rounded-xl border border-dashed border-[#ccd4ca] bg-white/50 py-14 text-center text-xs text-[#7e8881]">
            No online orders yet.
          </div>
        )}
        {loading && <div className="py-8 text-center text-xs text-[#7e8881]">Loading orders…</div>}
      </div>
    </>
  );
}

function UserManagementPage({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [editing, setEditing] = useState<ManagedUser | "new" | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    fullName: "",
    email: "",
    role: "student" as Role,
    reference: "",
    password: "",
    active: true,
  });
  const loadUsers = async () => {
    setLoading(true);
    try {
      setUsers(await getUsers());
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Users could not be loaded.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void loadUsers();
  }, []);
  const openForm = (user?: ManagedUser) => {
    setEditing(user ?? "new");
    setDraft(
      user
        ? {
            fullName: user.full_name,
            email: user.email,
            role: user.role,
            reference: user.reference,
            password: "",
            active: user.active,
          }
        : {
            fullName: "",
            email: "",
            role: "student",
            reference: "",
            password: "",
            active: true,
          },
    );
    setError("");
  };
  const saveUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const saved =
        editing === "new"
          ? await createUser({ ...draft, password: draft.password })
          : await updateUser(editing!.id, {
              ...draft,
              password: draft.password || undefined,
            });
      setUsers((current) =>
        editing === "new"
          ? [saved, ...current]
          : current.map((user) => (user.id === saved.id ? saved : user)),
      );
      setEditing(null);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The account could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  const toggleAccess = async (user: ManagedUser) => {
    try {
      const updated = user.active
        ? await removeUser(user.id)
        : await updateUser(user.id, {
            email: user.email,
            fullName: user.full_name,
            role: user.role,
            reference: user.reference,
            active: true,
          });
      setUsers((current) =>
        current.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Account access could not be changed.");
    }
  };

  return (
    <>
      <SectionTitle
        title="User management"
        subtitle="Create accounts, update roles, and control access."
        action={
          <Button onClick={() => openForm()} className="w-full gap-2 sm:w-auto">
            <UserPlus size={14} /> Add user
          </Button>
        }
      />
      {error && (
        <div className="mb-4 rounded-lg border border-[#dfc6bd] bg-[#fbefeb] p-3 text-xs text-[#8b4333]">
          {error}
        </div>
      )}
      <div className="space-y-3 md:hidden">
        {users.map((user) => (
          <article key={user.id} className="rounded-xl border border-[#dce1d7] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[#294c3d]">
                  {user.full_name}
                  {user.id === currentUserId && (
                    <span className="ml-2 text-[9px] font-medium text-[#849087]">You</span>
                  )}
                </div>
                <div className="mt-1 truncate text-xs text-[#7d8780]">{user.email}</div>
              </div>
              <Pill tone={user.active ? "green" : "gray"}>
                {user.active ? "Active" : "Removed"}
              </Pill>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-[#f6f8f4] p-3 text-xs">
              <div>
                <div className="text-[9px] uppercase tracking-wide text-[#8a948d]">Role</div>
                <div className="mt-1 capitalize text-[#3d5549]">{user.role}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wide text-[#8a948d]">Reference</div>
                <div className="mt-1 truncate text-[#3d5549]">{user.reference || "—"}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button kind="secondary" onClick={() => openForm(user)} className="gap-2">
                <Pencil size={14} /> Edit
              </Button>
              {user.id !== currentUserId ? (
                <button
                  onClick={() => toggleAccess(user)}
                  className={`min-h-11 rounded-lg px-3 text-xs font-semibold ${user.active ? "danger-button border" : "border border-[#bfd1c0] text-[#315b48]"}`}
                >
                  {user.active ? "Remove access" : "Restore access"}
                </button>
              ) : (
                <div />
              )}
            </div>
          </article>
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-xl border border-[#dce1d7] bg-white md:block">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Reference</th>
                <th>Role</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="font-semibold text-[#294c3d]">
                    {user.full_name}
                    {user.id === currentUserId && (
                      <span className="ml-2 text-[9px] font-medium text-[#849087]">You</span>
                    )}
                  </td>
                  <td>{user.email}</td>
                  <td>{user.reference || "—"}</td>
                  <td className="capitalize">{user.role}</td>
                  <td>
                    <Pill tone={user.active ? "green" : "gray"}>
                      {user.active ? "Active" : "Access removed"}
                    </Pill>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openForm(user)}
                        className="flex items-center gap-1.5 rounded-md px-2.5 py-2 text-[10px] font-semibold text-[#315b48] hover:bg-[#edf2eb]"
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      {user.id !== currentUserId && (
                        <button
                          onClick={() => toggleAccess(user)}
                          className={`flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-semibold ${user.active ? "danger-button" : "text-[#315b48] hover:bg-[#edf2eb]"}`}
                        >
                          <UserX size={13} /> {user.active ? "Remove" : "Restore"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !users.length && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs">
                    No accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {loading && <div className="mt-4 text-xs text-[#7d857e]">Loading accounts…</div>}

      {editing && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#10251d]/60 p-4 backdrop-blur-sm"
          onMouseDown={() => setEditing(null)}
        >
          <form
            onSubmit={saveUser}
            onMouseDown={(event) => event.stopPropagation()}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/20 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#173d2f]">
                  {editing === "new" ? "Create account" : "Edit account"}
                </h2>
                <p className="mt-1 text-[10px] text-[#7f8982]">
                  Credentials are stored in Supabase Auth; profile access is stored separately.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="grid size-11 shrink-0 place-items-center rounded-lg border border-[#d5dcd4] text-[#53645a] transition hover:bg-[#edf1ec]"
                aria-label="Close account form"
              >
                <X size={17} />
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="field">
                Full name
                <input
                  value={draft.fullName}
                  onChange={(event) => setDraft({ ...draft, fullName: event.target.value })}
                  required
                />
              </label>
              <label className="field">
                Email
                <input
                  type="email"
                  value={draft.email}
                  onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                  required
                />
              </label>
              <label className="field">
                Reference
                <input
                  value={draft.reference}
                  onChange={(event) => setDraft({ ...draft, reference: event.target.value })}
                  placeholder="Student or employee ID"
                />
              </label>
              <label className="field">
                Role
                <select
                  value={draft.role}
                  onChange={(event) => setDraft({ ...draft, role: event.target.value as Role })}
                  disabled={editing !== "new" && editing.id === currentUserId}
                >
                  <option value="student">Student</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
              <label className="field sm:col-span-2">
                {editing === "new" ? "Temporary password" : "New password (optional)"}
                <input
                  type="password"
                  minLength={8}
                  value={draft.password}
                  onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                  placeholder="At least 8 characters"
                  required={editing === "new"}
                />
              </label>
            </div>
            <div className="mt-6 grid gap-2 sm:flex sm:flex-row-reverse sm:justify-start">
              <Button type="submit" disabled={saving} className="w-full gap-2 sm:w-auto">
                <Save size={14} /> {saving ? "Saving…" : "Save account"}
              </Button>
              <Button
                kind="secondary"
                onClick={() => setEditing(null)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function ManagementPage({ page }: { page: string }) {
  const { products, addProduct, editProduct, removeProduct } = useProductStore();
  const isProduct = page === "Product management";
  const isInventory = page === "Inventory management";
  const isUser = page === "User management";
  const isReport = page.includes("reports");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    category: "Notebooks",
    price: "0",
    stock: "0",
    description: "",
    image: "/assets/stationery.jpg",
  });
  const title = page;
  const openProductForm = (product?: Product) => {
    setEditing(product ?? "new");
    setDraft(
      product
        ? {
            name: product.name,
            category: product.category,
            price: String(product.price),
            stock: String(product.stock),
            description: product.description,
            image: product.image,
          }
        : {
            name: "",
            category: "Notebooks",
            price: "0",
            stock: "0",
            description: "",
            image: "/assets/stationery.jpg",
          },
    );
  };
  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const input = {
        ...draft,
        price: Number(draft.price),
        stock: Number(draft.stock),
      };
      if (editing === "new") await addProduct(input);
      else if (editing) await editProduct(editing.id, input);
      setEditing(null);
      setNotice(editing === "new" ? "Product saved to Supabase" : "Product updated in Supabase");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save product");
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <SectionTitle
        title={title}
        subtitle={
          isProduct
            ? "Maintain products, pricing, and availability."
            : isInventory
              ? "Monitor stock levels and record adjustments."
              : isUser
                ? "Manage access for students, staff, and administrators."
                : "Review business center performance and activity."
        }
        action={
          <Button
            onClick={() =>
              isProduct
                ? openProductForm()
                : setNotice(isUser ? "New user form opened" : "Report exported")
            }
          >
            {isUser ? "Add user" : isProduct ? "Add product" : "Export report"}
          </Button>
        }
      />
      {notice && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-[#bfd1c0] bg-[#eaf2e8] px-4 py-3 text-xs text-[#28513d]">
          <span>{notice}. This prototype action is ready for review.</span>
          <button onClick={() => setNotice("")}>Dismiss</button>
        </div>
      )}
      {editing && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#10251d]/55 p-4"
          onMouseDown={() => setEditing(null)}
        >
          <form
            onSubmit={saveProduct}
            onMouseDown={(event) => event.stopPropagation()}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#173d2f]">
                  {editing === "new" ? "Add product" : "Edit product"}
                </h2>
                <p className="mt-1 text-[10px] text-[#818a82]">
                  Changes are stored in your connected Supabase database.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="grid size-11 shrink-0 place-items-center rounded-lg border border-[#d5dcd4] text-[#53645a] transition hover:bg-[#edf1ec]"
                aria-label="Close product form"
              >
                <X size={17} />
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="field sm:col-span-2">
                Product name
                <input
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  required
                />
              </label>
              <label className="field">
                Category
                <select
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                >
                  <option>Notebooks</option>
                  <option>Writing</option>
                  <option>Bundles</option>
                  <option>Services</option>
                </select>
              </label>
              <label className="field">
                Image
                <select
                  value={draft.image}
                  onChange={(event) => setDraft({ ...draft, image: event.target.value })}
                >
                  <option value="/assets/stationery.jpg">Stationery</option>
                  <option value="/assets/spiral-notebook.jpg">Notebook</option>
                  <option value="/assets/notebook-pen.jpg">Notebook and pen</option>
                </select>
              </label>
              <label className="field">
                Price
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.price}
                  onChange={(event) => setDraft({ ...draft, price: event.target.value })}
                  required
                />
              </label>
              <label className="field">
                Stock
                <input
                  type="number"
                  min="0"
                  value={draft.stock}
                  onChange={(event) => setDraft({ ...draft, stock: event.target.value })}
                  required
                />
              </label>
              <label className="field sm:col-span-2">
                Description
                <textarea
                  rows={3}
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  required
                />
              </label>
            </div>
            <div className="mt-6 grid gap-2 sm:flex sm:flex-row-reverse sm:justify-start">
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? "Saving…" : "Save product"}
              </Button>
              <Button
                kind="secondary"
                onClick={() => setEditing(null)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
      {(isReport || page === "Transaction history") && <Stats role="admin" />}
      <div className="overflow-hidden rounded-lg border border-[#dce1d7] bg-white">
        <div className="border-b border-[#e1e5dd] p-4 flex flex-wrap gap-2">
          <input
            placeholder={`Search ${isUser ? "users" : isProduct || isInventory ? "products" : "transactions"}`}
            className="w-full max-w-[360px] rounded-md border border-[#d8ddd4] px-3 py-2 text-xs outline-none"
          />
          <select className="rounded-md border border-[#d8ddd4] bg-white px-3 py-2 text-xs">
            <option>All categories</option>
            <option>Notebooks</option>
            <option>Services</option>
          </select>
          <Button kind="secondary">Apply filters</Button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {isUser ? (
                  <>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last active</th>
                  </>
                ) : (
                  <>
                    <th>{isReport || page === "Transaction history" ? "Reference" : "Product"}</th>
                    <th>Category</th>
                    <th>{isInventory ? "On hand" : "Price"}</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </>
                )}
                <th />
              </tr>
            </thead>
            <tbody>
              {(isUser
                ? ["Maria Santos", "Joshua Lim", "Nicole Reyes", "Gabriel Cruz", "Sophia Tan"]
                : products
              ).map((item, i) => (
                <tr key={typeof item === "string" ? item : item.id}>
                  {isUser ? (
                    <>
                      <td data-label="Name" className="font-semibold">
                        {item as string}
                      </td>
                      <td data-label="Email">
                        {(item as string).toLowerCase().replace(" ", ".")}@plmun.edu.ph
                      </td>
                      <td data-label="Role">
                        {i === 0 ? "Administrator" : i < 3 ? "Staff" : "Student"}
                      </td>
                      <td data-label="Status">
                        <Pill>Active</Pill>
                      </td>
                      <td data-label="Last active">Today</td>
                    </>
                  ) : (
                    <>
                      <td data-label="Record" className="font-semibold">
                        {isReport || page === "Transaction history"
                          ? `TX-00${82 + i}`
                          : (item as Product).name}
                      </td>
                      <td data-label="Category">{(item as Product).category}</td>
                      <td data-label={isInventory ? "On hand" : "Price"}>
                        {isInventory
                          ? `${(item as Product).stock} units`
                          : peso((item as Product).price)}
                      </td>
                      <td data-label="Status">
                        <Pill tone={(item as Product).stock < 20 ? "amber" : "green"}>
                          {(item as Product).stock < 20 ? "Low stock" : "Active"}
                        </Pill>
                      </td>
                      <td data-label="Updated">Mar {12 - i}, 2025</td>
                    </>
                  )}
                  <td data-label="Actions">
                    <div className="flex gap-3">
                      <button
                        onClick={() =>
                          !isUser && (isProduct || isInventory)
                            ? openProductForm(item as Product)
                            : setNotice("Record selected for review")
                        }
                        className="min-h-11 rounded-lg px-3 font-semibold text-[#184d37] hover:bg-[#edf2eb]"
                      >
                        Manage
                      </button>
                      {isProduct && (
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Delete ${(item as Product).name}?`)) return;
                            try {
                              await removeProduct((item as Product).id);
                              setNotice("Product deleted from Supabase");
                            } catch (error) {
                              setNotice(
                                error instanceof Error ? error.message : "Unable to delete product",
                              );
                            }
                          }}
                          className="danger-button min-h-11 rounded-lg px-3 font-semibold"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Footer({ setPage }: { setPage: (page: string) => void }) {
  return (
    <footer className="site-footer mt-12 bg-[#123d2c] text-white">
      <div className="mx-auto grid max-w-[1270px] gap-10 px-6 py-12 sm:px-9 md:grid-cols-[1.3fr_.8fr_1fr] lg:py-14">
        <div className="max-w-md">
          <div className="flex items-center gap-3">
            <span className="grid size-14 place-items-center rounded-full bg-white p-1.5">
              <img
                src="/assets/plmun-logo.png"
                alt="PLMun seal"
                className="size-full object-contain"
              />
            </span>
            <div className="text-xs font-bold tracking-[.1em]">PLMUN BUSINESS CENTER</div>
          </div>
          <p className="mt-5 text-xs leading-6 text-white/58">
            Reliable campus essentials and document services for the PLMun community, available
            online and ready for convenient pickup.
          </p>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[.18em] text-white/45">
            Explore
          </div>
          <div className="mt-4 grid gap-3 text-xs text-white/68">
            {["Products", "Services", "My orders"].map((item) => (
              <button
                key={item}
                onClick={() => setPage(item)}
                className="w-fit transition hover:translate-x-0.5 hover:text-white"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[.18em] text-white/45">
            Visit the center
          </div>
          <div className="mt-4 space-y-3 text-xs leading-5 text-white/68">
            <div className="flex items-start gap-2.5">
              <MapPin size={15} className="mt-0.5 shrink-0 text-[#9fbca5]" />
              PLMun Campus, Muntinlupa City
            </div>
            <div className="flex items-center gap-2.5">
              <Clock3 size={15} className="shrink-0 text-[#9fbca5]" />
              Monday–Friday, 8:00 AM–5:00 PM
            </div>
            <div className="flex items-center gap-2.5">
              <Mail size={15} className="shrink-0 text-[#9fbca5]" />
              businesscenter@plmun.edu.ph
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/8">
        <div className="mx-auto flex max-w-[1270px] flex-wrap items-center justify-between gap-3 px-6 py-5 text-[9px] text-white/38 sm:px-9">
          <span>© {new Date().getFullYear()} Pamantasan ng Lungsod ng Muntinlupa</span>
          <span>Built for better campus service</span>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = window.localStorage.getItem("plmun-theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [user, setUser] = useState<AuthUser | null>(readStoredSession);
  const [page, setPage] = useState("Home");
  const [pageHistory, setPageHistory] = useState<string[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({ 1: 1, 2: 1 });
  const [selected, setSelected] = useState<Product | null>(null);
  const [toast, setToast] = useState("");
  const mainRef = useRef<HTMLElement>(null);
  const cartCount = useMemo(() => Object.values(cart).reduce((a, b) => a + b, 0), [cart]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("plmun-theme", theme);
    const favicon = document.querySelector<HTMLLinkElement>("#app-favicon");
    if (favicon) favicon.href = `/assets/plmun-favicon-${theme}-theme.png`;
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === "dark" ? "#101112" : "#123d2c";
  }, [theme]);
  useEffect(() => {
    if (!selected) return;
    const previous = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selected]);
  const toggleTheme = () => setTheme((current) => (current === "light" ? "dark" : "light"));
  const navigate = (nextPage: string) => {
    if (nextPage === page) return;
    setPageHistory((history) => [...history, page].slice(-20));
    setPage(nextPage);
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goBack = () => {
    const fallback = user?.role === "student" ? "Home" : "Dashboard";
    setPageHistory((history) => {
      const next = [...history];
      setPage(next.pop() ?? fallback);
      return next;
    });
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const add = (p: Product) => {
    setCart((c) => ({ ...c, [p.id]: (c[p.id] || 0) + 1 }));
    setToast(`${p.name} added to cart`);
    window.setTimeout(() => setToast(""), 1800);
  };
  if (!user) {
    return (
      <Login
        theme={theme}
        onAuthenticated={(nextUser) => {
          setUser(nextUser);
          setPage(nextUser.role === "student" ? "Home" : "Dashboard");
          setPageHistory([]);
        }}
      />
    );
  }

  const role = user.role;
  const signOut = async () => {
    await authProvider.signOut();
    setUser(null);
    setPage("Home");
    setPageHistory([]);
    setCart({});
  };

  const content = (() => {
    if (role === "student") {
      if (page === "Home") return <StudentHome setPage={navigate} add={add} open={setSelected} />;
      if (page === "Products") return <ProductsPage add={add} open={setSelected} />;
      if (page === "Services") return <ProductsPage serviceOnly add={add} open={setSelected} />;
      if (page === "Cart") return <CartPage cart={cart} setCart={setCart} setPage={navigate} />;
      if (page === "Checkout") return <Checkout cart={cart} setCart={setCart} setPage={navigate} />;
      if (page === "Confirmation")
        return (
          <div className="mx-auto max-w-2xl rounded-lg border border-[#dce1d7] bg-white p-10 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#dce9de] text-xl text-[#174733]">
              ✓
            </span>
            <h1 className="mt-5 text-2xl font-semibold text-[#173d2f]">
              Order placed successfully
            </h1>
            <p className="mt-2 text-sm text-[#728078]">
              Your order <strong>ORD-1043</strong> is being prepared for pickup.
            </p>
            <div className="mx-auto mt-6 max-w-sm rounded-md bg-[#f3f4ed] p-4 text-left text-xs leading-6 text-[#657068]">
              Pickup: March 14, 1:00–3:00 PM
              <br />
              Location: PLMun Business Center
              <br />
              Payment: Pay at pickup
            </div>
            <Button className="mt-6" onClick={() => navigate("My orders")}>
              Track order
            </Button>
          </div>
        );
      if (page === "Order detail")
        return (
          <>
            <SectionTitle title="Order tracking · ORD-1042" subtitle="Placed March 12, 2025" />
            <div className="rounded-lg border border-[#dce1d7] bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Ready for pickup</h2>
                  <p className="mt-1 text-[10px] text-[#7a857e]">
                    Your order is prepared at the Business Center counter.
                  </p>
                </div>
                <Pill>Current status</Pill>
              </div>
              <div className="mt-8 grid gap-4 sm:grid-cols-4">
                {[
                  ["Order placed", ClipboardList],
                  ["Preparing", Package],
                  ["Ready for pickup", PackageCheck],
                  ["Completed", CheckCircle2],
                ].map(([label, Icon], index) => {
                  const complete = index < 3;
                  const current = index === 2;
                  const StageIcon = Icon as LucideIcon;
                  return (
                    <div
                      key={label as string}
                      className={`relative rounded-xl border p-4 ${current ? "border-[#8eaa94] bg-[#edf4eb]" : "border-[#e0e4dc] bg-[#f9faf6]"}`}
                    >
                      <div
                        className={`grid size-9 place-items-center rounded-full ${complete ? "bg-[#184d37] text-white" : "bg-[#e4e8e1] text-[#8b958d]"}`}
                      >
                        <StageIcon size={16} />
                      </div>
                      <div className="mt-3 text-[11px] font-semibold text-[#355346]">
                        {label as string}
                      </div>
                      <div className="mt-1 text-[9px] text-[#8b938d]">
                        {current ? "Ready now" : complete ? "Completed" : "Next step"}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <div className="rounded-md bg-[#f5f6f0] p-4 text-xs leading-6">
                  Spiral notebook × 1<br />
                  Premium ballpen × 1<br />
                  <strong>Total: ₱65.00</strong>
                </div>
                <div className="rounded-md bg-[#f5f6f0] p-4 text-xs leading-6">
                  Pickup at PLMun Business Center
                  <br />
                  Show order number ORD-1042
                  <br />
                  Pay at pickup
                </div>
              </div>
            </div>
          </>
        );
      return <OrdersPage setPage={navigate} />;
    }
    if (page === "Dashboard") return <Dashboard role={role} setPage={navigate} />;
    if (role === "staff" && page === "POS terminal") return <PosTerminal />;
    if (role === "staff" && page === "Order management") return <OrderManagementPage />;
    if (role === "admin" && page === "User management") {
      return <UserManagementPage currentUserId={user.id} />;
    }
    return <ManagementPage page={page} />;
  })();

  return (
    <ProductDataProvider>
      <div
        data-theme={theme}
        className="app-shell min-h-screen bg-[#f1f1e8] text-[#223b30] transition-colors duration-300"
      >
        <Header
          user={user}
          page={page}
          setPage={navigate}
          cartCount={cartCount}
          onSignOut={signOut}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <div
          className={`mx-auto flex max-w-[1500px] ${
            role === "student"
              ? "min-h-[calc(100vh-72px)]"
              : "min-h-[calc(100vh-72px)] lg:h-[calc(100dvh-72px)] lg:min-h-0 lg:overflow-hidden"
          }`}
        >
          <Sidebar role={role} page={page} setPage={navigate} />
          <main
            ref={mainRef}
            className={`min-w-0 flex-1 p-4 sm:p-7 lg:p-9 ${
              role === "student" ? "overflow-hidden" : "lg:h-full lg:overflow-y-auto"
            } ${role === "student" ? "" : "staff-main"}`}
          >
            {page !== (role === "student" ? "Home" : "Dashboard") && (
              <BackButton onClick={goBack} />
            )}
            {content}
          </main>
        </div>
        {role === "student" && <Footer setPage={navigate} />}
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 rounded-md bg-[#173f30] px-4 py-3 text-xs font-semibold text-white shadow-xl">
            {toast}
          </div>
        )}
        {selected && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#10251d]/60 p-4 backdrop-blur-sm"
            onMouseDown={() => setSelected(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="product-detail-title"
              className="grid max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl md:grid-cols-2"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <img
                src={selected.image}
                alt={selected.name}
                className="h-48 w-full object-cover md:h-full md:min-h-64"
              />
              <div className="p-7">
                <div className="text-[10px] font-bold uppercase tracking-[.14em] text-[#829085]">
                  {selected.category}
                </div>
                <h2
                  id="product-detail-title"
                  className="mt-3 text-2xl font-semibold text-[#163d2f]"
                >
                  {selected.name}
                </h2>
                <div className="mt-2 text-lg font-bold text-[#184d37]">{peso(selected.price)}</div>
                <p className="mt-5 text-sm leading-6 text-[#6e7971]">{selected.description}</p>
                <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-[#dce2da] bg-[#f2f4ed] p-3">
                  <AvailabilityBadge stock={selected.stock} />
                  <span className="text-[10px] font-semibold text-[#607068]">Campus pickup</span>
                </div>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
                  <Button
                    disabled={selected.stock <= 0}
                    className="w-full sm:flex-1"
                    onClick={() => {
                      add(selected);
                      setSelected(null);
                    }}
                  >
                    Add to cart
                  </Button>
                  <Button
                    kind="secondary"
                    className="w-full gap-2 sm:flex-1"
                    onClick={() => setSelected(null)}
                  >
                    <X size={15} /> Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProductDataProvider>
  );
}
