import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { type AuthUser, authProvider, readStoredSession, type Role } from "./auth";
import Login from "./Login";
import {
  createProduct,
  deleteProduct,
  fallbackProducts,
  getProducts,
  type Product,
  updateProduct,
} from "./products";

type ProductStore = {
  products: Product[];
  loading: boolean;
  addProduct: (product: Omit<Product, "id">) => Promise<void>;
  editProduct: (id: number, updates: Partial<Product>) => Promise<void>;
  removeProduct: (id: number) => Promise<void>;
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

const peso = (value: number) => `₱${value.toFixed(2)}`;

function Mark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-full bg-[#184d37] text-sm font-bold text-white shadow-sm">
        P
      </span>
      <div className="leading-none">
        <div className="text-[13px] font-bold tracking-[.14em] text-[#163e30]">PLMUN BC</div>
        <div className="mt-1 text-[9px] uppercase tracking-[.18em] text-[#7e877c]">
          Business Center
        </div>
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
      className={`rounded-md px-4 py-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
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
      ? "bg-[#dfe9dc] text-[#174733]"
      : tone === "amber"
        ? "bg-[#f1edd5] text-[#685d21]"
        : "bg-[#eceeea] text-[#5b655e]";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${color}`}>
      {children}
    </span>
  );
}

function Header({
  user,
  page,
  setPage,
  cartCount,
  onSignOut,
}: {
  user: AuthUser;
  page: string;
  setPage: (p: string) => void;
  cartCount: number;
  onSignOut: () => void;
}) {
  const role = user.role;
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-[#dfe1d8] bg-[#fbfcf7]/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-[1500px] items-center gap-7 px-4 sm:px-7">
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
                className={`h-full border-b-2 px-3 text-xs font-semibold ${page === item ? "border-[#184d37] text-[#184d37]" : "border-transparent text-[#687168] hover:text-[#184d37]"}`}
              >
                {item}
              </button>
            ))}
          </nav>
        )}
        <label className="relative ml-auto hidden w-full max-w-[350px] md:block">
          <span className="absolute left-3 top-2.5 text-[#8d958b]">⌕</span>
          <input
            onFocus={() => setPage(role === "student" ? "Products" : page)}
            className="w-full rounded-md border border-[#dfe3da] bg-white py-2.5 pl-9 pr-3 text-xs outline-none focus:border-[#184d37]"
            placeholder="Search the system"
          />
        </label>
        {role === "student" && (
          <button
            onClick={() => setPage("Cart")}
            className="relative rounded-md px-2 py-2 text-xs font-semibold text-[#374c42] hover:bg-[#edf0e8]"
          >
            Cart{" "}
            <span className="ml-1 rounded-full bg-[#184d37] px-1.5 py-0.5 text-[9px] text-white">
              {cartCount}
            </span>
          </button>
        )}
        <div className="hidden text-right sm:block">
          <div className="text-[11px] font-semibold text-[#263d32]">{user.name}</div>
          <div className="text-[9px] capitalize text-[#899087]">{role}</div>
        </div>
        <button
          onClick={onSignOut}
          className="hidden rounded-md border border-[#d8ddd4] px-3 py-2 text-[10px] font-semibold text-[#486056] hover:border-[#184d37] sm:block"
        >
          Sign out
        </button>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-md border border-[#d8ddd4] p-2 text-xs lg:hidden"
          aria-label="Open navigation"
        >
          Menu
        </button>
      </div>
      {mobileOpen && (
        <div className="border-t border-[#e1e4dc] bg-white p-3 lg:hidden">
          {navByRole[role].map((item) => (
            <button
              key={item}
              onClick={() => {
                setPage(item);
                setMobileOpen(false);
              }}
              className="block w-full rounded px-3 py-2 text-left text-xs font-semibold hover:bg-[#edf0e8]"
            >
              {item}
            </button>
          ))}
          <button
            onClick={onSignOut}
            className="mt-2 block w-full rounded border border-[#d8ddd4] px-3 py-2 text-left text-xs font-semibold text-[#6b4a42]"
          >
            Sign out
          </button>
        </div>
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
    <aside className="hidden w-[230px] shrink-0 border-r border-[#dfe1d8] bg-[#f8f9f3] p-4 lg:flex lg:flex-col">
      <div className="space-y-1">
        {navByRole[role].map((item) => (
          <button
            key={item}
            onClick={() => setPage(item)}
            className={`w-full rounded-md px-3 py-3 text-left text-xs font-semibold transition ${page === item ? "bg-[#184d37] text-white" : "text-[#57675e] hover:bg-[#e8ece4]"}`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="mt-auto rounded-md border border-[#dfe4da] bg-white p-3 text-[10px] leading-5 text-[#707a72]">
        <div className="font-semibold text-[#274b3a]">PLMun Business Center</div>
        Service hours: 8:00 AM–5:00 PM
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
    <article className="group overflow-hidden rounded-lg border border-[#dfe2d9] bg-white shadow-[0_1px_2px_rgba(30,55,42,.04)] transition hover:-translate-y-0.5 hover:shadow-md">
      <button
        onClick={() => open(product)}
        className="block w-full overflow-hidden bg-[#eeeee6] text-left"
      >
        <img
          src={product.image}
          alt={product.name}
          className="h-36 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
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
          <span className="text-[10px] text-[#899188]">
            {product.stock > 50 ? "In stock" : `${product.stock} available`}
          </span>
          <Button onClick={() => add(product)} className="px-3 py-2">
            Add to cart
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
  return (
    <>
      <section className="mb-8 overflow-hidden rounded-xl bg-[#e9eadf]">
        <div className="grid items-center md:grid-cols-[1.05fr_.95fr]">
          <div className="p-7 sm:p-10 lg:p-14">
            <div className="mb-4 text-[10px] font-bold uppercase tracking-[.22em] text-[#557063]">
              PLMun Business Center
            </div>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-[-.045em] text-[#143b2d] sm:text-5xl">
              Everything you need for a productive school day.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-6 text-[#657068]">
              Shop school essentials, request printing services, and pick up your order on
              campus—without the long wait.
            </p>
            <div className="mt-7 flex gap-3">
              <Button onClick={() => setPage("Products")}>Browse products</Button>
              <Button kind="secondary" onClick={() => setPage("Services")}>
                View services
              </Button>
            </div>
          </div>
          <img
            src="/assets/stationery.jpg"
            alt="Notebook and pen on a desk"
            className="min-h-[290px] h-full w-full object-cover"
          />
        </div>
      </section>
      <SectionTitle
        title="Featured products"
        subtitle="Student favorites, ready for campus pickup."
        action={
          <Button kind="ghost" onClick={() => setPage("Products")}>
            View all products
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {products.slice(0, 4).map((p) => (
          <ProductCard key={p.id} product={p} add={add} open={open} />
        ))}
      </div>
      <div className="mt-9 grid gap-4 md:grid-cols-3">
        {[
          ["01", "Order online", "Choose products and services whenever it suits you."],
          ["02", "We prepare it", "Our team gets your order ready and sends an update."],
          ["03", "Pick up on campus", "Show your order number at the Business Center."],
        ].map((x) => (
          <div key={x[0]} className="rounded-lg border border-[#dee2d9] bg-white p-5">
            <div className="text-xs font-bold text-[#8a947e]">{x[0]}</div>
            <div className="mt-4 text-sm font-semibold text-[#163d2f]">{x[1]}</div>
            <p className="mt-1 text-xs leading-5 text-[#7b847c]">{x[2]}</p>
          </div>
        ))}
      </div>
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
  const [category, setCategory] = useState(serviceOnly ? "Services" : "All");
  const categories = serviceOnly
    ? ["Services"]
    : ["All", "Notebooks", "Writing", "Bundles", "Services"];
  const shown = products.filter(
    (p) =>
      (category === "All" || p.category === category) &&
      p.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <SectionTitle
        title={serviceOnly ? "Services" : "Products and services"}
        subtitle={
          serviceOnly
            ? "Convenient print and document services for students."
            : "Browse school supplies and on-campus services."
        }
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products"
          className="min-w-[220px] flex-1 rounded-md border border-[#d9dfd5] bg-white px-3 py-2.5 text-xs outline-none focus:border-[#184d37]"
        />
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-md px-3 py-2 text-[11px] font-semibold ${category === c ? "bg-[#184d37] text-white" : "border border-[#d7ddd3] bg-white text-[#56655d]"}`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((p) => (
          <ProductCard key={p.id} product={p} add={add} open={open} />
        ))}
      </div>
      {!shown.length && (
        <div className="rounded-lg border border-dashed border-[#cfd6cc] py-16 text-center text-sm text-[#7c857d]">
          No products match your search.
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
  const total = products.reduce((s, p) => s + (cart[p.id] || 0) * p.price, 0);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setCart({});
    setPage("Confirmation");
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
                <input type="date" defaultValue="2025-03-14" required />
              </label>
              <label className="field">
                Pickup window
                <select defaultValue="1:00–3:00 PM">
                  <option>9:00–11:00 AM</option>
                  <option>1:00–3:00 PM</option>
                  <option>3:00–5:00 PM</option>
                </select>
              </label>
              <label className="field sm:col-span-2">
                Notes
                <textarea rows={3} placeholder="Add special instructions (optional)" />
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
          <Button type="submit" className="mt-5 w-full">
            Place order
          </Button>
        </aside>
      </div>
    </form>
  );
}

function OrdersPage({ setPage }: { setPage: (p: string) => void }) {
  return (
    <>
      <SectionTitle
        title="My orders"
        subtitle="Track current orders and view your purchase history."
      />
      <div className="overflow-hidden rounded-lg border border-[#dde1d8] bg-white">
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
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="font-semibold text-[#1b4635]">{o.id}</td>
                  <td>{o.date}</td>
                  <td>{o.items}</td>
                  <td>{o.total}</td>
                  <td>
                    <Pill tone={o.status.includes("Ready") ? "green" : "gray"}>{o.status}</Pill>
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
            </tbody>
          </table>
        </div>
      </div>
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
          <Button onClick={() => setPage(role === "staff" ? "POS terminal" : "Sales reports")}>
            {role === "staff" ? "Open POS terminal" : "View reports"}
          </Button>
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
            <div className="mt-4 table-wrap">
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
                  <div className="text-[10px] text-[#8a928a]">
                    {role === "staff"
                      ? `${p.stock} available`
                      : `${Math.min(p.stock, 8)} units left`}
                  </div>
                </div>
                <Pill tone={p.stock < 20 ? "amber" : "green"}>{p.stock < 20 ? "Low" : "Good"}</Pill>
              </div>
            ))}
          </div>
          <Button
            className="mt-3 w-full"
            kind="secondary"
            onClick={() => setPage(role === "staff" ? "POS terminal" : "Inventory management")}
          >
            {role === "staff" ? "Start a transaction" : "Manage inventory"}
          </Button>
        </div>
      </div>
    </>
  );
}

function PosTerminal() {
  const { products } = useProductStore();
  const [sale, setSale] = useState<Record<number, number>>({});
  const [done, setDone] = useState(false);
  const total = products.reduce((s, p) => s + (sale[p.id] || 0) * p.price, 0);
  if (done)
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-[#dce1d7] bg-white p-10 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#dce9de] text-xl text-[#174733]">
          ✓
        </span>
        <h1 className="mt-5 text-2xl font-semibold text-[#173d2f]">Transaction completed</h1>
        <p className="mt-2 text-xs text-[#78827a]">Receipt TX-0087 · Total {peso(total)}</p>
        <Button
          className="mt-6"
          onClick={() => {
            setDone(false);
            setSale({});
          }}
        >
          New transaction
        </Button>
      </div>
    );
  return (
    <>
      <SectionTitle title="POS terminal" subtitle="Create a quick walk-in transaction." />
      <div className="grid gap-5 xl:grid-cols-[1fr_370px]">
        <div>
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => setSale((c) => ({ ...c, [p.id]: (c[p.id] || 0) + 1 }))}
                className="rounded-lg border border-[#dce1d7] bg-white p-3 text-left transition hover:border-[#184d37]"
              >
                <img src={p.image} alt="" className="h-24 w-full rounded-md object-cover" />
                <div className="mt-3 text-xs font-semibold text-[#224837]">{p.name}</div>
                <div className="mt-1 text-[11px] font-bold text-[#184d37]">{peso(p.price)}</div>
                <div className="mt-3 text-center text-[10px] font-semibold text-[#547063]">
                  Add item
                </div>
              </button>
            ))}
          </div>
        </div>
        <aside className="h-fit rounded-lg border border-[#dce1d7] bg-white p-5">
          <h2 className="text-sm font-semibold">Current transaction</h2>
          <div className="mt-4 min-h-32 space-y-3">
            {products
              .filter((p) => sale[p.id])
              .map((p) => (
                <div key={p.id} className="flex justify-between text-xs">
                  <span>
                    {sale[p.id]}× {p.name}
                  </span>
                  <span>{peso(p.price * sale[p.id])}</span>
                </div>
              ))}
            {!total && (
              <p className="pt-8 text-center text-xs text-[#919991]">Select a product to begin.</p>
            )}
          </div>
          <div className="flex justify-between border-t pt-4 text-base font-bold text-[#173d2f]">
            <span>Total</span>
            <span>{peso(total)}</span>
          </div>
          <Button disabled={!total} className="mt-5 w-full" onClick={() => setDone(true)}>
            Complete transaction
          </Button>
        </aside>
      </div>
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
            className="w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl"
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
              <button type="button" onClick={() => setEditing(null)} className="text-xs">
                Close
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
            <div className="mt-6 flex justify-end gap-2">
              <Button kind="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save product"}
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
            className="min-w-[220px] flex-1 rounded-md border border-[#d8ddd4] px-3 py-2 text-xs outline-none"
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
                      <td className="font-semibold">{item as string}</td>
                      <td>{(item as string).toLowerCase().replace(" ", ".")}@plmun.edu.ph</td>
                      <td>{i === 0 ? "Administrator" : i < 3 ? "Staff" : "Student"}</td>
                      <td>
                        <Pill>Active</Pill>
                      </td>
                      <td>Today</td>
                    </>
                  ) : (
                    <>
                      <td className="font-semibold">
                        {isReport || page === "Transaction history"
                          ? `TX-00${82 + i}`
                          : (item as Product).name}
                      </td>
                      <td>{(item as Product).category}</td>
                      <td>
                        {isInventory
                          ? `${(item as Product).stock} units`
                          : peso((item as Product).price)}
                      </td>
                      <td>
                        <Pill tone={(item as Product).stock < 20 ? "amber" : "green"}>
                          {(item as Product).stock < 20 ? "Low stock" : "Active"}
                        </Pill>
                      </td>
                      <td>Mar {12 - i}, 2025</td>
                    </>
                  )}
                  <td>
                    <div className="flex gap-3">
                      <button
                        onClick={() =>
                          !isUser && (isProduct || isInventory)
                            ? openProductForm(item as Product)
                            : setNotice("Record selected for review")
                        }
                        className="font-semibold text-[#184d37]"
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
                          className="font-semibold text-[#8a493e]"
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

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(readStoredSession);
  const [page, setPage] = useState("Home");
  const [cart, setCart] = useState<Record<number, number>>({ 1: 1, 2: 1 });
  const [selected, setSelected] = useState<Product | null>(null);
  const [toast, setToast] = useState("");
  const cartCount = useMemo(() => Object.values(cart).reduce((a, b) => a + b, 0), [cart]);
  const add = (p: Product) => {
    setCart((c) => ({ ...c, [p.id]: (c[p.id] || 0) + 1 }));
    setToast(`${p.name} added to cart`);
    window.setTimeout(() => setToast(""), 1800);
  };
  if (!user) {
    return (
      <Login
        onAuthenticated={(nextUser) => {
          setUser(nextUser);
          setPage(nextUser.role === "student" ? "Home" : "Dashboard");
        }}
      />
    );
  }

  const role = user.role;
  const signOut = async () => {
    await authProvider.signOut();
    setUser(null);
    setPage("Home");
    setCart({});
  };

  const content = (() => {
    if (role === "student") {
      if (page === "Home") return <StudentHome setPage={setPage} add={add} open={setSelected} />;
      if (page === "Products") return <ProductsPage add={add} open={setSelected} />;
      if (page === "Services") return <ProductsPage serviceOnly add={add} open={setSelected} />;
      if (page === "Cart") return <CartPage cart={cart} setCart={setCart} setPage={setPage} />;
      if (page === "Checkout") return <Checkout cart={cart} setCart={setCart} setPage={setPage} />;
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
            <Button className="mt-6" onClick={() => setPage("My orders")}>
              Track order
            </Button>
          </div>
        );
      if (page === "Order detail")
        return (
          <>
            <SectionTitle
              title="Order tracking · ORD-1042"
              subtitle="Placed March 12, 2025"
              action={
                <Button kind="secondary" onClick={() => setPage("My orders")}>
                  Back to orders
                </Button>
              }
            />
            <div className="rounded-lg border border-[#dce1d7] bg-white p-6">
              <h2 className="text-sm font-semibold">Order status: Ready for pickup</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-4">
                {["Order placed", "Preparing", "Ready for pickup", "Completed"].map((s, i) => (
                  <div key={s}>
                    <div className={`h-1 rounded ${i < 3 ? "bg-[#184d37]" : "bg-[#dfe4dc]"}`} />
                    <div className="mt-2 text-[10px] font-semibold text-[#557064]">{s}</div>
                  </div>
                ))}
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
      return <OrdersPage setPage={setPage} />;
    }
    if (page === "Dashboard") return <Dashboard role={role} setPage={setPage} />;
    if (role === "staff" && page === "POS terminal") return <PosTerminal />;
    return <ManagementPage page={page} />;
  })();

  return (
    <ProductDataProvider>
      <div className="min-h-screen bg-[#f1f1e8] text-[#223b30]">
        <Header
          user={user}
          page={page}
          setPage={setPage}
          cartCount={cartCount}
          onSignOut={signOut}
        />
        <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-[1500px]">
          <Sidebar role={role} page={page} setPage={setPage} />
          <main className="min-w-0 flex-1 p-4 sm:p-7 lg:p-9">{content}</main>
        </div>
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 rounded-md bg-[#173f30] px-4 py-3 text-xs font-semibold text-white shadow-xl">
            {toast}
          </div>
        )}
        {selected && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-[#10251d]/55 p-4"
            onMouseDown={() => setSelected(null)}
          >
            <div
              className="grid w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl md:grid-cols-2"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <img
                src={selected.image}
                alt={selected.name}
                className="h-full min-h-64 w-full object-cover"
              />
              <div className="p-7">
                <button
                  onClick={() => setSelected(null)}
                  className="float-right text-sm text-[#78827a]"
                >
                  Close
                </button>
                <div className="text-[10px] font-bold uppercase tracking-[.14em] text-[#829085]">
                  {selected.category}
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-[#163d2f]">{selected.name}</h2>
                <div className="mt-2 text-lg font-bold text-[#184d37]">{peso(selected.price)}</div>
                <p className="mt-5 text-sm leading-6 text-[#6e7971]">{selected.description}</p>
                <div className="mt-5 rounded-md bg-[#f2f4ed] p-3 text-xs text-[#607068]">
                  {selected.stock > 50 ? "In stock and ready" : `${selected.stock} available`} ·
                  Campus pickup
                </div>
                <Button
                  className="mt-6 w-full"
                  onClick={() => {
                    add(selected);
                    setSelected(null);
                  }}
                >
                  Add to cart
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProductDataProvider>
  );
}
