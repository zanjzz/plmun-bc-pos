import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";

const app = new Hono();
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
    profile: { full_name: "Alex Rivera", role: "student", reference: "2025-00142" },
  },
  {
    email: "staff@plmun.edu.ph",
    password: "staff123",
    profile: { full_name: "Maria Santos", role: "staff", reference: "BC-STAFF-007" },
  },
  {
    email: "admin@plmun.edu.ph",
    password: "admin123",
    profile: { full_name: "Nicole Reyes", role: "admin", reference: "BC-ADMIN-001" },
  },
];

const toProduct = (row: any) => ({
  id: Number(row.id),
  name: row.name,
  category: row.category,
  price: Number(row.price),
  stock: Number(row.stock),
  image: row.image,
  description: row.description,
});

const toUser = (user: any, profile: any) => ({
  id: user.id,
  email: user.email,
  name: profile.full_name,
  role: profile.role,
  reference: profile.reference,
});

const toOrder = (row: any) => ({
  id: row.order_number,
  userId: row.user_id,
  customerName: row.profiles?.full_name ?? "Student",
  customerEmail: row.profiles?.email ?? "",
  items: (row.order_items ?? []).map((item: any) => ({
    productId: Number(item.product_id),
    name: item.product_name,
    quantity: Number(item.quantity),
    price: Number(item.unit_price),
  })),
  total: Number(row.total),
  status: row.status,
  statusMessage: row.status_message,
  pickupDate: row.pickup_date,
  pickupWindow: row.pickup_window,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

async function getOrCreateProfile(user: any) {
  const client = adminClient();
  const { data: existing, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const profile = {
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Student",
    role: ["student", "staff", "admin"].includes(user.user_metadata?.role)
      ? user.user_metadata.role
      : "student",
    reference: user.user_metadata?.reference ?? "",
  };
  const { data, error: insertError } = await client
    .from("profiles")
    .upsert(profile)
    .select()
    .single();
  if (insertError) throw insertError;
  return data;
}

async function authenticatedContext(c: any) {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, profile: await getOrCreateProfile(data.user) };
}

async function requireRole(c: any, roles: string[]) {
  const auth = await authenticatedContext(c);
  if (!auth) return { response: c.json({ error: "Authentication required." }, 401) };
  if (!roles.includes(auth.profile.role)) {
    return { response: c.json({ error: "You do not have permission for this action." }, 403) };
  }
  return auth;
}

async function findAuthUserByEmail(email: string) {
  const client = adminClient();
  const { data: profile } = await client
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (profile?.id) {
    const { data } = await client.auth.admin.getUserById(profile.id);
    if (data.user) return data.user;
  }
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.find((user) => user.email === email) ?? null;
}

async function fetchOrderByNumber(orderNumber: string) {
  const { data, error } = await adminClient()
    .from("orders")
    .select("*, profiles(full_name,email), order_items(*)")
    .eq("order_number", orderNumber)
    .single();
  if (error) throw error;
  return data;
}

async function recordStatus(
  orderId: string,
  fromStatus: string | null,
  toStatus: string,
  message: string,
  actorId?: string,
) {
  const { error } = await adminClient()
    .from("order_status_history")
    .insert({
      order_id: orderId,
      from_status: fromStatus,
      to_status: toStatus,
      message,
      changed_by: actorId ?? null,
    });
  if (error) throw error;
}

async function reconcileOnlineOrders() {
  const client = adminClient();
  const { data: products, error: productsError } = await client
    .from("products")
    .select("id,name,stock")
    .eq("active", true);
  if (productsError) throw productsError;
  const { data: orders, error: ordersError } = await client
    .from("orders")
    .select("*, order_items(*)")
    .in("status", ["Pending review", "Confirmed", "Awaiting restock"])
    .order("created_at", { ascending: true });
  if (ordersError) throw ordersError;

  const available = new Map(products.map((product) => [Number(product.id), Number(product.stock)]));
  const changed: any[] = [];
  for (const order of orders) {
    const missing = order.order_items.filter(
      (item: any) => (available.get(Number(item.product_id)) ?? 0) < Number(item.quantity),
    );
    const status = missing.length ? "Awaiting restock" : "Confirmed";
    const message = missing.length
      ? `${missing.map((item: any) => item.product_name).join(", ")} became unavailable after a walk-in sale.`
      : "Stock is available and your order is confirmed.";
    if (!missing.length) {
      for (const item of order.order_items) {
        available.set(
          Number(item.product_id),
          (available.get(Number(item.product_id)) ?? 0) - Number(item.quantity),
        );
      }
    }
    if (order.status !== status || order.status_message !== message) {
      const { error } = await client
        .from("orders")
        .update({ status, status_message: message })
        .eq("id", order.id);
      if (error) throw error;
      await recordStatus(order.id, order.status, status, message);
      changed.push({ ...order, status, status_message: message });
    }
  }
  return changed;
}

app.get(`${prefix}/health`, (c) => c.json({ status: "ok", storage: "relational" }));

app.post(`${prefix}/auth/login`, async (c) => {
  const { email, password } = await c.req.json();
  const { data, error } = await publicClient().auth.signInWithPassword({ email, password });
  if (error || !data.user || !data.session) {
    return c.json({ error: "The email or password is incorrect." }, 401);
  }
  const profile = await getOrCreateProfile(data.user);
  if (!profile.active) return c.json({ error: "This account is inactive." }, 403);
  return c.json({ user: toUser(data.user, profile), accessToken: data.session.access_token });
});

app.post(`${prefix}/auth/demo-login`, async (c) => {
  const { role } = await c.req.json();
  const account = presetAccounts.find((preset) => preset.profile.role === role);
  if (!account) return c.json({ error: "This demo account is not available." }, 404);
  try {
    const client = adminClient();
    const existing = await findAuthUserByEmail(account.email);
    let user = existing;
    if (existing) {
      const { data, error } = await client.auth.admin.updateUserById(existing.id, {
        password: account.password,
        user_metadata: {
          name: account.profile.full_name,
          role: account.profile.role,
          reference: account.profile.reference,
        },
      });
      if (error) throw error;
      user = data.user;
    } else {
      const { data, error } = await client.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: {
          name: account.profile.full_name,
          role: account.profile.role,
          reference: account.profile.reference,
        },
      });
      if (error) throw error;
      user = data.user;
    }
    if (!user) throw new Error("Demo user could not be created.");
    const { error: profileError } = await client.from("profiles").upsert({
      id: user.id,
      email: account.email,
      ...account.profile,
      active: true,
    });
    if (profileError) throw profileError;
    const { data, error } = await publicClient().auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    if (error || !data.user || !data.session) throw error ?? new Error("Demo sign-in failed.");
    const profile = await getOrCreateProfile(data.user);
    return c.json({ user: toUser(data.user, profile), accessToken: data.session.access_token });
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
    user_metadata: { name: cleanName, role: "student", reference: cleanReference },
  });
  if (createError || !created.user) {
    const duplicate = createError?.message.toLowerCase().includes("already");
    return c.json(
      { error: duplicate ? "An account with this email already exists." : "Unable to register." },
      duplicate ? 409 : 400,
    );
  }
  const { error: profileError } = await adminClient().from("profiles").upsert({
    id: created.user.id,
    email: cleanEmail,
    full_name: cleanName,
    role: "student",
    reference: cleanReference,
  });
  if (profileError) return c.json({ error: "Unable to create the account profile." }, 500);
  const { data, error } = await publicClient().auth.signInWithPassword({
    email: cleanEmail,
    password,
  });
  if (error || !data.user || !data.session) {
    return c.json({ error: "Account created. Please sign in." }, 201);
  }
  const profile = await getOrCreateProfile(data.user);
  return c.json({ user: toUser(data.user, profile), accessToken: data.session.access_token }, 201);
});

app.get(`${prefix}/auth/me`, async (c) => {
  const auth = await authenticatedContext(c);
  if (!auth) return c.json({ error: "Session expired." }, 401);
  return c.json({ user: toUser(auth.user, auth.profile) });
});

app.get(`${prefix}/users`, async (c) => {
  const auth = await requireRole(c, ["admin"]);
  if (auth.response) return auth.response;
  const { data, error } = await adminClient()
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ users: data });
});

app.get(`${prefix}/products`, async (c) => {
  const { data, error } = await adminClient()
    .from("products")
    .select("*")
    .eq("active", true)
    .order("id");
  if (error) return c.json({ error: "Unable to load products." }, 500);
  return c.json({ products: data.map(toProduct) });
});

app.post(`${prefix}/products`, async (c) => {
  const auth = await requireRole(c, ["admin"]);
  if (auth.response) return auth.response;
  const input = await c.req.json();
  const { data, error } = await adminClient()
    .from("products")
    .insert({
      name: String(input.name ?? "").trim(),
      category: String(input.category ?? "Notebooks"),
      price: Number(input.price ?? 0),
      stock: Number(input.stock ?? 0),
      image: String(input.image ?? "/assets/stationery.jpg"),
      description: String(input.description ?? ""),
    })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ product: toProduct(data) }, 201);
});

app.put(`${prefix}/products/:id`, async (c) => {
  const auth = await requireRole(c, ["admin"]);
  if (auth.response) return auth.response;
  const id = Number(c.req.param("id"));
  const input = await c.req.json();
  const { data: previous } = await adminClient().from("products").select("*").eq("id", id).single();
  const { data, error } = await adminClient()
    .from("products")
    .update({
      name: input.name,
      category: input.category,
      price: Number(input.price),
      stock: Number(input.stock),
      image: input.image,
      description: input.description,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 400);
  if (previous && Number(previous.stock) !== Number(data.stock)) {
    await adminClient()
      .from("inventory_movements")
      .insert({
        product_id: id,
        movement_type: Number(data.stock) > Number(previous.stock) ? "restock" : "adjustment",
        quantity_change: Number(data.stock) - Number(previous.stock),
        stock_after: Number(data.stock),
        reference_type: "product update",
        actor_id: auth.profile.id,
      });
    await reconcileOnlineOrders();
  }
  return c.json({ product: toProduct(data) });
});

app.delete(`${prefix}/products/:id`, async (c) => {
  const auth = await requireRole(c, ["admin"]);
  if (auth.response) return auth.response;
  const { error } = await adminClient()
    .from("products")
    .update({ active: false })
    .eq("id", Number(c.req.param("id")));
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ deleted: true });
});

app.get(`${prefix}/orders`, async (c) => {
  const auth = await authenticatedContext(c);
  if (!auth) return c.json({ error: "Authentication required." }, 401);
  let query = adminClient()
    .from("orders")
    .select("*, profiles(full_name,email), order_items(*)")
    .order("created_at", { ascending: false });
  if (auth.profile.role === "student") query = query.eq("user_id", auth.user.id);
  const { data, error } = await query;
  if (error) return c.json({ error: "Unable to load orders." }, 500);
  return c.json({ orders: data.map(toOrder) });
});

app.post(`${prefix}/orders`, async (c) => {
  const auth = await authenticatedContext(c);
  if (!auth) return c.json({ error: "Authentication required." }, 401);
  const input = await c.req.json();
  const productIds = (input.items ?? []).map((item: any) => Number(item.productId));
  const { data: products, error: productError } = await adminClient()
    .from("products")
    .select("*")
    .in("id", productIds)
    .eq("active", true);
  if (productError) return c.json({ error: "Unable to validate order items." }, 500);
  const items = (input.items ?? [])
    .map((item: any) => {
      const product = products.find((candidate) => Number(candidate.id) === Number(item.productId));
      if (!product || Number(item.quantity) < 1) return null;
      return {
        product_id: product.id,
        product_name: product.name,
        quantity: Number(item.quantity),
        unit_price: Number(product.price),
      };
    })
    .filter(Boolean);
  if (!items.length) return c.json({ error: "Your order has no valid items." }, 400);
  const orderNumber = `ORD-${Date.now().toString().slice(-7)}`;
  const total = items.reduce((sum: number, item: any) => sum + item.unit_price * item.quantity, 0);
  const { data: order, error: orderError } = await adminClient()
    .from("orders")
    .insert({
      order_number: orderNumber,
      user_id: auth.user.id,
      total,
      pickup_date: input.pickupDate,
      pickup_window: input.pickupWindow,
      notes: String(input.notes ?? ""),
      status_message: "We’re checking current counter stock before confirming your order.",
    })
    .select()
    .single();
  if (orderError) return c.json({ error: "Unable to create the order." }, 500);
  const { error: itemsError } = await adminClient()
    .from("order_items")
    .insert(items.map((item: any) => ({ ...item, order_id: order.id })));
  if (itemsError) {
    await adminClient().from("orders").delete().eq("id", order.id);
    return c.json({ error: "Unable to save the order items." }, 500);
  }
  await recordStatus(
    order.id,
    null,
    "Pending review",
    "Order submitted for stock confirmation.",
    auth.user.id,
  );
  await reconcileOnlineOrders();
  return c.json({ order: toOrder(await fetchOrderByNumber(orderNumber)) }, 201);
});

app.put(`${prefix}/orders/:id/status`, async (c) => {
  const auth = await requireRole(c, ["staff", "admin"]);
  if (auth.response) return auth.response;
  const order = await fetchOrderByNumber(c.req.param("id"));
  const { status, message } = await c.req.json();
  const allowed = ["Confirmed", "Awaiting restock", "Ready for pickup", "Completed", "Cancelled"];
  if (!allowed.includes(status)) return c.json({ error: "Invalid order status." }, 400);

  if (status === "Confirmed" && order.status === "Awaiting restock") {
    await reconcileOnlineOrders();
    const reconciled = await fetchOrderByNumber(order.order_number);
    if (reconciled.status !== "Confirmed") {
      return c.json({ error: "This order still does not have enough stock." }, 409);
    }
    return c.json({ order: toOrder(reconciled) });
  }

  if (status === "Ready for pickup" && order.status !== "Ready for pickup") {
    for (const item of order.order_items) {
      const { data: product } = await adminClient()
        .from("products")
        .select("*")
        .eq("id", item.product_id)
        .single();
      if (!product || Number(product.stock) < Number(item.quantity)) {
        await reconcileOnlineOrders();
        return c.json(
          { error: `${product?.name ?? "An item"} is no longer available for this order.` },
          409,
        );
      }
      const stockAfter = Number(product.stock) - Number(item.quantity);
      await adminClient().from("products").update({ stock: stockAfter }).eq("id", product.id);
      await adminClient()
        .from("inventory_movements")
        .insert({
          product_id: product.id,
          movement_type: "online fulfillment",
          quantity_change: -Number(item.quantity),
          stock_after: stockAfter,
          reference_type: "order",
          reference_id: order.order_number,
          actor_id: auth.profile.id,
        });
    }
  }

  const statusMessage = String(message ?? order.status_message);
  const { error } = await adminClient()
    .from("orders")
    .update({ status, status_message: statusMessage })
    .eq("id", order.id);
  if (error) return c.json({ error: "Unable to update the order." }, 500);
  await recordStatus(order.id, order.status, status, statusMessage, auth.profile.id);
  if (["Cancelled", "Completed", "Ready for pickup"].includes(status)) {
    await reconcileOnlineOrders();
  }
  return c.json({ order: toOrder(await fetchOrderByNumber(order.order_number)) });
});

app.post(`${prefix}/pos/checkout`, async (c) => {
  const auth = await requireRole(c, ["staff", "admin"]);
  if (auth.response) return auth.response;
  const input = await c.req.json();
  const saleItems = (input.items ?? []).filter((item: any) => Number(item.quantity) > 0);
  const productIds = saleItems.map((item: any) => Number(item.productId));
  const { data: products, error: productError } = await adminClient()
    .from("products")
    .select("*")
    .in("id", productIds);
  if (productError) return c.json({ error: "Unable to load inventory." }, 500);
  for (const item of saleItems) {
    const product = products.find((candidate) => Number(candidate.id) === Number(item.productId));
    if (!product || Number(product.stock) < Number(item.quantity)) {
      return c.json({ error: `${product?.name ?? "An item"} does not have enough stock.` }, 409);
    }
  }
  const transactionNumber = `TX-${Date.now().toString().slice(-7)}`;
  const total = saleItems.reduce((sum: number, item: any) => {
    const product = products.find((candidate) => Number(candidate.id) === Number(item.productId));
    return sum + Number(product.price) * Number(item.quantity);
  }, 0);
  const { data: transaction, error: transactionError } = await adminClient()
    .from("transactions")
    .insert({
      transaction_number: transactionNumber,
      source: "walk-in",
      staff_id: auth.profile.id,
      total,
    })
    .select()
    .single();
  if (transactionError) return c.json({ error: "Unable to start the transaction." }, 500);
  for (const item of saleItems) {
    const product = products.find((candidate) => Number(candidate.id) === Number(item.productId));
    const stockAfter = Number(product.stock) - Number(item.quantity);
    await adminClient().from("products").update({ stock: stockAfter }).eq("id", product.id);
    await adminClient()
      .from("transaction_items")
      .insert({
        transaction_id: transaction.id,
        product_id: product.id,
        product_name: product.name,
        quantity: Number(item.quantity),
        unit_price: Number(product.price),
      });
    await adminClient()
      .from("inventory_movements")
      .insert({
        product_id: product.id,
        movement_type: "walk-in sale",
        quantity_change: -Number(item.quantity),
        stock_after: stockAfter,
        reference_type: "transaction",
        reference_id: transactionNumber,
        actor_id: auth.profile.id,
      });
  }
  const impacted = (await reconcileOnlineOrders()).filter(
    (order) => order.status === "Awaiting restock",
  );
  return c.json({
    transaction: { id: transactionNumber, total },
    impactedOrders: impacted.map(toOrder),
  });
});

Deno.serve(app.fetch);
