import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();
// Supabase includes the deployed function slug in req.url.pathname.
const prefix = "/server/make-server-2e4384b4";

app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const adminClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const publicClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);

const presetAccounts = [
  {
    email: "student@plmun.edu.ph",
    password: "student123",
    metadata: { name: "Alex Rivera", role: "student", reference: "2025-00142" },
  },
  {
    email: "staff@plmun.edu.ph",
    password: "staff123",
    metadata: { name: "Maria Santos", role: "staff", reference: "BC-STAFF-007" },
  },
  {
    email: "admin@plmun.edu.ph",
    password: "admin123",
    metadata: { name: "Nicole Reyes", role: "admin", reference: "BC-ADMIN-001" },
  },
];

const initialProducts = [
  {
    id: 1,
    name: "Spiral notebook",
    category: "Notebooks",
    price: 45,
    stock: 26,
    image: "/assets/spiral-notebook.jpg",
    description: "A5 ruled notebook with 80 smooth, easy-tear pages.",
  },
  {
    id: 2,
    name: "Premium ballpen",
    category: "Writing",
    price: 20,
    stock: 64,
    image: "/assets/notebook-pen.jpg",
    description: "Fine 0.5 mm black ink for clear everyday writing.",
  },
  {
    id: 3,
    name: "Student essentials set",
    category: "Bundles",
    price: 85,
    stock: 18,
    image: "/assets/stationery.jpg",
    description: "Notebook, pen, pencil and eraser in one useful set.",
  },
  {
    id: 4,
    name: "Printing · 10 pages",
    category: "Services",
    price: 10,
    stock: 999,
    image: "/assets/stationery.jpg",
    description: "Black and white A4 printing, ready in minutes.",
  },
  {
    id: 5,
    name: "Photocopying · 20 pages",
    category: "Services",
    price: 20,
    stock: 999,
    image: "/assets/notebook-pen.jpg",
    description: "Clear A4 photocopies on standard white paper.",
  },
  {
    id: 6,
    name: "Hardbound journal",
    category: "Notebooks",
    price: 65,
    stock: 12,
    image: "/assets/spiral-notebook.jpg",
    description: "Durable cover, elastic strap and 120 ruled pages.",
  },
];

const toUser = (user: any) => ({
  id: user.id,
  email: user.email,
  name: user.user_metadata?.name ?? user.email,
  role: user.user_metadata?.role ?? "student",
  reference: user.user_metadata?.reference ?? "",
});

async function authenticatedUser(c: any) {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data, error } = await adminClient().auth.getUser(token);
  return error ? null : data.user;
}

async function requireAdmin(c: any) {
  const user = await authenticatedUser(c);
  if (!user) return { response: c.json({ error: "Authentication required." }, 401) };
  if (user.user_metadata?.role !== "admin") {
    return { response: c.json({ error: "Administrator access required." }, 403) };
  }
  return { user };
}

async function requireStaff(c: any) {
  const user = await authenticatedUser(c);
  if (!user) return { response: c.json({ error: "Authentication required." }, 401) };
  if (!["staff", "admin"].includes(user.user_metadata?.role)) {
    return { response: c.json({ error: "Staff access required." }, 403) };
  }
  return { user };
}

async function reconcileOnlineOrders() {
  const products = ((await kv.get("products")) ?? initialProducts) as any[];
  const orders = ((await kv.getByPrefix("order:")) ?? []) as any[];
  const available = new Map(products.map((product) => [Number(product.id), Number(product.stock)]));
  const activeOrders = orders
    .filter((order) => ["Pending review", "Confirmed", "Awaiting restock"].includes(order.status))
    .sort(
      (first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime(),
    );
  const changed: any[] = [];

  for (const order of activeOrders) {
    const missing = order.items.filter(
      (item: any) => (available.get(Number(item.productId)) ?? 0) < Number(item.quantity),
    );
    const nextStatus = missing.length ? "Awaiting restock" : "Confirmed";
    const nextMessage = missing.length
      ? `${missing.map((item: any) => item.name).join(", ")} became unavailable after a walk-in sale.`
      : "Stock is available and your order is confirmed.";

    if (!missing.length) {
      for (const item of order.items) {
        available.set(
          Number(item.productId),
          (available.get(Number(item.productId)) ?? 0) - Number(item.quantity),
        );
      }
    }

    if (order.status !== nextStatus || order.statusMessage !== nextMessage) {
      order.status = nextStatus;
      order.statusMessage = nextMessage;
      order.updatedAt = new Date().toISOString();
      changed.push(order);
    }
  }

  if (changed.length) {
    await kv.mset(
      changed.map((order) => `order:${order.id}`),
      changed,
    );
  }
  return changed;
}

app.get(`${prefix}/health`, (c) => c.json({ status: "ok" }));

app.post(`${prefix}/seed`, async (c) => {
  try {
    const existingProducts = await kv.get("products");
    if (!existingProducts) await kv.set("products", initialProducts);

    const client = adminClient();
    const { data: listed, error: listError } = await client.auth.admin.listUsers();
    if (listError) throw listError;

    for (const account of presetAccounts) {
      const existing = listed.users.find((user) => user.email === account.email);
      if (existing) {
        await client.auth.admin.updateUserById(existing.id, {
          password: account.password,
          email_confirm: true,
          user_metadata: account.metadata,
        });
      } else {
        const { error } = await client.auth.admin.createUser({
          email: account.email,
          password: account.password,
          email_confirm: true,
          user_metadata: account.metadata,
        });
        if (error) throw error;
      }
    }

    return c.json({ seeded: true });
  } catch (error) {
    console.log("Seed error:", error);
    return c.json({ error: "Unable to initialize the database." }, 500);
  }
});

app.post(`${prefix}/auth/login`, async (c) => {
  const { email, password } = await c.req.json();
  const { data, error } = await publicClient().auth.signInWithPassword({ email, password });
  if (error || !data.user || !data.session) {
    return c.json({ error: "The email or password is incorrect." }, 401);
  }
  return c.json({
    user: toUser(data.user),
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  });
});

app.post(`${prefix}/auth/demo-login`, async (c) => {
  const { role } = await c.req.json();
  const account = presetAccounts.find((preset) => preset.metadata.role === role);
  if (!account) return c.json({ error: "This demo account is not available." }, 404);

  try {
    const client = adminClient();
    const { data: listed, error: listError } = await client.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) throw listError;

    const existing = listed.users.find((user) => user.email === account.email);
    if (existing) {
      const { error } = await client.auth.admin.updateUserById(existing.id, {
        password: account.password,
        user_metadata: account.metadata,
      });
      if (error) throw error;
    } else {
      const { error } = await client.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: account.metadata,
      });
      if (error) throw error;
    }

    if (!(await kv.get("products"))) await kv.set("products", initialProducts);

    const { data, error } = await publicClient().auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    if (error || !data.user || !data.session) throw error ?? new Error("Demo sign-in failed.");

    return c.json({
      user: toUser(data.user),
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    });
  } catch (error) {
    console.log("Demo account error:", error);
    return c.json({ error: "The demo account could not be prepared. Please try again." }, 500);
  }
});

app.post(`${prefix}/auth/register`, async (c) => {
  const { name, reference, email, password } = await c.req.json();
  const cleanName = String(name ?? "").trim();
  const cleanReference = String(reference ?? "").trim();
  const cleanEmail = String(email ?? "")
    .trim()
    .toLowerCase();

  if (!cleanName || !cleanReference || !cleanEmail.includes("@") || String(password).length < 8) {
    return c.json(
      { error: "Enter your name, student ID, valid email, and an 8-character password." },
      400,
    );
  }

  const { data: created, error: createError } = await adminClient().auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
    user_metadata: {
      name: cleanName,
      role: "student",
      reference: cleanReference,
    },
  });

  if (createError || !created.user) {
    const duplicate = createError?.message.toLowerCase().includes("already");
    return c.json(
      { error: duplicate ? "An account with this email already exists." : "Unable to register." },
      duplicate ? 409 : 400,
    );
  }

  const { data, error } = await publicClient().auth.signInWithPassword({
    email: cleanEmail,
    password,
  });
  if (error || !data.user || !data.session) {
    return c.json({ error: "Account created. Please sign in." }, 201);
  }

  return c.json(
    {
      user: toUser(data.user),
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    },
    201,
  );
});

app.get(`${prefix}/auth/me`, async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Session expired." }, 401);
  return c.json({ user: toUser(user) });
});

app.get(`${prefix}/products`, async (c) => {
  const products = (await kv.get("products")) ?? initialProducts;
  return c.json({ products });
});

app.get(`${prefix}/orders`, async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Authentication required." }, 401);
  const allOrders = ((await kv.getByPrefix("order:")) ?? []) as any[];
  const orders =
    user.user_metadata?.role === "student"
      ? allOrders.filter((order) => order.userId === user.id)
      : allOrders;
  return c.json({
    orders: orders.sort(
      (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
    ),
  });
});

app.post(`${prefix}/orders`, async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Authentication required." }, 401);
  const input = await c.req.json();
  const products = ((await kv.get("products")) ?? initialProducts) as any[];
  const items = (input.items ?? [])
    .map((item: any) => {
      const product = products.find((candidate) => Number(candidate.id) === Number(item.productId));
      if (!product || Number(item.quantity) < 1) return null;
      return {
        productId: product.id,
        name: product.name,
        quantity: Number(item.quantity),
        price: Number(product.price),
      };
    })
    .filter(Boolean);
  if (!items.length) return c.json({ error: "Your order has no valid items." }, 400);

  const id = `ORD-${Date.now().toString().slice(-7)}`;
  const order = {
    id,
    userId: user.id,
    customerName: user.user_metadata?.name ?? user.email,
    customerEmail: user.email,
    items,
    total: items.reduce((total: number, item: any) => total + item.price * item.quantity, 0),
    status: "Pending review",
    statusMessage: "We’re checking current counter stock before confirming your order.",
    pickupDate: input.pickupDate,
    pickupWindow: input.pickupWindow,
    notes: String(input.notes ?? ""),
    source: "online",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await kv.set(`order:${id}`, order);
  await reconcileOnlineOrders();
  return c.json({ order: await kv.get(`order:${id}`) }, 201);
});

app.put(`${prefix}/orders/:id/status`, async (c) => {
  const auth = await requireStaff(c);
  if (auth.response) return auth.response;
  const order = await kv.get(`order:${c.req.param("id")}`);
  if (!order) return c.json({ error: "Order not found." }, 404);
  const { status, message } = await c.req.json();
  const allowed = ["Confirmed", "Awaiting restock", "Ready for pickup", "Completed", "Cancelled"];
  if (!allowed.includes(status)) return c.json({ error: "Invalid order status." }, 400);

  if (status === "Confirmed" && order.status === "Awaiting restock") {
    await reconcileOnlineOrders();
    const reconciled = await kv.get(`order:${order.id}`);
    if (reconciled.status !== "Confirmed") {
      return c.json({ error: "This order still does not have enough stock." }, 409);
    }
    return c.json({ order: reconciled });
  }

  if (status === "Ready for pickup" && order.status !== "Ready for pickup") {
    const products = ((await kv.get("products")) ?? initialProducts) as any[];
    for (const item of order.items) {
      const product = products.find((candidate) => Number(candidate.id) === Number(item.productId));
      if (!product || Number(product.stock) < Number(item.quantity)) {
        await reconcileOnlineOrders();
        return c.json(
          { error: `${product?.name ?? "An item"} is no longer available for this order.` },
          409,
        );
      }
    }
    for (const item of order.items) {
      const product = products.find((candidate) => Number(candidate.id) === Number(item.productId));
      product.stock = Number(product.stock) - Number(item.quantity);
    }
    await kv.set("products", products);
  }

  const updated = {
    ...order,
    status,
    statusMessage: String(message ?? order.statusMessage),
    updatedAt: new Date().toISOString(),
  };
  await kv.set(`order:${order.id}`, updated);
  if (["Cancelled", "Completed", "Ready for pickup"].includes(status)) {
    await reconcileOnlineOrders();
  }
  return c.json({ order: updated });
});

app.post(`${prefix}/pos/checkout`, async (c) => {
  const auth = await requireStaff(c);
  if (auth.response) return auth.response;
  const input = await c.req.json();
  const products = ((await kv.get("products")) ?? initialProducts) as any[];
  const saleItems = (input.items ?? []).filter((item: any) => Number(item.quantity) > 0);

  for (const item of saleItems) {
    const product = products.find((candidate) => Number(candidate.id) === Number(item.productId));
    if (!product || Number(product.stock) < Number(item.quantity)) {
      return c.json({ error: `${product?.name ?? "An item"} does not have enough stock.` }, 409);
    }
  }

  for (const item of saleItems) {
    const product = products.find((candidate) => Number(candidate.id) === Number(item.productId));
    product.stock = Number(product.stock) - Number(item.quantity);
  }
  await kv.set("products", products);
  const transaction = {
    id: `TX-${Date.now().toString().slice(-7)}`,
    items: saleItems,
    total: saleItems.reduce((total: number, item: any) => {
      const product = products.find((candidate) => Number(candidate.id) === Number(item.productId));
      return total + Number(product?.price ?? 0) * Number(item.quantity);
    }, 0),
    source: "walk-in",
    staffId: auth.user?.id,
    createdAt: new Date().toISOString(),
  };
  await kv.set(`transaction:${transaction.id}`, transaction);
  const impactedOrders = (await reconcileOnlineOrders()).filter(
    (order) => order.status === "Awaiting restock",
  );
  return c.json({ transaction, impactedOrders, products });
});

app.post(`${prefix}/products`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth.response) return auth.response;
  const input = await c.req.json();
  const products = ((await kv.get("products")) ?? initialProducts) as any[];
  const nextId = products.reduce((max, product) => Math.max(max, Number(product.id)), 0) + 1;
  const product = {
    id: nextId,
    name: String(input.name ?? "").trim(),
    category: String(input.category ?? "Notebooks"),
    price: Number(input.price ?? 0),
    stock: Number(input.stock ?? 0),
    image: String(input.image ?? "/assets/stationery.jpg"),
    description: String(input.description ?? ""),
  };
  if (!product.name || product.price < 0 || product.stock < 0) {
    return c.json({ error: "Invalid product details." }, 400);
  }
  await kv.set("products", [...products, product]);
  return c.json({ product }, 201);
});

app.put(`${prefix}/products/:id`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth.response) return auth.response;
  const id = Number(c.req.param("id"));
  const input = await c.req.json();
  const products = ((await kv.get("products")) ?? initialProducts) as any[];
  const index = products.findIndex((product) => Number(product.id) === id);
  if (index < 0) return c.json({ error: "Product not found." }, 404);
  products[index] = {
    ...products[index],
    ...input,
    id,
    price: Number(input.price ?? products[index].price),
    stock: Number(input.stock ?? products[index].stock),
  };
  await kv.set("products", products);
  await reconcileOnlineOrders();
  return c.json({ product: products[index] });
});

app.delete(`${prefix}/products/:id`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth.response) return auth.response;
  const id = Number(c.req.param("id"));
  const products = ((await kv.get("products")) ?? initialProducts) as any[];
  await kv.set(
    "products",
    products.filter((product) => Number(product.id) !== id),
  );
  return c.json({ deleted: true });
});

Deno.serve(app.fetch);
