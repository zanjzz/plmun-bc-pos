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
  Home,
  ImagePlus,
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
  RefreshCw,
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
  Upload,
  UserPlus,
  Users,
  UserX,
  Pencil,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { type AuthUser, authProvider, readStoredSession, type Role } from "./auth";
import { type Cart, type CartLine, loadStoredCart, saveStoredCart } from "./cart";
import Login from "./Login";
import {
  type AppNotification,
  deleteNotification,
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
  getProducts,
  isPhysicalProduct,
  isServiceProduct,
  adjustInventory,
  type Product,
  uploadProductImage,
  updateProduct,
} from "./products";
import { type AdminReportData, getAdminReports } from "./reports";
import { createUser, getUsers, type ManagedUser, removeUser, updateUser } from "./users";
import {
  generateVariationValues,
  isOptionValueAvailable,
  mergeGeneratedVariations,
  type ProductAttribute,
  type ProductVariation,
  variationKey,
  variationLabel,
} from "./variations";

// Counter animation hook
function useCounterAnimation(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (hasAnimated || target === 0) {
      setCount(target);
      return;
    }

    setHasAnimated(true);
    let startTime: number | null = null;
    const startValue = 0;

    const animate = (currentTime: number) => {
      if (startTime === null) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentCount = Math.floor(startValue + (target - startValue) * easeOutQuart);
      
      setCount(currentCount);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(target);
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration, hasAnimated]);

  return count;
}

// Skeleton loading component
function Skeleton({ className = "", width = "100%", height = "1rem" }: { className?: string; width?: string; height?: string }) {
  return (
    <div 
      className={`animate-pulse rounded bg-[#e7ece6] ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

// Skeleton card for product/inventory lists
function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-[#dfe3dc] bg-white p-4">
      <div className="flex items-start gap-4">
        <Skeleton width="4rem" height="4rem" className="shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton width="70%" height="1rem" />
          <Skeleton width="50%" height="0.875rem" />
          <Skeleton width="40%" height="0.875rem" />
        </div>
      </div>
    </div>
  );
}

// Skeleton for table rows
function SkeletonTableRow({ columns = 4 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i}>
          <Skeleton width={i === 0 ? "80%" : "60%"} height="0.875rem" />
        </td>
      ))}
    </tr>
  );
}

// Animated counter component
function AnimatedCounter({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const animatedValue = useCounterAnimation(value);
  return <>{prefix}{animatedValue.toLocaleString()}{suffix}</>;
}

// Animated currency counter
function AnimatedCurrency({ value }: { value: number }) {
  const animatedValue = useCounterAnimation(value);
  return <>₱{animatedValue.toFixed(2)}</>;
}


type ProductStore = {
  products: Product[];
  loading: boolean;
  error: string | null;
  addProduct: (product: Omit<Product, "id">) => Promise<void>;
  editProduct: (id: number, updates: Partial<Omit<Product, "id">>) => Promise<void>;
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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProducts()
      .then((items) => {
        setProducts(items);
        setError(null);
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Products could not be loaded."),
      )
      .finally(() => setLoading(false));
  }, []);

  const store: ProductStore = {
    products,
    loading,
    error,
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
      setLoading(true);
      try {
        setProducts(await getProducts());
        setError(null);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Products could not be loaded.");
        throw reason;
      } finally {
        setLoading(false);
      }
    },
  };

  return <ProductContext.Provider value={store}>{children}</ProductContext.Provider>;
}

const navByRole: Record<Role, string[]> = {
  student: ["Home", "Products", "Services", "My orders"],
  staff: ["Dashboard", "POS terminal", "Order management"],
  admin: [
    "Dashboard",
    "Product management",
    "Inventory management",
    "Sales & transactions",
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
  "Sales & transactions": BarChart3,
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

const notificationCanDismiss = (notification: AppNotification) => {
  if (typeof notification.canDismiss === "boolean") return notification.canDismiss;
  if (notification.type === "transaction" || notification.type === "system") return true;
  if (
    notification.type === "order" &&
    ["Completed", "Cancelled"].includes(String(notification.metadata.status))
  ) {
    return true;
  }
  return notification.type === "inventory" && Number(notification.metadata.stock) >= 20;
};

const sortNotifications = (notifications: AppNotification[]) =>
  [...notifications].sort((left, right) => {
    const leftUrgent = left.metadata.urgent === true ? 1 : 0;
    const rightUrgent = right.metadata.urgent === true ? 1 : 0;
    if (leftUrgent !== rightUrgent) return rightUrgent - leftUrgent;
    const leftActive = notificationCanDismiss(left) ? 0 : 1;
    const rightActive = notificationCanDismiss(right) ? 0 : 1;
    if (leftActive !== rightActive) return rightActive - leftActive;
    const leftUnread = left.readAt ? 0 : 1;
    const rightUnread = right.readAt ? 0 : 1;
    if (leftUnread !== rightUnread) return rightUnread - leftUnread;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

const localDateKey = (value: string) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [error, setError] = useState("");
  const [urgent, setUrgent] = useState<AppNotification | null>(null);
  const [suppressUrgent, setSuppressUrgent] = useState(false);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const urgentShownKey = `plmun-urgent-shown-${user.id}`;
  const dismissedUrgentKey = `plmun-dismissed-urgent-${user.id}`;
  const getDismissedUrgentIds = () => {
    try {
      return JSON.parse(window.localStorage.getItem(dismissedUrgentKey) ?? "[]") as string[];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await getNotifications();
        if (!active) return;
        setNotifications(sortNotifications(result.notifications));
        setUnreadCount(result.unreadCount);
        setError("");
        const popupAlreadyShown = window.sessionStorage.getItem(urgentShownKey) === "true";
        if (user.role === "student" && !popupAlreadyShown) {
          const dismissedIds = getDismissedUrgentIds();
          const nextUrgent = result.notifications.find(
            (notification) =>
              !notification.readAt &&
              notification.metadata.urgent === true &&
              !dismissedIds.includes(notification.id),
          );
          if (nextUrgent) {
            window.sessionStorage.setItem(urgentShownKey, "true");
            setUrgent((current) => current ?? nextUrgent);
          }
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
  }, [dismissedUrgentKey, urgentShownKey, user.role]);

  const readNotification = async (notification: AppNotification, navigate = true) => {
    if (!notification.readAt) {
      try {
        const updated = await markNotificationRead(notification.id);
        setNotifications((current) =>
          sortNotifications(
            current.map((item) =>
              item.id === updated.id ? { ...updated, canDismiss: item.canDismiss } : item,
            ),
          ),
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
      const dismissedIds = getDismissedUrgentIds();
      window.localStorage.setItem(
        dismissedUrgentKey,
        JSON.stringify([...new Set([...dismissedIds, urgent.id])]),
      );
    }
    setUrgent(null);
    setSuppressUrgent(false);
  };

  const reviewUrgent = async () => {
    if (!urgent) return;
    if (suppressUrgent) {
      const dismissedIds = getDismissedUrgentIds();
      window.localStorage.setItem(
        dismissedUrgentKey,
        JSON.stringify([...new Set([...dismissedIds, urgent.id])]),
      );
    }
    await readNotification(urgent);
    setSuppressUrgent(false);
  };

  const markAllRead = async () => {
    setNotificationBusy(true);
    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        sortNotifications(
          current.map((notification) => ({
            ...notification,
            readAt: notification.readAt ?? readAt,
          })),
        ),
      );
      setUnreadCount(0);
      setUrgent(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Notifications could not be updated.");
    } finally {
      setNotificationBusy(false);
    }
  };

  const removeNotification = async (notification: AppNotification) => {
    if (!notificationCanDismiss(notification)) return;
    setNotifications((current) => current.filter((item) => item.id !== notification.id));
    if (!notification.readAt) setUnreadCount((current) => Math.max(0, current - 1));
    if (urgent?.id === notification.id) setUrgent(null);
    setError("");
    try {
      await deleteNotification(notification.id);
    } catch (reason) {
      try {
        const result = await getNotifications();
        setNotifications(sortNotifications(result.notifications));
        setUnreadCount(result.unreadCount);
      } catch {
        setNotifications((current) =>
          sortNotifications(
            current.some((item) => item.id === notification.id)
              ? current
              : [...current, notification],
          ),
        );
        if (!notification.readAt) setUnreadCount((current) => current + 1);
      }
      setError(
        reason instanceof Error ? reason.message : "Notification could not be removed. Try again.",
      );
    }
  };

  const notificationIcon = (notification: AppNotification) => {
    if (notification.type === "inventory") {
      const isOutOfStock = Number(notification.metadata.stock) <= 0;
      return <Boxes size={16} className={isOutOfStock ? "icon-danger" : "icon-warning"} />;
    }
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
                  <p className="mt-1 text-[9px] font-medium text-[#87928b]">
                    Notifications are erased after 30 days.
                  </p>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    disabled={notificationBusy}
                    className="hidden sm:inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-[10px] font-bold text-[#285c43] hover:bg-[#eaf1eb] disabled:opacity-60"
                  >
                    {notificationBusy && (
                      <RefreshCw size={12} className="animate-spin" aria-hidden="true" />
                    )}
                    Mark all as read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="sm:hidden grid size-9 shrink-0 place-items-center rounded-lg text-[#68766e] hover:bg-[#edf1ec]"
                  aria-label="Close notifications"
                >
                  <X size={18} />
                </button>
              </header>
              <div className="overflow-y-auto">
                {notifications.map((notification) => {
                  const canDismiss = notificationCanDismiss(notification);
                  const isSwiped = swipedId === notification.id;
                  
                  return (
                    <article
                      key={notification.id}
                      className={`notification-item group relative min-h-24 w-full border-b border-[#e7eae5] text-left transition ${
                        notification.readAt ? "bg-white" : "bg-[#f0f6ef]"
                      } overflow-hidden`}
                    >
                      {/* Delete button background (revealed on swipe) */}
                      {canDismiss && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void removeNotification(notification);
                            setSwipedId(null);
                          }}
                          className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-[#a13f32] sm:hidden"
                          aria-label={`Delete ${notification.title}`}
                        >
                          <Trash2 size={20} className="text-white" />
                        </button>
                      )}
                      
                      {/* Swipeable content */}
                      <div
                        className={`relative bg-inherit transition-transform duration-300 sm:transform-none ${
                          isSwiped && canDismiss ? "-translate-x-20" : "translate-x-0"
                        }`}
                        onTouchStart={(e) => {
                          if (window.innerWidth >= 640 || !canDismiss) return; // Only on mobile with dismissible notifications
                          const touch = e.touches[0];
                          if (!touch) return;
                          const startX = touch.clientX;
                          const startY = touch.clientY;
                          let hasMoved = false;

                          const onTouchMove = (moveEvent: TouchEvent) => {
                            const moveTouch = moveEvent.touches[0];
                            if (!moveTouch) return;
                            const deltaX = startX - moveTouch.clientX;
                            const deltaY = Math.abs(startY - moveTouch.clientY);
                            
                            // If moving horizontally more than vertically, it's a swipe
                            if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > deltaY) {
                              hasMoved = true;
                            }
                          };

                          const onTouchEnd = (endEvent: TouchEvent) => {
                            const endTouch = endEvent.changedTouches[0];
                            if (!endTouch) return;
                            
                            const deltaX = startX - endTouch.clientX;
                            const deltaY = Math.abs(startY - endTouch.clientY);
                            
                            // Swipe left to reveal delete (deltaX > 0)
                            if (deltaX > 50 && deltaY < 50 && hasMoved) {
                              setSwipedId(notification.id);
                            } 
                            // Swipe right to hide delete (deltaX < 0)
                            else if (deltaX < -50 && deltaY < 50 && hasMoved) {
                              setSwipedId(null);
                            }
                            
                            document.removeEventListener("touchmove", onTouchMove);
                            document.removeEventListener("touchend", onTouchEnd);
                          };

                          document.addEventListener("touchmove", onTouchMove, { passive: true });
                          document.addEventListener("touchend", onTouchEnd, { passive: true });
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            if (isSwiped) {
                              e.preventDefault();
                              e.stopPropagation();
                              setSwipedId(null);
                              return;
                            }
                            readNotification(notification);
                          }}
                          className="flex min-h-24 w-full gap-3 p-4 pr-12 text-left"
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
                        <button
                          type="button"
                          onClick={() => void removeNotification(notification)}
                          disabled={!canDismiss}
                          className="absolute right-2.5 top-2.5 hidden sm:grid size-8 place-items-center rounded-lg text-[#849087] opacity-0 transition hover:bg-[#dfe7df] hover:text-[#315140] focus:opacity-100 group-hover:opacity-100 disabled:text-[#b7beb9] disabled:hover:bg-transparent"
                          aria-label={
                            canDismiss
                              ? `Permanently remove ${notification.title}`
                              : `${notification.title} cannot be removed until it is resolved`
                          }
                          title={
                            canDismiss
                              ? "Permanently remove notification"
                              : "This notification can be removed after it is resolved"
                          }
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </article>
                  );
                })}
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
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0b0d0e]/65 p-4 backdrop-blur-sm">
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
                Don’t remind me again.
              </label>
              <div className="responsive-cta-group mt-5">
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
  loading = false,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  kind?: "primary" | "secondary" | "warning" | "info" | "ghost";
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
}) {
  const styles =
    kind === "primary"
      ? "bg-[#184d37] text-white hover:bg-[#103d2b] shadow-sm"
      : kind === "secondary"
        ? "border border-[#bdc7bc] bg-white text-[#173d2f] hover:border-[#184d37]"
        : kind === "warning"
          ? "border border-[#d5ad3f] bg-[#f4c95d] text-[#493a12] hover:bg-[#e8b93f] shadow-sm"
          : kind === "info"
            ? "border border-[#9bbcc8] bg-[#eaf3f6] text-[#285c70] hover:bg-[#dcecf1] shadow-sm"
            : "text-[#476053] hover:bg-[#edf0e8]";
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      aria-busy={loading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-all duration-200 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {loading && <RefreshCw size={14} className="shrink-0 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

function ClearFiltersButton({
  disabled,
  onClick,
  label = "Clear filters",
}: {
  disabled: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="filter-clear-button"
      aria-label={label}
      title={label}
    >
      <Trash2 size={16} />
    </button>
  );
}

type FeedbackTone = "success" | "error" | "info";

function FeedbackToast({
  message,
  tone = "success",
  onClose,
}: {
  message: string;
  tone?: FeedbackTone;
  onClose: () => void;
}) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const timeout = window.setTimeout(() => onCloseRef.current(), 4500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? XCircle : Bell;
  return createPortal(
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`fixed bottom-5 right-4 z-[150] flex w-[min(420px,calc(100vw-2rem))] items-start gap-3 rounded-xl border bg-white p-4 shadow-[0_20px_60px_rgba(18,43,31,.25)] sm:bottom-6 sm:right-6 ${
        tone === "error"
          ? "border-[#dfb9b0]"
          : tone === "success"
            ? "border-[#bfd1c0]"
            : "border-[#c7d4d9]"
      }`}
    >
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-lg ${
          tone === "error" ? "bg-[#fbefeb]" : tone === "success" ? "bg-[#eaf2e8]" : "bg-[#eaf1f4]"
        }`}
      >
        <Icon
          size={17}
          className={
            tone === "error" ? "icon-danger" : tone === "success" ? "icon-success" : "icon-info"
          }
        />
      </span>
      <p className="min-w-0 flex-1 text-xs font-medium leading-5 text-[#385044] flex items-center">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-[#718078] hover:bg-[#edf1ec]"
        aria-label="Dismiss message"
      >
        <X size={15} />
      </button>
    </div>,
    document.body,
  );
}

type ConfirmationConfig = {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
};

function ConfirmationDialog({
  config,
  busy = false,
  onClose,
}: {
  config: ConfirmationConfig | null;
  busy?: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!config) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [busy, config, onClose]);

  if (!config) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[140] grid place-items-center bg-[#0b0d0e]/65 p-4 backdrop-blur-sm"
      onMouseDown={() => !busy && onClose()}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-description"
        className="w-full max-w-md rounded-2xl border border-white/20 bg-white p-6 shadow-[0_30px_100px_rgba(0,0,0,.4)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span
          className={`grid size-11 place-items-center rounded-xl ${
            config.destructive ? "bg-[#fbefeb]" : "bg-[#eaf2e8]"
          }`}
        >
          {config.destructive ? (
            <AlertTriangle size={20} className="icon-danger" />
          ) : (
            <CheckCircle2 size={20} className="icon-success" />
          )}
        </span>
        <h2 id="confirmation-dialog-title" className="mt-4 text-xl font-semibold text-[#253f33]">
          {config.title}
        </h2>
        <p id="confirmation-dialog-description" className="mt-2 text-sm leading-6 text-[#5f6d65]">
          {config.message}
        </p>
        <div className="responsive-cta-group mt-6">
          <button
            type="button"
            disabled={busy}
            onClick={() => void config.onConfirm()}
            autoFocus
            className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 py-2.5 text-xs font-semibold text-white transition disabled:opacity-50 sm:w-auto ${
              config.destructive
                ? "bg-[#98483b] hover:bg-[#7e382e]"
                : "bg-[#184d37] hover:bg-[#103d2b]"
            }`}
          >
            {busy && <RefreshCw size={14} className="mr-2 animate-spin" aria-hidden="true" />}
            {busy ? "Please wait…" : config.confirmLabel}
          </button>
          <Button kind="secondary" onClick={onClose} disabled={busy} className="w-full sm:w-auto">
            Cancel
          </Button>
        </div>
      </section>
    </div>,
    document.body,
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
          <nav className="ml-auto hidden h-full items-center gap-1 lg:flex">
            {navByRole.student.map((item) => (
              <button
                key={item}
                onClick={() => setPage(item)}
                aria-current={page === item ? "page" : undefined}
                className={`h-full border-b-2 px-2.5 text-xs font-semibold transition-colors ${page === item ? "border-[#184d37] text-[#184d37]" : "border-transparent text-[#687168] hover:text-[#184d37]"}`}
              >
                {item}
              </button>
            ))}
          </nav>
        )}
        <div
          className={`flex shrink-0 items-center gap-1.5 sm:gap-2 ${
            role === "student" ? "ml-auto lg:ml-0" : "ml-auto"
          }`}
        >
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
            className="mobile-menu-backdrop fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#0b0d0e]/60 p-4 backdrop-blur-sm lg:hidden"
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
                      aria-current={page === item ? "page" : undefined}
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
              aria-current={page === item ? "page" : undefined}
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
    <div className="section-title mb-5 flex flex-wrap items-end justify-between gap-3">
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
          loading="lazy"
          decoding="async"
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
      <section className="student-hero animate-enter relative mb-12 overflow-hidden rounded-[24px] border border-white/60 bg-[#e7eadf] shadow-[0_20px_50px_rgba(31,62,46,.08)]">
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
                <ShieldCheck size={14} className="icon-success" /> Reliable
              </span>
            </div>
          </div>
          <div className="relative hidden min-h-[440px] overflow-hidden lg:block">
            <img
              src="/assets/stationery.jpg"
              alt="Notebook and pen on a desk"
              decoding="async"
              fetchPriority="high"
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
      <div className="catalog-filters mb-6">
        <label className="filter-search block w-full">
          <span className="sr-only">{serviceOnly ? "Search services" : "Search products"}</span>
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8b958d]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={serviceOnly ? "Search services" : "Search products"}
            className="filter-control pl-9"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`min-h-11 rounded-full px-3.5 py-2 text-[11px] font-semibold transition ${category === c ? "bg-[#184d37] text-white shadow-sm" : "border border-[#d7ddd3] bg-white text-[#56655d] hover:border-[#8fa191]"}`}
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
  cart: Cart;
  setCart: React.Dispatch<React.SetStateAction<Cart>>;
  setPage: (p: string) => void;
}) {
  const { products, loading } = useProductStore();
  useEffect(() => {
    if (loading) return;
    setCart((current) => {
      let changed = false;
      const next: Cart = {};
      for (const [key, line] of Object.entries(current)) {
        const product = products.find((candidate) => candidate.id === line.productId);
        const variation = line.variationId
          ? product?.variations?.find((candidate) => candidate.id === line.variationId)
          : null;
        const stock = variation?.stock ?? product?.stock ?? 0;
        if (
          !product ||
          (product.productType === "variable" && (!variation || !variation.active)) ||
          stock <= 0
        ) {
          changed = true;
          continue;
        }
        const quantity = Math.min(line.quantity, stock);
        const updated: CartLine = {
          ...line,
          quantity,
          unitPrice: variation?.price ?? product.price,
          variationValues: variation?.values ?? line.variationValues,
          variationLabel: variation ? variationLabel(variation.values) : null,
        };
        if (
          quantity !== line.quantity ||
          updated.unitPrice !== line.unitPrice ||
          updated.variationLabel !== line.variationLabel
        ) {
          changed = true;
        }
        next[key] = updated;
      }
      return changed ? next : current;
    });
  }, [loading, products, setCart]);
  const lines = Object.entries(cart)
    .map(([key, line]) => {
      const product = products.find((candidate) => candidate.id === line.productId);
      const variation = line.variationId
        ? product?.variations?.find((candidate) => candidate.id === line.variationId)
        : null;
      return product
        ? {
            ...product,
            ...line,
            key,
            stock: variation?.stock ?? product.stock,
            unitPrice: variation?.price ?? product.price,
            image: variation?.image || product.image,
          }
        : null;
    })
    .filter(Boolean) as Array<Product & CartLine & { key: string }>;
  const total = lines.reduce((sum, p) => sum + p.unitPrice * p.quantity, 0);
  const change = (key: string, delta: number) =>
    setCart((current) => {
      const nextQuantity = Math.max(0, current[key].quantity + delta);
      if (!nextQuantity) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: { ...current[key], quantity: nextQuantity } };
    });
  return (
    <>
      <SectionTitle title="Shopping cart" subtitle="Review your order before checkout." />
      <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
        <div className="rounded-lg border border-[#dde2d8] bg-white">
          {lines.length ? (
            lines.map((p, i) => (
              <div
                key={p.key}
                className={`flex flex-wrap items-center gap-4 p-4 ${i ? "border-t border-[#e6e8e2]" : ""}`}
              >
                <img
                  src={p.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-16 rounded-md object-cover"
                />
                <div className="min-w-[180px] flex-1">
                  <div className="text-sm font-semibold text-[#1b4334]">{p.name}</div>
                  {p.variationLabel && (
                    <div className="mt-1 text-[10px] font-semibold text-[#607068]">
                      {p.variationLabel}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-[#889188]">{peso(p.unitPrice)} each</div>
                </div>
                <div className="flex items-center rounded-md border border-[#d9ded5]">
                  <button
                    type="button"
                    onClick={() => change(p.key, -1)}
                    className="grid size-11 place-items-center"
                    aria-label={`Decrease ${p.name} quantity`}
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-xs">{p.quantity}</span>
                  <button
                    onClick={() => change(p.key, 1)}
                    disabled={p.quantity >= p.stock}
                    className="grid size-11 place-items-center disabled:opacity-35"
                    aria-label={`Increase ${p.name} quantity`}
                  >
                    +
                  </button>
                </div>
                <div className="w-20 text-right text-xs font-bold">
                  {peso(p.unitPrice * p.quantity)}
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
  user,
  onOrderCreated,
}: {
  cart: Cart;
  setCart: React.Dispatch<React.SetStateAction<Cart>>;
  setPage: (p: string) => void;
  user: AuthUser;
  onOrderCreated: (order: OnlineOrder) => void;
}) {
  const { products } = useProductStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lines = Object.entries(cart)
    .map(([key, line]) => {
      const product = products.find((candidate) => candidate.id === line.productId);
      return product ? { ...product, ...line, key } : null;
    })
    .filter(Boolean) as Array<Product & CartLine & { key: string }>;
  const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const defaultPickupDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const order = await createOnlineOrder({
        items: lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          variationId: line.variationId,
        })),
        pickupDate: String(form.get("pickupDate") ?? ""),
        pickupWindow: String(form.get("pickupWindow") ?? ""),
        notes: String(form.get("notes") ?? ""),
      });
      onOrderCreated(order);
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
                <input value={user.name} readOnly />
              </label>
              <label className="field">
                Student ID
                <input value={user.reference} readOnly />
              </label>
              <label className="field sm:col-span-2">
                Email address
                <input type="email" value={user.email} readOnly />
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
            {lines.map((line) => (
              <div key={line.key} className="flex justify-between text-[#657068]">
                <span>
                  {line.quantity}× {line.name}
                  {line.variationLabel ? ` · ${line.variationLabel}` : ""}
                </span>
                <span>{peso(line.unitPrice * line.quantity)}</span>
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
          <Button type="submit" loading={saving} className="mt-5 w-full">
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
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  useEffect(() => {
    getOrders()
      .then(setOnlineOrders)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "We couldn’t load your orders."),
      )
      .finally(() => setLoading(false));
  }, []);
  const filteredOrders = onlineOrders.filter((order) => {
    const search = query.trim().toLowerCase();
    const resolved = order.status === "Completed" || order.status === "Cancelled";
    const searchable = `${order.id} ${order.status} ${order.items
      .map((item) => item.name)
      .join(" ")}`.toLowerCase();
    return (
      (!search || searchable.includes(search)) &&
      (statusFilter === "All" || order.status === statusFilter) &&
      (!dateFilter || localDateKey(resolved ? order.updatedAt : order.createdAt) === dateFilter)
    );
  });
  const activeOrders = filteredOrders.filter(
    (order) => order.status !== "Completed" && order.status !== "Cancelled",
  );
  const orderHistory = filteredOrders.filter(
    (order) => order.status === "Completed" || order.status === "Cancelled",
  );
  const viewOrder = (order: OnlineOrder) => {
    window.sessionStorage.setItem("plmun-selected-order", order.id);
    setPage("Order detail");
  };

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
      <div className="filter-toolbar mb-5">
        <label className="filter-search">
          <span className="sr-only">Search orders</span>
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7c8981]"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search order number or item"
            className="filter-control pl-9"
          />
        </label>
        <label>
          <span className="sr-only">Filter orders by date</span>
          <input
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="filter-control px-3"
            aria-label="Filter orders by date"
          />
        </label>
        <label>
          <span className="sr-only">Filter orders by status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="filter-control px-3"
          >
            <option>All</option>
            {[
              "Pending review",
              "Confirmed",
              "Awaiting restock",
              "Ready for pickup",
              "Completed",
              "Cancelled",
            ].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <ClearFiltersButton
          disabled={!query && statusFilter === "All" && !dateFilter}
          onClick={() => {
            setQuery("");
            setStatusFilter("All");
            setDateFilter("");
          }}
        />
      </div>
      <h2 className="mb-3 text-sm font-semibold text-[#29483a]">Active orders</h2>
      <div className="space-y-3 md:hidden">
        {activeOrders.map((order) => (
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
            <div className="mt-4 flex flex-col gap-2 border-t border-[#e2e6de] pt-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-semibold text-[#294c3d]">{peso(order.total)}</span>
              <div className="flex flex-col gap-2 sm:flex-row">
                {order.status === "Ready for pickup" && (
                  <span className="rounded-lg border border-[#d8ded6] bg-[#f4f7f2] px-3 py-2.5 text-[10px] font-semibold text-[#5f6d65]">
                    Staff will confirm receipt at pickup
                  </span>
                )}
                <Button kind="secondary" onClick={() => viewOrder(order)} className="min-h-10">
                  View order
                </Button>
              </div>
            </div>
          </article>
        ))}
        {!loading && !activeOrders.length && (
          <div className="rounded-xl border border-dashed border-[#ccd4ca] bg-white/60 py-12 text-center text-sm text-[#7e8881]">
            {onlineOrders.length && (query || statusFilter !== "All" || dateFilter)
              ? "No active orders match these filters."
              : "You have no active orders."}
          </div>
        )}
      </div>
      <div className="hidden overflow-hidden rounded-xl border border-[#dde1d8] bg-white md:block">
        <div className="table-wrap max-h-[460px] overflow-y-auto">
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
              {activeOrders.map((order) => (
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
                    <div className="flex justify-end gap-2">
                      {order.status === "Ready for pickup" && (
                        <span className="rounded-lg border border-[#d8ded6] bg-[#f4f7f2] px-3 py-2.5 text-[10px] font-semibold text-[#5f6d65]">
                          Staff confirms receipt
                        </span>
                      )}
                      <Button kind="secondary" onClick={() => viewOrder(order)}>
                        View
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !activeOrders.length && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-[#879087]">
                    {onlineOrders.length && (query || statusFilter !== "All" || dateFilter)
                      ? "No active orders match these filters."
                      : "You have no active orders."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-[#29483a]">Order history</h2>
        <div className="max-h-[360px] overflow-y-auto rounded-xl border border-[#dde1d8] bg-white">
          {orderHistory.map((order, index) => (
            <button
              key={order.id}
              onClick={() => viewOrder(order)}
              className={`flex min-h-16 w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-[#f2f5f0] ${
                index ? "border-t border-[#e5e8e2]" : ""
              }`}
            >
              <span>
                <span className="block text-xs font-semibold text-[#29483a]">{order.id}</span>
                <span className="mt-1 block text-[10px] text-[#6f7c74]">
                  {new Date(order.updatedAt).toLocaleDateString()} · {peso(order.total)}
                </span>
              </span>
              <Pill tone={order.status === "Cancelled" ? "gray" : "green"}>{order.status}</Pill>
            </button>
          ))}
          {!loading && !orderHistory.length && (
            <div className="py-10 text-center text-xs text-[#758078]">
              {onlineOrders.length && (query || statusFilter !== "All" || dateFilter)
                ? "No order history matches these filters."
                : "Completed and cancelled orders will appear here."}
            </div>
          )}
        </div>
      </section>
      {loading && <div className="mt-4 text-xs text-[#7d857e]">Loading your orders…</div>}
    </>
  );
}

function OrderDetailPage() {
  const [order, setOrder] = useState<OnlineOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selectedId = window.sessionStorage.getItem("plmun-selected-order");
  useEffect(() => {
    getOrders()
      .then((items) => setOrder(items.find((item) => item.id === selectedId) ?? items[0] ?? null))
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "The order could not be loaded."),
      )
      .finally(() => setLoading(false));
  }, [selectedId]);
  if (loading) return <div className="py-12 text-center text-xs">Loading order…</div>;
  if (!order)
    return (
      <div className="rounded-xl border border-[#dfc6bd] bg-[#fbefeb] p-5 text-sm text-[#8b4333]">
        {error || "This order could not be found."}
      </div>
    );
  const stages = ["Pending review", "Confirmed", "Ready for pickup", "Completed"];
  const stageIndex =
    order.status === "Awaiting restock"
      ? 1
      : order.status === "Cancelled"
        ? 0
        : Math.max(0, stages.indexOf(order.status));
  return (
    <>
      <SectionTitle title={`Order ${order.id}`} subtitle={order.statusMessage} />
      <section className="rounded-2xl border border-[#dce2da] bg-white p-5 sm:p-7">
        {error && (
          <div className="mb-5 rounded-xl border border-[#dfc6bd] bg-[#fbefeb] p-4 text-xs text-[#8b4333]">
            {error}
          </div>
        )}
        {order.status === "Cancelled" && (
          <div className="mb-6 rounded-xl border border-[#dfb9b0] bg-[#fbefeb] p-4 text-xs text-[#844337]">
            This order was cancelled. Contact the Business Center if you need assistance.
          </div>
        )}
        {order.status === "Awaiting restock" && (
          <div className="mb-6 rounded-xl border border-[#decf96] bg-[#faf5df] p-4 text-xs text-[#685a22]">
            This order is waiting for stock. The Business Center will update it when items become
            available.
          </div>
        )}
        <div className="relative grid grid-cols-4 gap-1">
          <div className="absolute left-[12.5%] right-[12.5%] top-4 h-0.5 bg-[#dce2dc]" />
          <div
            className="absolute left-[12.5%] top-4 h-0.5 bg-[#397458] transition-all"
            style={{ width: `${Math.min(stageIndex, 3) * 25}%` }}
          />
          {stages.map((stage, index) => {
            const complete = index < stageIndex || order.status === "Completed";
            const current = index === stageIndex && order.status !== "Completed";
            return (
              <div key={stage} className="relative text-center">
                <span
                  className={`mx-auto grid size-8 place-items-center rounded-full border-2 text-[10px] font-bold ${
                    complete
                      ? "border-[#397458] bg-[#397458] text-white"
                      : current
                        ? "border-[#397458] bg-white text-[#285c43]"
                        : "border-[#cdd5ce] bg-white text-[#8a958e]"
                  }`}
                >
                  {complete ? "✓" : index + 1}
                </span>
                <span className="mt-2 block text-[9px] font-semibold leading-4 text-[#526159]">
                  {stage}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-8 grid gap-4 border-t border-[#e2e6df] pt-5 md:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold text-[#29483a]">Order items</h2>
            <div className="mt-3 space-y-2 text-xs text-[#5f6d65]">
              {order.items.map((item) => (
                <div key={item.productId} className="flex justify-between gap-3">
                  <span>
                    {item.quantity}× {item.name}
                    {item.size ? ` · Size ${item.size}` : ""}
                  </span>
                  <span>{peso(item.quantity * item.price)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 font-bold text-[#29483a]">
                <span>Total</span>
                <span>{peso(order.total)}</span>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-[#f4f7f2] p-4 text-xs leading-6 text-[#5f6d65]">
            Pickup date: {order.pickupDate || "To be confirmed"}
            <br />
            Pickup window: {order.pickupWindow || "To be confirmed"}
            <br />
            Status: <strong>{order.status}</strong>
          </div>
        </div>
        {order.status === "Ready for pickup" && (
          <div className="mt-5 rounded-xl border border-[#d7dfd7] bg-[#f4f7f2] p-4 text-xs leading-5 text-[#53645b]">
            Present your order number at the counter. Staff will mark the order as received after
            handing it to you.
          </div>
        )}
      </section>
    </>
  );
}

function Stats({
  role,
  onlineOrders,
  reports,
  products,
}: {
  role: Role;
  onlineOrders: OnlineOrder[];
  reports: AdminReportData | null;
  products: Product[];
}) {
  const loading = role === "admin" && !reports;
  
  const cards =
    role === "staff"
      ? [
          [
            "Active online orders",
            onlineOrders.filter(
              (order) => order.status !== "Completed" && order.status !== "Cancelled",
            ).length,
            "count",
          ],
          [
            "Awaiting review",
            onlineOrders.filter((order) => order.status === "Pending review").length,
            "count",
          ],
          [
            "Stock conflicts",
            onlineOrders.filter((order) => order.status === "Awaiting restock").length,
            "count",
          ],
          [
            "Ready for pickup",
            onlineOrders.filter((order) => order.status === "Ready for pickup").length,
            "count",
          ],
        ]
      : [
          ["Recorded sales", reports?.summary.totalSales ?? 0, "currency"],
          ["Transactions", reports?.summary.transactionCount ?? 0, "count"],
          ["Active products", products.length, "count"],
          ["Low-stock items", products.filter((product) => product.stock < 20).length, "count"],
        ];
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value, type]) => (
        <div key={label as string} className="rounded-lg border border-[#dfe3da] bg-white p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#879087]">
            {label as string}
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-[-.03em] text-[#173f30]">
            {loading ? (
              <Skeleton width="60%" height="2rem" />
            ) : type === "currency" ? (
              <AnimatedCurrency value={value as number} />
            ) : (
              <AnimatedCounter value={value as number} />
            )}
          </div>
          <div className="mt-2 text-[10px] text-[#718078]">Current recorded data</div>
        </div>
      ))}
    </div>
  );
}

function AdminReportsPage() {
  const [data, setData] = useState<AdminReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [feedback, setFeedback] = useState<{ message: string; tone: FeedbackTone } | null>(null);
  const load = async (showFeedback = false) => {
    setLoading(true);
    try {
      setData(await getAdminReports());
      setError("");
      if (showFeedback) setFeedback({ message: "Reports refreshed.", tone: "success" });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Reports could not be loaded.";
      setError(message);
      if (showFeedback) setFeedback({ message, tone: "error" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const filteredTransactions =
    data?.transactions.filter((transaction) => {
      const search = query.trim().toLowerCase();
      const searchable = `${transaction.id} ${transaction.source} ${transaction.orderId ?? ""} ${(
        transaction.items ?? []
      )
        .map((item) => `${item.productName} ${item.variationLabel ?? ""}`)
        .join(" ")}`;
      return (
        (!search || searchable.toLowerCase().includes(search)) &&
        (sourceFilter === "All" || transaction.source === sourceFilter) &&
        (!dateFilter || localDateKey(transaction.createdAt) === dateFilter)
      );
    }) ?? [];
  const exportTransactions = () => {
    if (!filteredTransactions.length) return;
    const rows = [
      ["Transaction", "Source", "Items", "Products", "Total", "Date"],
      ...filteredTransactions.map((transaction) => [
        transaction.id,
        transaction.source,
        String(transaction.itemCount),
        (transaction.items ?? [])
          .map(
            (item) =>
              `${item.productName}${item.variationLabel ? ` (${item.variationLabel})` : ""} × ${item.quantity}`,
          )
          .join("; "),
        transaction.total.toFixed(2),
        new Date(transaction.createdAt).toLocaleString(),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "business-center-transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <SectionTitle
        title="Sales & transactions"
        subtitle="Audit completed sales, review purchased items, and export transaction records."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button kind="secondary" onClick={() => void load(true)} loading={loading}>
              Refresh
            </Button>
            <Button disabled={!filteredTransactions.length} onClick={exportTransactions}>
              Export transactions
            </Button>
          </div>
        }
      />
      {error && (
        <div className="mb-5 rounded-xl border border-[#dfc6bd] bg-[#fbefeb] p-4">
          <p className="text-xs text-[#8b4333]">{error}</p>
          <p className="mt-2 text-xs text-[#a86155]">
            If this persists, the backend may not be deployed yet. Contact your system
            administrator.
          </p>
        </div>
      )}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Recorded sales", data.summary.totalSales, "currency"],
              ["Transactions", data.summary.transactionCount, "count"],
              ["Walk-in sales", data.summary.walkInSales, "currency"],
              ["Online sales", data.summary.onlineSales, "currency"],
            ].map(([label, value, type]) => (
              <article key={label as string} className="rounded-xl border border-[#dfe3da] bg-white p-5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#6f7c74]">
                  {label as string}
                </div>
                <div className="mt-3 text-2xl font-semibold text-[#173f30]">
                  {type === "currency" ? (
                    <AnimatedCurrency value={value as number} />
                  ) : (
                    <AnimatedCounter value={value as number} />
                  )}
                </div>
              </article>
            ))}
          </div>
          <div className="mt-5">
            <section className="overflow-hidden rounded-xl border border-[#dce1d7] bg-white">
              <div className="border-b border-[#e3e6e1] p-4">
                <h2 className="text-sm font-semibold text-[#29483a]">Recent transactions</h2>
                <div className="filter-toolbar filter-toolbar-compact mt-3">
                  <label className="filter-search">
                    <span className="sr-only">Search transactions</span>
                    <Search
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7c8981]"
                    />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search reference or order"
                      className="filter-control pl-9"
                    />
                  </label>
                  <label>
                    <span className="sr-only">Filter transactions by date</span>
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(event) => setDateFilter(event.target.value)}
                      className="filter-control px-3"
                      aria-label="Filter transactions by date"
                    />
                  </label>
                  <label>
                    <span className="sr-only">Filter by transaction source</span>
                    <select
                      value={sourceFilter}
                      onChange={(event) => setSourceFilter(event.target.value)}
                      className="filter-control px-3"
                    >
                      <option>All</option>
                      <option value="walk-in">Walk-in</option>
                      <option value="online">Online</option>
                    </select>
                  </label>
                  <ClearFiltersButton
                    disabled={!query && sourceFilter === "All" && !dateFilter}
                    onClick={() => {
                      setQuery("");
                      setSourceFilter("All");
                      setDateFilter("");
                    }}
                  />
                </div>
              </div>
              <div className="table-wrap max-h-[440px] overflow-y-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Source</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <SkeletonTableRow key={i} columns={5} />
                      ))
                    ) : (
                      <>
                        {filteredTransactions.map((transaction) => (
                          <tr key={transaction.id}>
                            <td data-label="Reference" className="font-semibold">
                              {transaction.id}
                              <span className="mt-1 block max-w-sm text-[10px] font-normal leading-4 text-[#6f7c74]">
                                {(transaction.items ?? [])
                                  .map(
                                    (item) =>
                                      `${item.productName}${item.variationLabel ? ` · ${item.variationLabel}` : ""} × ${item.quantity}`,
                                  )
                                  .join(", ")}
                              </span>
                            </td>
                            <td data-label="Source" className="capitalize">
                              {transaction.source}
                            </td>
                            <td data-label="Items">{transaction.itemCount}</td>
                            <td data-label="Total">{peso(transaction.total)}</td>
                            <td data-label="Date">
                              {new Date(transaction.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                        {!loading && !filteredTransactions.length && (
                          <tr>
                            <td colSpan={5} className="py-10 text-center">
                              {data && data.transactions.length
                                ? "No transactions match these filters."
                                : "No completed transactions yet."}
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
      {loading && <div className="py-12 text-center text-xs">Loading reports…</div>}
      {feedback && (
        <FeedbackToast
          message={feedback.message}
          tone={feedback.tone}
          onClose={() => setFeedback(null)}
        />
      )}
    </>
  );
}

function Dashboard({
  role,
  userName,
  setPage,
}: {
  role: Role;
  userName: string;
  setPage: (p: string) => void;
}) {
  const { products } = useProductStore();
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>([]);
  const [reports, setReports] = useState<AdminReportData | null>(null);
  useEffect(() => {
    if (role === "staff") {
      getOrders().then(setOnlineOrders).catch(console.error);
    } else {
      getAdminReports().then(setReports).catch(console.error);
    }
  }, [role]);
  return (
    <>
      <SectionTitle
        title={role === "staff" ? "Staff dashboard" : "Administrator dashboard"}
        subtitle={`Welcome back, ${userName}. Here’s what’s happening ${role === "staff" ? "today" : "across the center"}.`}
        action={
          role === "admin" ? (
            <Button onClick={() => setPage("Sales & transactions")}>View sales</Button>
          ) : undefined
        }
      />
      <Stats role={role} onlineOrders={onlineOrders} reports={reports} products={products} />
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
                    {onlineOrders.slice(0, 3).map((o) => (
                      <tr key={o.id}>
                        <td>{o.id}</td>
                        <td>{o.customerName}</td>
                        <td>{peso(o.total)}</td>
                        <td>
                          <Pill tone={o.status === "Awaiting restock" ? "amber" : "green"}>
                            {o.status}
                          </Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 md:hidden">
                {onlineOrders.slice(0, 3).map((order) => (
                  <article
                    key={order.id}
                    className="rounded-xl border border-[#dfe3da] bg-[#f8faf6] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#294c3d]">{order.id}</div>
                        <div className="mt-1 text-xs text-[#7d8780]">{order.customerName}</div>
                      </div>
                      <Pill tone={order.status === "Awaiting restock" ? "amber" : "green"}>
                        {order.status}
                      </Pill>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-[#e2e6de] pt-3">
                      <span className="text-xs text-[#7d8780]">
                        {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                      </span>
                      <span className="text-sm font-semibold text-[#294c3d]">
                        {peso(order.total)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-7 space-y-5">
              {[
                ["Walk-in sales", reports?.summary.walkInSales ?? 0],
                ["Online sales", reports?.summary.onlineSales ?? 0],
              ].map(([label, value]) => {
                const total = Math.max(reports?.summary.totalSales ?? 0, 1);
                return (
                  <div key={label as string}>
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="text-[#5f6d65]">{label as string}</span>
                      <span className="font-semibold">{peso(value as number)}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-[#e5e9e2]">
                      <div
                        className="h-full rounded-full bg-[#397458]"
                        style={{ width: `${Math.max(0, ((value as number) / total) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
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
                <img
                  src={p.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-9 rounded object-cover"
                />
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

type SaleLine = {
  productId: number;
  variationId: number | null;
  variationLabel: string | null;
  name: string;
  image: string;
  price: number;
  stock: number;
  quantity: number;
};

type Sale = Record<string, SaleLine>;

type CatalogSaleItem = Omit<SaleLine, "quantity"> & {
  key: string;
  category: string;
};

function ProductSelectionModal({
  products,
  currentSale,
  onAdd,
  onClose,
}: {
  products: Product[];
  currentSale: Sale;
  onAdd: (selection: Sale) => void;
  onClose: () => void;
}) {
  const [selection, setSelection] = useState<Sale>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [availability, setAvailability] = useState("All");
  const categories = ["All", ...new Set(products.map((product) => product.category))];
  const catalogItems = products.flatMap<CatalogSaleItem>((product) => {
    if (product.productType === "variable") {
      return (product.variations ?? [])
        .filter((variation) => variation.active)
        .map((variation) => ({
          key: `${product.id}:${variation.id}`,
          productId: product.id,
          variationId: variation.id ?? null,
          variationLabel: variationLabel(variation.values),
          name: product.name,
          category: product.category,
          image: variation.image || product.image,
          price: variation.price,
          stock: variation.stock,
        }));
    }
    return [
      {
        key: `${product.id}:simple`,
        productId: product.id,
        variationId: null,
        variationLabel: null,
        name: product.name,
        category: product.category,
        image: product.image,
        price: product.price,
        stock: product.stock,
      },
    ];
  });
  const shown = catalogItems.filter((item) => {
    const remaining = item.stock - (currentSale[item.key]?.quantity ?? 0);
    return (
      item.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      (category === "All" || item.category === category) &&
      (availability === "All" ||
        (availability === "Available" && remaining > 0) ||
        (availability === "Low stock" && remaining > 0 && remaining < 20) ||
        (availability === "Unavailable" && remaining <= 0))
    );
  });
  const selectedUnits = Object.values(selection).reduce((sum, line) => sum + line.quantity, 0);
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
  const adjust = (item: CatalogSaleItem, delta: number) => {
    const maximum = Math.max(0, item.stock - (currentSale[item.key]?.quantity ?? 0));
    setSelection((current) => {
      const quantity = Math.max(0, Math.min(maximum, (current[item.key]?.quantity ?? 0) + delta));
      if (!quantity) {
        const next = { ...current };
        delete next[item.key];
        return next;
      }
      return { ...current, [item.key]: { ...item, quantity } };
    });
  };
  return createPortal(
    <div
      className="pos-modal-backdrop fixed inset-0 z-[110] flex items-center justify-center bg-[#0b0d0e]/65 p-3 backdrop-blur-sm sm:p-5"
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
                Select the exact variation and quantity for this transaction.
              </p>
            </div>
            <span className="rounded-full bg-[#e2ecdf] px-3 py-1.5 text-[10px] font-bold text-[#174733]">
              {selectedUnits} selected
            </span>
          </div>
        </header>
        <div className="border-b border-[#dfe3dc] bg-white px-4 py-4 sm:px-6">
          <div className="filter-toolbar filter-toolbar-three">
            <label className="filter-search">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#78867e]"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search product or variation"
                aria-label="Search products"
                className="filter-control pl-10"
              />
            </label>
            <select
              value={availability}
              onChange={(event) => setAvailability(event.target.value)}
              className="filter-control px-3 font-semibold"
              aria-label="Filter by availability"
            >
              <option>All</option>
              <option>Available</option>
              <option>Low stock</option>
              <option>Unavailable</option>
            </select>
            <ClearFiltersButton
              onClick={() => {
                setQuery("");
                setCategory("All");
                setAvailability("All");
              }}
              disabled={!query && category === "All" && availability === "All"}
            />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {categories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`min-h-10 shrink-0 rounded-full border px-3.5 text-[10px] font-bold ${
                  category === item
                    ? "border-[#184d37] bg-[#184d37] text-white"
                    : "border-[#ccd4cb] bg-white text-[#4c6055]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-y-auto p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((item) => {
              const remaining = Math.max(0, item.stock - (currentSale[item.key]?.quantity ?? 0));
              const quantity = selection[item.key]?.quantity ?? 0;
              return (
                <article
                  key={item.key}
                  className={`rounded-xl border bg-white p-3 ${
                    quantity
                      ? "border-[#59816b] shadow-[0_0_0_2px_rgba(24,77,55,.1)]"
                      : "border-[#dce2da]"
                  }`}
                >
                  <div className="flex gap-3">
                    <img src={item.image} alt="" className="size-16 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-[#203f32]">
                        {item.name}
                      </div>
                      <div className="mt-1 text-[10px] text-[#5f7468]">
                        {item.variationLabel || item.category}
                      </div>
                      <div className="mt-1 text-sm font-bold text-[#184d37]">
                        {peso(item.price)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <AvailabilityBadge stock={remaining} />
                    <div className="flex min-h-11 items-center overflow-hidden rounded-lg border border-[#cbd3ca]">
                      <button
                        onClick={() => adjust(item, -1)}
                        disabled={!quantity}
                        className="grid size-11 place-items-center disabled:opacity-35"
                      >
                        <Minus size={15} />
                      </button>
                      <span className="w-8 text-center text-xs font-bold">{quantity}</span>
                      <button
                        onClick={() => adjust(item, 1)}
                        disabled={quantity >= remaining}
                        className="grid size-11 place-items-center disabled:opacity-35"
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        <footer className="border-t border-[#dfe3dc] bg-white px-4 py-4 sm:px-6">
          <div className="responsive-cta-group">
            <Button disabled={!selectedUnits} onClick={() => onAdd(selection)}>
              Add to transaction · {selectedUnits}
            </Button>
            <Button kind="secondary" onClick={onClose}>
              Close
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
  const [sale, setSale] = useState<Sale>({});
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [result, setResult] = useState<{
    transaction: { id: string; total: number };
    impactedOrders: OnlineOrder[];
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationConfig | null>(null);
  const saleLines = Object.entries(sale);
  const total = saleLines.reduce((sum, [, line]) => sum + line.price * line.quantity, 0);
  const itemCount = saleLines.reduce((sum, [, line]) => sum + line.quantity, 0);
  const changeQuantity = (key: string, delta: number) => {
    setSale((current) => {
      const line = current[key];
      const quantity = Math.max(0, Math.min(line.stock, line.quantity + delta));
      if (!quantity) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: { ...line, quantity } };
    });
  };
  const addSelection = (selection: Sale) => {
    setSale((current) => {
      const next = { ...current };
      for (const [key, line] of Object.entries(selection)) {
        next[key] = {
          ...line,
          quantity: Math.min(line.stock, (current[key]?.quantity ?? 0) + line.quantity),
        };
      }
      return next;
    });
    setCatalogOpen(false);
  };
  const completeSale = async () => {
    setSaving(true);
    setError("");
    try {
      const completed = await completeWalkInSale(
        saleLines.map(([, line]) => ({
          productId: line.productId,
          variationId: line.variationId,
          quantity: line.quantity,
        })),
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
              saleLines.map(([key, line], index) => (
                <div
                  key={key}
                  className={`grid gap-4 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center sm:p-5 ${
                    index ? "border-t border-[#e7eae5]" : ""
                  }`}
                >
                  <img
                    src={line.image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-14 rounded-lg object-cover sm:size-16"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[#234437]">{line.name}</div>
                    {line.variationLabel && (
                      <div className="mt-1 text-[10px] font-semibold text-[#607068]">
                        {line.variationLabel}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-[#184d37]">
                        {peso(line.price)} each
                      </span>
                      <AvailabilityBadge stock={line.stock - line.quantity} />
                    </div>
                  </div>
                  <div className="flex min-h-11 w-fit items-center overflow-hidden rounded-lg border border-[#ccd4cb]">
                    <button
                      onClick={() => changeQuantity(key, -1)}
                      className="grid size-11 place-items-center text-[#4d6256] hover:bg-[#edf2ed]"
                      aria-label={`Decrease ${line.name} quantity`}
                    >
                      <Minus size={15} />
                    </button>
                    <span className="w-9 text-center text-xs font-bold">{line.quantity}</span>
                    <button
                      onClick={() => changeQuantity(key, 1)}
                      disabled={line.quantity >= line.stock}
                      className="grid size-11 place-items-center text-[#184d37] hover:bg-[#edf2ed] disabled:opacity-35"
                      aria-label={`Increase ${line.name} quantity`}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                    <div className="text-sm font-bold text-[#203f32]">
                      {peso(line.price * line.quantity)}
                    </div>
                    <button
                      onClick={() =>
                        setSale((current) => {
                          const next = { ...current };
                          delete next[key];
                          return next;
                        })
                      }
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
          <Button disabled={!total} loading={saving} className="mt-5 w-full" onClick={completeSale}>
            {saving ? "Processing…" : "Complete walk-in sale"}
          </Button>
          <button
            onClick={() =>
              setConfirmation({
                title: "Clear this transaction?",
                message: `All ${itemCount} selected ${itemCount === 1 ? "item" : "items"} will be removed from the current transaction.`,
                confirmLabel: "Clear transaction",
                destructive: true,
                onConfirm: () => {
                  setSale({});
                  setConfirmation(null);
                },
              })
            }
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
      <ConfirmationDialog config={confirmation} onClose={() => setConfirmation(null)} />
    </>
  );
}

function OrderManagementPage() {
  const { refreshProducts } = useProductStore();
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationConfig | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; tone: FeedbackTone } | null>(null);
  const loadOrders = async (showFeedback = false) => {
    setLoading(true);
    try {
      setOnlineOrders(await getOrders());
      setError("");
      if (showFeedback) setFeedback({ message: "Orders refreshed.", tone: "success" });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Orders could not be loaded.";
      setError(message);
      if (showFeedback) setFeedback({ message, tone: "error" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void loadOrders();
  }, []);
  const conflicts = onlineOrders.filter((order) => order.status === "Awaiting restock");
  const filteredOrders = onlineOrders.filter((order) => {
    const search = query.trim().toLowerCase();
    const searchable =
      `${order.id} ${order.customerName} ${order.customerEmail} ${order.status} ${order.items
        .map((item) => item.name)
        .join(" ")}`.toLowerCase();
    return (
      (!search || searchable.includes(search)) &&
      (statusFilter === "All" || order.status === statusFilter) &&
      (!dateFilter || localDateKey(order.createdAt) === dateFilter)
    );
  });
  const activeOrders = filteredOrders.filter(
    (order) => order.status !== "Completed" && order.status !== "Cancelled",
  );
  const completedOrders = filteredOrders.filter(
    (order) => order.status === "Completed" || order.status === "Cancelled",
  );
  const showActiveOrders = !["Completed", "Cancelled"].includes(statusFilter);
  const showResolvedOrders =
    statusFilter === "All" || ["Completed", "Cancelled"].includes(statusFilter);
  const changeStatus = async (order: OnlineOrder, status: OrderStatus) => {
    setUpdatingOrderId(order.id);
    try {
      const message =
        status === "Cancelled"
          ? order.status === "Ready for pickup"
            ? "This prepared order was cancelled and its deducted stock was returned."
            : "This order was cancelled."
          : status === "Ready for pickup"
            ? "Your order is prepared and ready at the Business Center counter."
            : status === "Completed"
              ? "The order was handed to the student and marked as received."
              : status === "Confirmed"
                ? "Inventory is available for this order."
                : order.statusMessage;
      const updated = await updateOrderStatus(order.id, status, message);
      setOnlineOrders((current) =>
        current.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
      );
      if (
        status === "Ready for pickup" ||
        (status === "Cancelled" && order.status === "Ready for pickup")
      ) {
        await refreshProducts();
      }
      setError("");
      setConfirmation(null);
      setFeedback({
        message:
          status === "Confirmed"
            ? `${order.id} passed the stock check and was confirmed.`
            : status === "Ready for pickup"
              ? `${order.id} is now ready for pickup.`
              : status === "Completed"
                ? `${order.id} was marked as received.`
                : `${order.id} was cancelled.`,
        tone: status === "Cancelled" ? "info" : "success",
      });
    } catch (reason) {
      setFeedback({
        message: reason instanceof Error ? reason.message : "The order could not be updated.",
        tone: "error",
      });
    } finally {
      setUpdatingOrderId(null);
    }
  };
  const requestStatusChange = (order: OnlineOrder, status: "Completed" | "Cancelled") => {
    const cancelling = status === "Cancelled";
    setConfirmation({
      title: cancelling ? "Cancel this order?" : "Confirm order handoff",
      message: cancelling
        ? `${order.id} will be cancelled${order.status === "Ready for pickup" ? " and its deducted stock will be returned" : ""}. This action cannot be undone.`
        : `Confirm that ${order.id} was handed to the student? This completes the order and cannot be undone.`,
      confirmLabel: cancelling ? "Cancel order" : "Confirm handoff",
      destructive: cancelling,
      onConfirm: () => changeStatus(order, status),
    });
  };

  return (
    <>
      <SectionTitle
        title="Order management"
        subtitle="Review online orders and resolve stock conflicts created by counter sales."
        action={
          <Button
            kind="secondary"
            onClick={() => void loadOrders(true)}
            loading={loading}
            className="gap-2"
          >
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
      <div className="filter-toolbar mb-5">
        <label className="filter-search">
          <span className="sr-only">Search online orders</span>
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7c8981]"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search order, student, email, or item"
            className="filter-control pl-9"
          />
        </label>
        <label>
          <span className="sr-only">Filter online orders by date</span>
          <input
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="filter-control px-3"
            aria-label="Filter online orders by date"
          />
        </label>
        <label>
          <span className="sr-only">Filter orders by status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="filter-control px-3"
          >
            <option>All</option>
            {[
              "Pending review",
              "Confirmed",
              "Awaiting restock",
              "Ready for pickup",
              "Completed",
              "Cancelled",
            ].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <ClearFiltersButton
          disabled={!query && statusFilter === "All" && !dateFilter}
          onClick={() => {
            setQuery("");
            setStatusFilter("All");
            setDateFilter("");
          }}
        />
      </div>
      {showActiveOrders && (
        <>
          <h2 className="mb-3 text-sm font-semibold text-[#29483a]">Active orders</h2>
          <div className="max-h-[690px] space-y-3 overflow-y-auto pr-1">
            {activeOrders.map((order) => (
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
                      {order.items
                        .map(
                          (item) =>
                            `${item.quantity}× ${item.name}${item.size ? ` (Size ${item.size})` : ""}`,
                        )
                        .join(" · ")}
                    </div>
                    <div className="mt-2 text-[10px] leading-5 text-[#879087]">
                      {order.statusMessage}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {order.status === "Awaiting restock" && (
                      <>
                        <Button
                          kind="info"
                          className="stock-check-action"
                          loading={updatingOrderId === order.id}
                          disabled={Boolean(updatingOrderId)}
                          onClick={() => changeStatus(order, "Confirmed")}
                        >
                          <Boxes size={14} />
                          Check stock &amp; confirm
                        </Button>
                        <button
                          onClick={() => requestStatusChange(order, "Cancelled")}
                          className="danger-button flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-[10px] font-semibold"
                        >
                          <XCircle size={13} className="icon-danger" /> Cancel
                        </button>
                      </>
                    )}
                    {order.status === "Confirmed" && (
                      <>
                        <Button
                          kind="warning"
                          className="ready-for-pickup-action"
                          loading={updatingOrderId === order.id}
                          disabled={Boolean(updatingOrderId)}
                          onClick={() => changeStatus(order, "Ready for pickup")}
                        >
                          Ready for pickup
                        </Button>
                        <button
                          onClick={() => requestStatusChange(order, "Cancelled")}
                          className="danger-button flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-[10px] font-semibold"
                        >
                          <XCircle size={13} className="icon-danger" /> Cancel
                        </button>
                      </>
                    )}
                    {order.status === "Ready for pickup" && (
                      <>
                        <Button onClick={() => requestStatusChange(order, "Completed")}>
                          Order received
                        </Button>
                        <button
                          onClick={() => requestStatusChange(order, "Cancelled")}
                          className="danger-button flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-[10px] font-semibold"
                        >
                          <XCircle size={13} className="icon-danger" /> Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
            {!loading && !activeOrders.length && (
              <div className="rounded-xl border border-dashed border-[#ccd4ca] bg-white/50 py-14 text-center text-xs text-[#7e8881]">
                {onlineOrders.length && (query || statusFilter !== "All" || dateFilter)
                  ? "No active orders match these filters."
                  : "No active online orders."}
              </div>
            )}
            {loading && (
              <div className="py-8 text-center text-xs text-[#7e8881]">Loading orders…</div>
            )}
          </div>
        </>
      )}
      {showResolvedOrders && (
        <section className={showActiveOrders ? "mt-8" : ""}>
          <h2 className="mb-3 text-sm font-semibold text-[#29483a]">Resolved orders</h2>
          <div className="max-h-[360px] overflow-y-auto rounded-xl border border-[#dce1d7] bg-white">
            {completedOrders.map((order, index) => (
              <div
                key={order.id}
                className={`flex min-h-16 items-center justify-between gap-4 px-4 py-3 ${
                  index ? "border-t border-[#e5e8e2]" : ""
                }`}
              >
                <div>
                  <div className="text-xs font-semibold text-[#29483a]">{order.id}</div>
                  <div className="mt-1 text-[10px] text-[#6f7c74]">
                    {order.customerName} · {new Date(order.createdAt).toLocaleDateString()} ·{" "}
                    {peso(order.total)}
                  </div>
                </div>
                <Pill tone={order.status === "Cancelled" ? "gray" : "green"}>{order.status}</Pill>
              </div>
            ))}
            {!loading && !completedOrders.length && (
              <div className="py-10 text-center text-xs text-[#758078]">
                {onlineOrders.length && (query || statusFilter !== "All" || dateFilter)
                  ? "No resolved orders match these filters."
                  : "Completed and cancelled orders will appear here."}
              </div>
            )}
          </div>
        </section>
      )}
      <ConfirmationDialog
        config={confirmation}
        busy={Boolean(updatingOrderId)}
        onClose={() => setConfirmation(null)}
      />
      {feedback && (
        <FeedbackToast
          message={feedback.message}
          tone={feedback.tone}
          onClose={() => setFeedback(null)}
        />
      )}
    </>
  );
}

function UserManagementPage({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [editing, setEditing] = useState<ManagedUser | "new" | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [accessFilter, setAccessFilter] = useState("All");
  const [confirmation, setConfirmation] = useState<ConfirmationConfig | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; tone: FeedbackTone } | null>(null);
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
  const filteredUsers = users.filter((user) => {
    const search = query.trim().toLowerCase();
    const searchable = `${user.full_name} ${user.email} ${user.reference}`.toLowerCase();
    const matchesAccess =
      accessFilter === "All" ||
      (accessFilter === "Active" && user.active) ||
      (accessFilter === "Removed" && !user.active);
    return (
      (!search || searchable.includes(search)) &&
      (roleFilter === "All" || user.role === roleFilter) &&
      matchesAccess
    );
  });
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
      setFeedback({
        message: editing === "new" ? "Account created." : "Account updated.",
        tone: "success",
      });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "The account could not be saved.";
      setError(message);
      setFeedback({ message, tone: "error" });
    } finally {
      setSaving(false);
    }
  };
  const toggleAccess = async (user: ManagedUser) => {
    setSaving(true);
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
      setConfirmation(null);
      setError("");
      setFeedback({
        message: user.active
          ? `${user.full_name} no longer has system access.`
          : `${user.full_name}'s access was restored.`,
        tone: user.active ? "info" : "success",
      });
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "Account access could not be changed.";
      setError(message);
      setFeedback({ message, tone: "error" });
    } finally {
      setSaving(false);
    }
  };
  const requestAccessChange = (user: ManagedUser) =>
    setConfirmation({
      title: user.active ? "Remove account access?" : "Restore account access?",
      message: user.active
        ? `${user.full_name} will no longer be able to sign in. Their account record will be retained.`
        : `${user.full_name} will be able to sign in and use their assigned role again.`,
      confirmLabel: user.active ? "Remove access" : "Restore access",
      destructive: user.active,
      onConfirm: () => toggleAccess(user),
    });

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
      <div className="filter-toolbar mb-4">
        <label className="filter-search">
          <span className="sr-only">Search users</span>
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7c8981]"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, or ID"
            className="filter-control pl-9"
          />
        </label>
        <label>
          <span className="sr-only">Filter users by role</span>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="filter-control px-3"
          >
            <option>All</option>
            <option value="student">Students</option>
            <option value="staff">Staff</option>
            <option value="admin">Administrators</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Filter users by access</span>
          <select
            value={accessFilter}
            onChange={(event) => setAccessFilter(event.target.value)}
            className="filter-control px-3"
          >
            <option>All</option>
            <option>Active</option>
            <option>Removed</option>
          </select>
        </label>
        <ClearFiltersButton
          disabled={!query && roleFilter === "All" && accessFilter === "All"}
          onClick={() => {
            setQuery("");
            setRoleFilter("All");
            setAccessFilter("All");
          }}
        />
      </div>
      <div className="space-y-3 md:hidden">
        {filteredUsers.map((user) => (
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
                  onClick={() => requestAccessChange(user)}
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
        {!loading && !filteredUsers.length && (
          <div className="rounded-xl border border-dashed border-[#ccd4ca] bg-white/50 py-12 text-center text-xs text-[#7e8881]">
            {users.length ? "No accounts match these filters." : "No accounts found."}
          </div>
        )}
      </div>
      <div className="hidden overflow-hidden rounded-xl border border-[#dce1d7] bg-white md:block">
        <div className="table-wrap max-h-[480px] overflow-y-auto">
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
              {filteredUsers.map((user) => (
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
                          onClick={() => requestAccessChange(user)}
                          className={`flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-semibold ${user.active ? "danger-button" : "text-[#315b48] hover:bg-[#edf2eb]"}`}
                        >
                          <UserX size={13} /> {user.active ? "Remove" : "Restore"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !filteredUsers.length && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs">
                    {users.length ? "No accounts match these filters." : "No accounts found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {loading && <div className="mt-4 text-xs text-[#7d857e]">Loading accounts…</div>}
      <ConfirmationDialog
        config={confirmation}
        busy={saving}
        onClose={() => setConfirmation(null)}
      />
      {feedback && (
        <FeedbackToast
          message={feedback.message}
          tone={feedback.tone}
          onClose={() => setFeedback(null)}
        />
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#0b0d0e]/60 p-4 backdrop-blur-sm"
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
                  Sign-in credentials and account permissions are stored securely.
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
            <div className="responsive-cta-group mt-6">
              <Button type="submit" loading={saving} className="w-full gap-2 sm:w-auto">
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

type ProductDraft = {
  updatedAt?: string;
  name: string;
  category: string;
  price: string;
  stock: string;
  description: string;
  image: string;
  productType: "simple" | "variable";
  attributes: ProductAttribute[];
  variations: ProductVariation[];
};

type InventoryLine = {
  key: string;
  productId: number;
  variationId: number | null;
  productName: string;
  variationLabel: string | null;
  category: string;
  stock: number;
  active: boolean;
};

function ProductImageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const upload = async (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Images must be 5 MB or smaller.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      onChange(await uploadProductImage(file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The image could not be uploaded.");
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="sm:col-span-2">
      <div className="grid gap-3 sm:grid-cols-[96px_1fr] sm:items-start">
        <div className="overflow-hidden rounded-xl border border-[#d9ded5] bg-[#eef1eb]">
          {value ? (
            <img
              src={value}
              alt="Product preview"
              className="aspect-square size-full object-cover"
            />
          ) : (
            <span className="grid aspect-square place-items-center text-[#7b887f]">
              <ImagePlus size={24} />
            </span>
          )}
        </div>
        <div className="space-y-2">
          <label
            className="flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#bfc9bf] bg-[#f8faf7] px-4 text-center transition hover:border-[#789080] hover:bg-[#f1f5f0]"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void upload(event.dataTransfer.files[0]);
            }}
          >
            {uploading ? (
              <RefreshCw size={19} className="animate-spin text-[#37654f]" />
            ) : (
              <ImagePlus size={19} className="text-[#4e735f]" />
            )}
            <span className="text-xs font-semibold text-[#3f5c4d]">
              {uploading ? "Uploading…" : "Upload image"}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => void upload(event.target.files?.[0])}
            />
          </label>
          <label className="field">
            <span className="sr-only">Image URL</span>
            <input
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="Or paste an image URL"
            />
          </label>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="min-h-10 rounded-lg px-3 text-xs font-semibold text-[#8a493e] hover:bg-[#f8ebe7]"
            >
              Remove image
            </button>
          )}
          {error && <p className="text-xs text-[#8b4333]">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function VariationImageField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const upload = async (file?: File) => {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("Use a JPG, PNG, or WebP image up to 5 MB.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      onChange(await uploadProductImage(file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="min-w-48">
      <div className="flex items-center gap-2">
        {value ? (
          <img src={value} alt="" className="size-10 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[#edf1eb] text-[#708078]">
            <ImagePlus size={15} />
          </span>
        )}
        <input
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value || null)}
          placeholder="Uses main image"
          aria-label="Variation image URL"
        />
        <label
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg border border-[#c8d2c8] text-[#315b48]"
          title="Upload variation image"
        >
          {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={(event) => void upload(event.target.files?.[0])}
          />
        </label>
      </div>
      {error && <p className="mt-1 text-[9px] text-[#8b4333]">{error}</p>}
    </div>
  );
}

function VariationEditor({
  attributes,
  variations,
  basePrice,
  isCreating,
  onAttributesChange,
  onVariationsChange,
}: {
  attributes: ProductAttribute[];
  variations: ProductVariation[];
  basePrice: number;
  isCreating: boolean;
  onAttributesChange: (attributes: ProductAttribute[]) => void;
  onVariationsChange: (variations: ProductVariation[]) => void;
}) {
  const [valueDrafts, setValueDrafts] = useState<Record<string, string>>({});
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const combinations = generateVariationValues(attributes);
  const generatedKeys = new Set(combinations.map(variationKey));
  const hasDefaultPrice = Number.isFinite(basePrice) && basePrice >= 0;
  const variationsAreCurrent =
    combinations.length > 0 &&
    variations.length === generatedKeys.size &&
    variations.every((variation) => generatedKeys.has(variation.key));
  const addAttribute = () =>
    onAttributesChange([...attributes, { id: crypto.randomUUID(), name: "", values: [] }]);
  const updateAttribute = (id: string, updates: Partial<ProductAttribute>) =>
    onAttributesChange(
      attributes.map((attribute) =>
        attribute.id === id ? { ...attribute, ...updates } : attribute,
      ),
    );
  const addValue = (attribute: ProductAttribute) => {
    const value = (valueDrafts[attribute.id] ?? "").trim();
    if (
      !value ||
      attribute.values.some((candidate) => candidate.toLowerCase() === value.toLowerCase())
    )
      return;
    updateAttribute(attribute.id, { values: [...attribute.values, value] });
    setValueDrafts((current) => ({ ...current, [attribute.id]: "" }));
  };
  const generate = () => {
    onVariationsChange(
      mergeGeneratedVariations(attributes, variations, {
        price: Number.isFinite(basePrice) ? basePrice : 0,
        stock: 0,
      }),
    );
  };
  const updateVariation = (key: string, updates: Partial<ProductVariation>) =>
    onVariationsChange(
      variations.map((variation) =>
        variation.key === key ? { ...variation, ...updates } : variation,
      ),
    );
  const applyBulk = () => {
    const price = bulkPrice === "" ? null : Number(bulkPrice);
    const stock = bulkStock === "" ? null : Number(bulkStock);
    onVariationsChange(
      variations.map((variation) => ({
        ...variation,
        ...(price !== null && price >= 0 ? { price } : {}),
        ...(stock !== null && stock >= 0 ? { stock } : {}),
      })),
    );
  };
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#dce2da] bg-[#f8faf7] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#29483a]">Options</h3>
          <Button kind="secondary" onClick={addAttribute} className="gap-2">
            <Plus size={14} /> Add option
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {attributes.map((attribute, attributeIndex) => (
            <div key={attribute.id} className="rounded-xl border border-[#dce2da] bg-white p-3">
              <div className="flex items-center gap-2">
                <input
                  value={attribute.name}
                  onChange={(event) => updateAttribute(attribute.id, { name: event.target.value })}
                  placeholder={attributeIndex ? "Color or type" : "Option name, e.g. Size"}
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#d6ddd5] px-3 text-xs"
                />
                <button
                  type="button"
                  onClick={() =>
                    onAttributesChange(
                      attributes.filter((candidate) => candidate.id !== attribute.id),
                    )
                  }
                  className="grid size-11 place-items-center rounded-lg text-[#8a493e] hover:bg-[#f8ebe7]"
                  aria-label={`Remove ${attribute.name || "attribute"}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {attribute.values.map((value) => (
                  <span
                    key={value}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#ced8ce] bg-[#f2f6f1] pl-3 pr-1.5 text-[10px] font-semibold text-[#40584b]"
                  >
                    {value}
                    <button
                      type="button"
                      onClick={() =>
                        updateAttribute(attribute.id, {
                          values: attribute.values.filter((candidate) => candidate !== value),
                        })
                      }
                      className="grid size-7 place-items-center rounded-full hover:bg-[#dfe8df]"
                      aria-label={`Remove ${value}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={valueDrafts[attribute.id] ?? ""}
                  onChange={(event) =>
                    setValueDrafts((current) => ({
                      ...current,
                      [attribute.id]: event.target.value,
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addValue(attribute);
                    }
                  }}
                  placeholder="Add value, e.g. Small"
                  className="min-h-10 min-w-0 flex-1 rounded-lg border border-[#d6ddd5] px-3 text-xs"
                />
                <button
                  type="button"
                  onClick={() => addValue(attribute)}
                  className="min-h-10 rounded-lg border border-[#bdc9bf] px-3 text-xs font-semibold text-[#315b48]"
                >
                  Add
                </button>
              </div>
            </div>
          ))}
          {!attributes.length && (
            <div className="rounded-lg border border-dashed border-[#cad3ca] px-4 py-8 text-center text-xs text-[#748078]">
              Add an option such as Size or Color.
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e7e0] pt-4">
          <span className="text-xs font-medium text-[#607068]">
            {combinations.length
              ? hasDefaultPrice
                ? `${combinations.length} variation${combinations.length === 1 ? "" : "s"}`
                : "Enter a default price first"
              : "Add values to continue"}
          </span>
          <Button
            disabled={!combinations.length || !hasDefaultPrice || variationsAreCurrent}
            onClick={generate}
            className="gap-2"
          >
            {variationsAreCurrent ? "Variations ready" : "Update variations"}
          </Button>
        </div>
      </div>

      {variations.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[#dce2da] bg-white">
          <div className="border-b border-[#e2e6df] p-4">
            <h3 className="text-sm font-semibold text-[#29483a]">Variations</h3>
            {isCreating && (
              <>
                <p className="mt-1 text-xs text-[#6f7c74]">
                  Set initial stock for variations here, or adjust later in Inventory management.
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bulkPrice}
                    onChange={(event) => setBulkPrice(event.target.value)}
                    placeholder="Bulk price"
                    aria-label="Set all variation prices"
                    className="min-h-10 min-w-0 flex-1 rounded-lg border border-[#d6ddd5] px-3 text-xs"
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={bulkStock}
                    onChange={(event) => setBulkStock(event.target.value)}
                    placeholder="Bulk stock"
                    aria-label="Set all variation stock"
                    className="min-h-10 min-w-0 flex-1 rounded-lg border border-[#d6ddd5] px-3 text-xs"
                  />
                  <Button kind="secondary" onClick={applyBulk}>
                    Apply to all
                  </Button>
                </div>
              </>
            )}
            {!isCreating && (
              <>
                <p className="mt-1 text-xs text-[#6f7c74]">
                  Adjust stock in Inventory management.
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bulkPrice}
                    onChange={(event) => setBulkPrice(event.target.value)}
                    placeholder="Bulk price"
                    aria-label="Set all variation prices"
                    className="min-h-10 min-w-0 flex-1 rounded-lg border border-[#d6ddd5] px-3 text-xs"
                  />
                  <Button kind="secondary" onClick={applyBulk}>
                    Apply to all
                  </Button>
                </div>
              </>
            )}
          </div>
          <div className="table-wrap max-h-[420px] overflow-y-auto">
            <table className="variation-table">
              <thead>
                <tr>
                  <th>Variation</th>
                  <th>SKU</th>
                  <th>Price</th>
                  {isCreating && <th>Stock</th>}
                  <th>Image</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {variations.map((variation) => (
                  <tr key={variation.key}>
                    <td data-label="Variation" className="font-semibold">
                      {variationLabel(variation.values)}
                    </td>
                    <td data-label="SKU">
                      <input
                        value={variation.sku}
                        onChange={(event) =>
                          updateVariation(variation.key, { sku: event.target.value })
                        }
                        placeholder="Optional"
                      />
                    </td>
                    <td data-label="Price">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={variation.price}
                        onChange={(event) =>
                          updateVariation(variation.key, { price: Number(event.target.value) })
                        }
                      />
                    </td>
                    {isCreating && (
                      <td data-label="Stock">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={variation.stock}
                          onChange={(event) =>
                            updateVariation(variation.key, { stock: Number(event.target.value) })
                          }
                          className="w-20"
                        />
                      </td>
                    )}
                    <td data-label="Image">
                      <VariationImageField
                        value={variation.image}
                        onChange={(image) => updateVariation(variation.key, { image })}
                      />
                    </td>
                    <td data-label="Active">
                      <input
                        type="checkbox"
                        checked={variation.active}
                        onChange={(event) =>
                          updateVariation(variation.key, { active: event.target.checked })
                        }
                        className="size-4 accent-[#184d37]"
                        aria-label={`Toggle ${variationLabel(variation.values)}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ManagementPage({ page }: { page: string }) {
  const {
    products,
    loading,
    error: productLoadError,
    addProduct,
    editProduct,
    removeProduct,
    refreshProducts,
  } = useProductStore();
  const isProduct = page === "Product management";
  const isInventory = page === "Inventory management";
  const [feedback, setFeedback] = useState<{ message: string; tone: FeedbackTone } | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationConfig | null>(null);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [stockFilter, setStockFilter] = useState("All");
  const [inventoryMovements, setInventoryMovements] = useState<
    AdminReportData["inventoryMovements"]
  >([]);
  const [inventoryTarget, setInventoryTarget] = useState<InventoryLine | null>(null);
  const [adjustmentMode, setAdjustmentMode] = useState<"add" | "remove" | "set">("add");
  const [adjustmentQuantity, setAdjustmentQuantity] = useState("");
  const [draft, setDraft] = useState<ProductDraft>({
    name: "",
    category: "School Supplies",
    price: "",
    stock: "",
    description: "",
    image: "/assets/stationery.jpg",
    productType: "simple",
    attributes: [],
    variations: [],
  });
  const title = page;
  const filteredManagementItems = products.filter((item) => {
    const searchValue = `${item.name} ${item.category}`;
    const matchesQuery = searchValue.toLowerCase().includes(query.trim().toLowerCase());
    const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
    return matchesQuery && matchesCategory;
  });
  const managementCategories = [...new Set(products.map((product) => product.category))];
  const inventoryLines = products.flatMap<InventoryLine>((product) =>
    product.productType === "variable"
      ? (product.variations ?? []).map((variation) => ({
          key: `${product.id}:${variation.id}`,
          productId: product.id,
          variationId: variation.id ?? null,
          productName: product.name,
          variationLabel: variationLabel(variation.values),
          category: product.category,
          stock: variation.stock,
          active: variation.active,
        }))
      : [
          {
            key: `${product.id}:simple`,
            productId: product.id,
            variationId: null,
            productName: product.name,
            variationLabel: null,
            category: product.category,
            stock: product.stock,
            active: true,
          },
        ],
  );
  const filteredInventoryLines = inventoryLines.filter((line) => {
    const matchesQuery = `${line.productName} ${line.variationLabel ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    const matchesCategory = categoryFilter === "All" || line.category === categoryFilter;
    const matchesStock =
      stockFilter === "All" ||
      (stockFilter === "Available" && line.stock >= 20) ||
      (stockFilter === "Low stock" && line.stock > 0 && line.stock < 20) ||
      (stockFilter === "Out of stock" && line.stock <= 0);
    return matchesQuery && matchesCategory && matchesStock;
  });
  const loadInventoryHistory = async () => {
    const report = await getAdminReports();
    setInventoryMovements(report.inventoryMovements);
  };
  useEffect(() => {
    if (!isInventory) return;
    void loadInventoryHistory().catch(() => setInventoryMovements([]));
  }, [isInventory]);
  useEffect(() => {
    setQuery("");
    setCategoryFilter("All");
    setStockFilter("All");
  }, [page]);
  const openProductForm = (product?: Product) => {
    setEditing(product ?? "new");
    setDraft(
      product
        ? {
            updatedAt: product.updatedAt,
            name: product.name,
            category: product.category,
            price: String(product.price),
            stock: String(product.stock),
            description: product.description,
            image: product.image,
            productType:
              product.productType === "variable" || product.variations?.length
                ? "variable"
                : "simple",
            attributes:
              product.attributes ??
              (product.sizes?.length ? [{ id: "size", name: "Size", values: product.sizes }] : []),
            variations: product.variations ?? [],
          }
        : {
            updatedAt: undefined,
            name: "",
            category: "School Supplies",
            price: "",
            stock: "",
            description: "",
            image: "/assets/stationery.jpg",
            productType: "simple",
            attributes: [],
            variations: [],
          },
    );
  };
  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (!draft.name.trim() || !draft.category.trim()) {
        throw new Error("Enter a product name and category.");
      }
      if (!Number.isFinite(Number(draft.price)) || Number(draft.price) < 0) {
        throw new Error("Enter a valid price.");
      }
      const input = {
        updatedAt: draft.updatedAt,
        name: draft.name.trim(),
        category: draft.category.trim(),
        description: draft.description.trim(),
        image: draft.image,
        productType: draft.productType,
        attributes: draft.productType === "variable" ? draft.attributes : [],
        variations: draft.productType === "variable" ? draft.variations : [],
        price: Number(draft.price),
        stock: draft.productType === "simple" ? Number(draft.stock || 0) : 0,
        sizes: [],
      };
      if (
        draft.productType === "variable" &&
        (!draft.attributes.length || !draft.variations.length)
      ) {
        throw new Error("Add options and update the variations before saving.");
      }
      if (draft.productType === "variable") {
        const expectedKeys = new Set(generateVariationValues(draft.attributes).map(variationKey));
        if (
          expectedKeys.size !== draft.variations.length ||
          draft.variations.some((variation) => !expectedKeys.has(variation.key))
        ) {
          throw new Error("Your options changed. Select Update variations before saving.");
        }
      }
      if (editing === "new") await addProduct(input);
      else if (editing) await editProduct(editing.id, input);
      setEditing(null);
      setFeedback({
        message: editing === "new" ? "Product saved to the database." : "Product updated.",
        tone: "success",
      });
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : "Unable to save product.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  };
  const deleteProduct = async (product: Product) => {
    setSaving(true);
    try {
      await removeProduct(product.id);
      setConfirmation(null);
      setFeedback({ message: `${product.name} was removed from the database.`, tone: "success" });
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : "Unable to delete product.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  };
  const openInventoryAdjustment = (line: InventoryLine) => {
    setInventoryTarget(line);
    setAdjustmentMode("add");
    setAdjustmentQuantity("");
  };
  const saveInventoryAdjustment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inventoryTarget) return;
    const quantity = Number(adjustmentQuantity);
    if (
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      (adjustmentMode !== "set" && quantity === 0)
    ) {
      setFeedback({ message: "Enter a valid whole-number quantity.", tone: "error" });
      return;
    }
    if (adjustmentMode === "remove" && quantity > inventoryTarget.stock) {
      setFeedback({ message: "Stock cannot go below zero.", tone: "error" });
      return;
    }
    const quantityChange =
      adjustmentMode === "set"
        ? quantity - inventoryTarget.stock
        : adjustmentMode === "add"
          ? quantity
          : -quantity;
    if (!quantityChange) {
      setFeedback({ message: "The new stock level is unchanged.", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      await adjustInventory({
        productId: inventoryTarget.productId,
        variationId: inventoryTarget.variationId,
        quantityChange,
      });
      setInventoryTarget(null);
      setFeedback({ message: "Inventory updated and recorded.", tone: "success" });
      await Promise.allSettled([refreshProducts(), loadInventoryHistory()]);
    } catch (reason) {
      setFeedback({
        message: reason instanceof Error ? reason.message : "Inventory could not be updated.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  };
  if (isInventory) {
    const totalUnits = inventoryLines.reduce((sum, line) => sum + line.stock, 0);
    const lowStockCount = inventoryLines.filter((line) => line.active && line.stock < 20).length;
    return (
      <>
        <SectionTitle
          title="Inventory management"
          subtitle="Record stock received, corrections, and variation-level inventory."
        />
        {productLoadError && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e4c9c1] bg-[#fff7f4] px-4 py-3">
            <p className="text-xs text-[#7d4338]">{productLoadError}</p>
            <Button
              kind="secondary"
              loading={loading}
              onClick={() => void refreshProducts().catch(() => undefined)}
            >
              Retry
            </Button>
          </div>
        )}
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {(
            [
              ["Total units", totalUnits, Boxes],
              ["Stock entries", inventoryLines.length, PackageCheck],
              ["Low or out", lowStockCount, AlertTriangle],
            ] as Array<[string, number, LucideIcon]>
          ).map(([label, value, Icon]) => (
            <div
              key={String(label)}
              className="flex items-center gap-3 rounded-xl border border-[#dce2da] bg-white p-4"
            >
              <span className="grid size-10 place-items-center rounded-lg bg-[#edf3ed] text-[#315f49]">
                <Icon size={18} />
              </span>
              <div>
                <div className="text-lg font-bold text-[#214536]">{String(value)}</div>
                <div className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#7b867e]">
                  {String(label)}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-xl border border-[#dce1d7] bg-white">
          <div className="filter-toolbar filter-toolbar-embedded">
            <label className="filter-search">
              <span className="sr-only">Search inventory</span>
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7c8981]"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products or variations"
                className="filter-control pl-9"
              />
            </label>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="filter-control px-3"
              aria-label="Filter inventory by category"
            >
              <option value="All">All categories</option>
              {managementCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
            <select
              value={stockFilter}
              onChange={(event) => setStockFilter(event.target.value)}
              className="filter-control px-3"
              aria-label="Filter inventory by stock level"
            >
              <option>All</option>
              <option>Available</option>
              <option>Low stock</option>
              <option>Out of stock</option>
            </select>
            <ClearFiltersButton
              disabled={!query && categoryFilter === "All" && stockFilter === "All"}
              onClick={() => {
                setQuery("");
                setCategoryFilter("All");
                setStockFilter("All");
              }}
            />
          </div>
          <div className="table-wrap max-h-[520px] overflow-y-auto">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Variation</th>
                  <th>Category</th>
                  <th>On hand</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonTableRow key={i} columns={6} />
                  ))
                ) : (
                  <>
                    {filteredInventoryLines.map((line) => (
                      <tr key={line.key}>
                        <td data-label="Product" className="font-semibold">
                          {line.productName}
                        </td>
                        <td data-label="Variation">
                          {line.variationLabel ?? "Standard"}
                          {!line.active && (
                            <span className="ml-2 text-[9px] font-semibold text-[#8a6355]">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td data-label="Category">{line.category}</td>
                        <td data-label="On hand" className="font-bold text-[#214536]">
                          {line.stock}
                        </td>
                        <td data-label="Status">
                          <Pill tone={line.stock <= 0 ? "gray" : line.stock < 20 ? "amber" : "green"}>
                            {line.stock <= 0
                              ? "Out of stock"
                              : line.stock < 20
                                ? "Low stock"
                                : "Available"}
                          </Pill>
                        </td>
                        <td data-label="Actions">
                          <Button kind="secondary" onClick={() => openInventoryAdjustment(line)}>
                            Adjust stock
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!loading && !filteredInventoryLines.length && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-xs text-[#69766e]">
                          No inventory records match these filters.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <section className="mt-5 rounded-xl border border-[#dce1d7] bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[#29483a]">Recent inventory movements</h2>
            <Button kind="ghost" onClick={() => void loadInventoryHistory()} className="gap-2">
              <RefreshCw size={14} /> Refresh
            </Button>
          </div>
          <div className="mt-3 divide-y divide-[#e7eae5]">
            {inventoryMovements.slice(0, 12).map((movement) => (
              <div
                key={movement.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs"
              >
                <div>
                  <span className="font-semibold text-[#29483a]">{movement.productName}</span>
                  {movement.variationLabel && (
                    <span className="text-[#6f7b74]"> · {movement.variationLabel}</span>
                  )}
                  <div className="mt-1 text-[10px] text-[#818a82]">
                    {movement.reason || movement.type} ·{" "}
                    {new Date(movement.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-bold ${movement.quantityChange > 0 ? "text-[#246344]" : "text-[#914f40]"}`}
                  >
                    {movement.quantityChange > 0 ? "+" : ""}
                    {movement.quantityChange}
                  </div>
                  <div className="text-[10px] text-[#7b867e]">{movement.stockAfter} on hand</div>
                </div>
              </div>
            ))}
            {!inventoryMovements.length && (
              <p className="py-8 text-center text-xs text-[#748078]">
                No inventory movements recorded yet.
              </p>
            )}
          </div>
        </section>
        {inventoryTarget && (
          <div
            className="fixed inset-0 z-[120] grid place-items-center bg-[#0b0d0e]/60 p-4 backdrop-blur-sm"
            onMouseDown={() => !saving && setInventoryTarget(null)}
          >
            <form
              onSubmit={saveInventoryAdjustment}
              onMouseDown={(event) => event.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#173d2f]">Adjust inventory</h2>
                  <p className="mt-1 text-xs text-[#6f7b74]">
                    {inventoryTarget.productName}
                    {inventoryTarget.variationLabel ? ` · ${inventoryTarget.variationLabel}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInventoryTarget(null)}
                  className="grid size-10 place-items-center rounded-lg border border-[#d5dcd4]"
                  aria-label="Close inventory adjustment"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-[#f1f4ef] p-1">
                {(
                  [
                    ["add", "Add"],
                    ["remove", "Remove"],
                    ["set", "Set total"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setAdjustmentMode(value);
                      setAdjustmentQuantity("");
                    }}
                    className={`min-h-10 rounded-lg text-xs font-semibold ${
                      adjustmentMode === value
                        ? "bg-white text-[#184d37] shadow-sm"
                        : "text-[#69766e]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-xl bg-[#f7f8f4] p-3 text-xs text-[#53645a]">
                On hand: <strong className="text-[#214536]">{inventoryTarget.stock}</strong>
              </div>
              <label className="field mt-4">
                {adjustmentMode === "set" ? "New total" : "Quantity"}
                <input
                  type="number"
                  min={adjustmentMode === "set" ? 0 : 1}
                  max={adjustmentMode === "remove" ? inventoryTarget.stock : undefined}
                  step="1"
                  value={adjustmentQuantity}
                  onChange={(event) => setAdjustmentQuantity(event.target.value)}
                  autoFocus
                  required
                />
              </label>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button kind="secondary" onClick={() => setInventoryTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" loading={saving}>
                  Save adjustment
                </Button>
              </div>
            </form>
          </div>
        )}
        {feedback && (
          <FeedbackToast
            message={feedback.message}
            tone={feedback.tone}
            onClose={() => setFeedback(null)}
          />
        )}
      </>
    );
  }
  return (
    <>
      <SectionTitle
        title={title}
        subtitle={
          isProduct
            ? "Maintain product details, pricing, images, SKUs, and variations."
            : "Monitor stock levels and record adjustments."
        }
        action={
          isProduct ? <Button onClick={() => openProductForm()}>Add product</Button> : undefined
        }
      />
      {productLoadError && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e4c9c1] bg-[#fff7f4] px-4 py-3">
          <p className="text-xs text-[#7d4338]">{productLoadError}</p>
          <Button
            kind="secondary"
            loading={loading}
            onClick={() => void refreshProducts().catch(() => undefined)}
          >
            Retry
          </Button>
        </div>
      )}
      {editing && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#0b0d0e]/60 p-4 backdrop-blur-sm"
          onMouseDown={() => setEditing(null)}
        >
          <form
            onSubmit={saveProduct}
            onMouseDown={(event) => event.stopPropagation()}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl bg-[#f8faf7] shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#dde3dc] bg-white px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-semibold text-[#173d2f]">
                  {editing === "new" ? "Add product" : "Edit product"}
                </h2>
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
            <div className="space-y-4 p-4 sm:p-6">
              <section className="rounded-xl border border-[#dce2da] bg-white p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-[#29483a]">Product details</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="field">
                    Product name
                    <input
                      value={draft.name}
                      onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                      required
                    />
                  </label>
                  <label className="field">
                    Category
                    <input
                      list="product-category-suggestions"
                      value={draft.category}
                      onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                      placeholder="Type a category"
                      required
                    />
                    <datalist id="product-category-suggestions">
                      <option value="Uniforms" />
                      <option value="PE & Athletics" />
                      <option value="Identification" />
                      <option value="Assessment Supplies" />
                      <option value="School Supplies" />
                      <option value="Services" />
                    </datalist>
                  </label>
                  <label className="field sm:col-span-2">
                    Description
                    <textarea
                      rows={3}
                      value={draft.description}
                      onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    />
                  </label>
                  <ProductImageField
                    value={draft.image}
                    onChange={(image) => setDraft({ ...draft, image })}
                  />
                </div>
              </section>

              <section className="rounded-xl border border-[#dce2da] bg-white p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-[#29483a]">Pricing and stock</h3>
                <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[#f1f4ef] p-1">
                  {(
                    [
                      ["simple", "Simple"],
                      ["variable", "With options"],
                    ] as const
                  ).map(([value, title]) => (
                    <label
                      key={value}
                      className={`cursor-pointer rounded-lg px-3 py-2.5 text-center ${
                        draft.productType === value
                          ? "bg-white text-[#184d37] shadow-sm"
                          : "text-[#68776f]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="productType"
                        value={value}
                        checked={draft.productType === value}
                        onChange={() => setDraft({ ...draft, productType: value })}
                        className="sr-only"
                      />
                      <span className="text-xs font-semibold">{title}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-4">
                  <label className="field">
                    {draft.productType === "simple" ? "Price" : "Default price for new variations"}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.price}
                      onChange={(event) => setDraft({ ...draft, price: event.target.value })}
                      required
                    />
                  </label>
                </div>
                {draft.productType === "simple" && editing === "new" && (
                  <div className="mt-4">
                    <label className="field">
                      Initial stock
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={draft.stock}
                        onChange={(event) => setDraft({ ...draft, stock: event.target.value })}
                        placeholder="0"
                      />
                    </label>
                    <p className="mt-1.5 text-[9px] text-[#68766e]">
                      You can adjust stock later in Inventory management.
                    </p>
                  </div>
                )}
              </section>

              {draft.productType === "variable" && (
                <section className="rounded-xl border border-[#dce2da] bg-white p-4 sm:p-5">
                  <VariationEditor
                    attributes={draft.attributes}
                    variations={draft.variations}
                    basePrice={draft.price === "" ? Number.NaN : Number(draft.price)}
                    isCreating={editing === "new"}
                    onAttributesChange={(attributes) => setDraft({ ...draft, attributes })}
                    onVariationsChange={(variations) => setDraft({ ...draft, variations })}
                  />
                </section>
              )}
            </div>
            <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-2 border-t border-[#dde3dc] bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <Button
                kind="secondary"
                onClick={() => setEditing(null)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button type="submit" loading={saving} className="w-full sm:w-auto">
                {saving ? "Saving…" : "Save product"}
              </Button>
            </div>
          </form>
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-[#dce1d7] bg-white">
        <div className="filter-toolbar filter-toolbar-embedded filter-toolbar-three">
          <label className="filter-search">
            <span className="sr-only">Search products</span>
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7c8981]"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products"
              className="filter-control pl-9"
            />
          </label>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="filter-control px-3"
            aria-label="Filter products by category"
          >
            <option value="All">All categories</option>
            {managementCategories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
          <ClearFiltersButton
            disabled={!query && categoryFilter === "All"}
            onClick={() => {
              setQuery("");
              setCategoryFilter("All");
            }}
          />
        </div>
        <div className="table-wrap max-h-[480px] overflow-y-auto">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Type</th>
                <th>Price</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonTableRow key={i} columns={6} />
                ))
              ) : (
                <>
                  {filteredManagementItems.map((item) => {
                    const activeVariations = (item.variations ?? []).filter(
                      (variation) => variation.active,
                    );
                    const prices = activeVariations.map((variation) => variation.price);
                    const priceRange = prices.length
                      ? `${peso(Math.min(...prices))}${Math.min(...prices) === Math.max(...prices) ? "" : ` – ${peso(Math.max(...prices))}`}`
                      : peso(item.price);
                    return (
                      <tr key={item.id}>
                        <td data-label="Product" className="font-semibold">
                          {item.name}
                          {item.productType === "variable" && (
                            <span className="mt-1 block text-[10px] font-normal text-[#748078]">
                              {activeVariations.length} active variation
                              {activeVariations.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </td>
                        <td data-label="Category">{item.category}</td>
                        <td data-label="Type">
                          {item.productType === "variable" ? "With options" : "Simple"}
                        </td>
                        <td data-label="Price">{priceRange}</td>
                        <td data-label="Updated">
                          {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "—"}
                        </td>
                        <td data-label="Actions">
                          <div className="flex gap-3">
                            <button
                              onClick={() => openProductForm(item)}
                              className="min-h-11 rounded-lg px-3 font-semibold text-[#184d37] hover:bg-[#edf2eb]"
                            >
                              Manage
                            </button>
                            {isProduct && (
                              <button
                                onClick={() =>
                                  setConfirmation({
                                    title: "Remove this product?",
                                    message: `${item.name} will be removed from active inventory and will no longer be available for ordering.`,
                                confirmLabel: "Remove product",
                                destructive: true,
                                onConfirm: () => deleteProduct(item),
                              })
                            }
                            className="danger-button min-h-11 rounded-lg px-3 font-semibold"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && !filteredManagementItems.length && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-[#69766e]">
                    No records match your search and filters.
                  </td>
                </tr>
              )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmationDialog
        config={confirmation}
        busy={saving}
        onClose={() => setConfirmation(null)}
      />
      {feedback && (
        <FeedbackToast
          message={feedback.message}
          tone={feedback.tone}
          onClose={() => setFeedback(null)}
        />
      )}
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
          <p className="mt-5 text-xs leading-6 text-white/75">
            Reliable campus essentials and document services for the PLMun community, available
            online and ready for convenient pickup.
          </p>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[.18em] text-white/65">
            Explore
          </div>
          <div className="mt-4 grid gap-3 text-xs text-white/80">
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
          <div className="text-[10px] font-bold uppercase tracking-[.18em] text-white/65">
            Visit the center
          </div>
          <div className="mt-4 space-y-3 text-xs leading-5 text-white/80">
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
        <div className="mx-auto flex max-w-[1270px] flex-wrap items-center justify-between gap-3 px-6 py-5 text-[9px] text-white/60 sm:px-9">
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
  const [storedSession] = useState<AuthUser | null>(readStoredSession);
  const [user, setUser] = useState<AuthUser | null>(storedSession);
  const [sessionChecking, setSessionChecking] = useState(Boolean(storedSession));
  const [page, setPage] = useState("Home");
  const [pageHistory, setPageHistory] = useState<string[]>([]);
  const [cart, setCart] = useState<Cart>(() =>
    storedSession?.role === "student" ? loadStoredCart(storedSession.id) : {},
  );
  const [selected, setSelected] = useState<Product | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [lastPlacedOrder, setLastPlacedOrder] = useState<OnlineOrder | null>(null);
  const [toast, setToast] = useState("");
  const mainRef = useRef<HTMLElement>(null);
  const cartCount = useMemo(
    () => Object.values(cart).reduce((sum, line) => sum + line.quantity, 0),
    [cart],
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("plmun-theme", theme);
    const favicon = document.querySelector<HTMLLinkElement>("#app-favicon");
    if (favicon) favicon.href = `/assets/plmun-favicon-${theme}-theme.png`;
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === "dark" ? "#101112" : "#123d2c";
  }, [theme]);
  useEffect(() => {
    if (user?.role === "student") saveStoredCart(user.id, cart);
  }, [cart, user?.id, user?.role]);
  useEffect(() => {
    if (!storedSession) return;
    let active = true;
    authProvider
      .restoreSession()
      .then((restored) => {
        if (active) {
          setUser(restored);
          setCart(restored?.role === "student" ? loadStoredCart(restored.id) : {});
        }
      })
      .finally(() => {
        if (active) setSessionChecking(false);
      });
    return () => {
      active = false;
    };
  }, [storedSession]);
  useEffect(() => {
    const expireSession = () => {
      void authProvider.signOut();
      setUser(null);
      setPage("Home");
      setPageHistory([]);
      setCart({});
      setLastPlacedOrder(null);
      setSessionChecking(false);
    };
    window.addEventListener("auth:expired", expireSession);
    return () => window.removeEventListener("auth:expired", expireSession);
  }, []);
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
  const add = (p: Product, quantity = 1, variation: ProductVariation | null = null) => {
    const key = `${p.id}:${variation?.id ?? "standard"}`;
    const stock = variation?.stock ?? p.stock;
    setCart((current) => ({
      ...current,
      [key]: {
        productId: p.id,
        variationId: variation?.id ?? null,
        variationValues: variation?.values ?? {},
        variationLabel: variation ? variationLabel(variation.values) : null,
        unitPrice: variation?.price ?? p.price,
        quantity: Math.min(stock, (current[key]?.quantity ?? 0) + quantity),
      },
    }));
    setToast(
      `${quantity}× ${p.name}${variation ? ` · ${variationLabel(variation.values)}` : ""} added to cart`,
    );
  };
  const openProduct = (product: Product) => {
    setSelectedQuantity(1);
    setSelectedOptions(
      Object.fromEntries(
        (product.attributes ?? []).map((attribute) => [attribute.name, attribute.values[0] ?? ""]),
      ),
    );
    setSelected(product);
  };
  const selectedVariation =
    selected?.productType === "variable"
      ? ((selected.variations ?? []).find(
          (variation) => variation.key === variationKey(selectedOptions) && variation.active,
        ) ?? null)
      : null;
  const selectedPrice = selectedVariation?.price ?? selected?.price ?? 0;
  const selectedStock =
    selected?.productType === "variable" ? (selectedVariation?.stock ?? 0) : (selected?.stock ?? 0);
  const selectedImage = selectedVariation?.image || selected?.image || "";
  if (sessionChecking) {
    return (
      <main
        data-theme={theme}
        className="login-shell grid min-h-screen place-items-center bg-[#edf0e8]"
      >
        <div className="text-center">
          <img
            src="/assets/plmun-logo.png"
            alt="PLMun seal"
            className="mx-auto size-14 object-contain"
          />
          <p className="mt-4 text-xs font-semibold text-[#526159]">Restoring your session…</p>
        </div>
      </main>
    );
  }
  if (!user) {
    return (
      <Login
        theme={theme}
        onAuthenticated={(nextUser) => {
          window.sessionStorage.removeItem(`plmun-urgent-shown-${nextUser.id}`);
          setCart(nextUser.role === "student" ? loadStoredCart(nextUser.id) : {});
          setUser(nextUser);
          setSessionChecking(false);
          setPage(nextUser.role === "student" ? "Home" : "Dashboard");
          setPageHistory([]);
          setLastPlacedOrder(null);
        }}
      />
    );
  }

  const role = user.role;
  const signOut = async () => {
    if (user.role === "student") saveStoredCart(user.id, cart);
    await authProvider.signOut();
    setUser(null);
    setPage("Home");
    setPageHistory([]);
    setCart({});
    setLastPlacedOrder(null);
  };

  const content = (() => {
    if (role === "student") {
      if (page === "Home")
        return <StudentHome setPage={navigate} add={openProduct} open={openProduct} />;
      if (page === "Products") return <ProductsPage add={openProduct} open={openProduct} />;
      if (page === "Services")
        return <ProductsPage serviceOnly add={openProduct} open={openProduct} />;
      if (page === "Cart") return <CartPage cart={cart} setCart={setCart} setPage={navigate} />;
      if (page === "Checkout")
        return (
          <Checkout
            cart={cart}
            setCart={setCart}
            setPage={navigate}
            user={user}
            onOrderCreated={setLastPlacedOrder}
          />
        );
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
              {lastPlacedOrder ? (
                <>
                  Your order <strong>{lastPlacedOrder.id}</strong> was submitted for review.
                </>
              ) : (
                "Your order was submitted for review."
              )}
            </p>
            <div className="mx-auto mt-6 max-w-sm rounded-md bg-[#f3f4ed] p-4 text-left text-xs leading-6 text-[#657068]">
              Pickup:{" "}
              {lastPlacedOrder
                ? `${new Date(`${lastPlacedOrder.pickupDate}T00:00:00`).toLocaleDateString()}, ${lastPlacedOrder.pickupWindow}`
                : "See your order details"}
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
      if (page === "Order detail") return <OrderDetailPage />;
      return <OrdersPage setPage={navigate} />;
    }
    if (page === "Dashboard")
      return <Dashboard role={role} userName={user.name} setPage={navigate} />;
    if (role === "staff" && page === "POS terminal") return <PosTerminal />;
    if (role === "staff" && page === "Order management") return <OrderManagementPage />;
    if (
      role === "admin" &&
      (page === "Sales & transactions" || page === "Reports & transactions")
    ) {
      return <AdminReportsPage />;
    }
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
        {toast && <FeedbackToast message={toast} onClose={() => setToast("")} />}
        {selected && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b0d0e]/65 p-4 backdrop-blur-sm"
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
                src={selectedImage}
                alt={selected.name}
                decoding="async"
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
                <div className="mt-2 text-lg font-bold text-[#184d37]">{peso(selectedPrice)}</div>
                <p className="mt-5 text-sm leading-6 text-[#6e7971]">{selected.description}</p>
                {selected.productType === "variable" && (
                  <div className="mt-5 space-y-4">
                    {(selected.attributes ?? []).map((attribute) => (
                      <fieldset key={attribute.id}>
                        <legend className="text-xs font-semibold text-[#40564b]">
                          Select {attribute.name}
                        </legend>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {attribute.values.map((value) => {
                            const candidate = { ...selectedOptions, [attribute.name]: value };
                            const available = isOptionValueAvailable(
                              selected.variations ?? [],
                              selectedOptions,
                              attribute.name,
                              value,
                            );
                            return (
                              <button
                                key={value}
                                type="button"
                                disabled={!available}
                                onClick={() => {
                                  setSelectedOptions(candidate);
                                  setSelectedQuantity(1);
                                }}
                                className={`min-h-10 rounded-lg border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${
                                  selectedOptions[attribute.name] === value
                                    ? "border-[#184d37] bg-[#184d37] text-white"
                                    : "border-[#cdd6ce] bg-white text-[#476053] hover:border-[#789080]"
                                }`}
                              >
                                {value}
                              </button>
                            );
                          })}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                )}
                <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-[#dce2da] bg-[#f2f4ed] p-3">
                  <AvailabilityBadge stock={selectedStock} />
                  <span className="text-[10px] font-semibold text-[#607068]">Campus pickup</span>
                </div>
                <div className="mt-4 rounded-xl border border-[#dce2da] bg-[#f8faf7] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[.1em] text-[#718078]">
                        Quantity
                      </div>
                      <div className="mt-1 text-xs text-[#627168]">{peso(selectedPrice)} each</div>
                    </div>
                    <div className="flex min-h-11 items-center overflow-hidden rounded-lg border border-[#cbd3ca] bg-white">
                      <button
                        type="button"
                        onClick={() => setSelectedQuantity((quantity) => Math.max(1, quantity - 1))}
                        disabled={selectedQuantity <= 1}
                        className="grid size-11 place-items-center text-[#496155] hover:bg-[#edf2ed] disabled:opacity-35"
                        aria-label={`Decrease ${selected.name} quantity`}
                      >
                        <Minus size={15} />
                      </button>
                      <span className="w-10 text-center text-sm font-bold text-[#263f33]">
                        {selectedQuantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedQuantity((quantity) => Math.min(selectedStock, quantity + 1))
                        }
                        disabled={selectedQuantity >= selectedStock}
                        className="grid size-11 place-items-center text-[#184d37] hover:bg-[#edf2ed] disabled:opacity-35"
                        aria-label={`Increase ${selected.name} quantity`}
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-[#dde3dc] pt-3 text-sm font-bold text-[#173d2f]">
                    <span>Subtotal</span>
                    <span>{peso(selectedPrice * selectedQuantity)}</span>
                  </div>
                </div>
                <div className="responsive-cta-group mt-6">
                  <Button
                    disabled={
                      selectedStock <= 0 ||
                      (selected.productType === "variable" && !selectedVariation)
                    }
                    className="w-full sm:flex-1"
                    onClick={() => {
                      add(selected, selectedQuantity, selectedVariation);
                      setSelected(null);
                    }}
                  >
                    Add {selectedQuantity}
                    {selectedVariation
                      ? ` · ${variationLabel(selectedVariation.values)}`
                      : ""} ·{" "}
                    {peso(selectedPrice * selectedQuantity)}
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
