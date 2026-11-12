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

const toNotification = (row: any, canDismiss = false) => ({
  id: row.id,
  type: row.type,
  title: row.title,
  message: row.message,
  actionPage: row.action_page,
  entityType: row.entity_type,
  entityId: row.entity_id,
  metadata: row.metadata ?? {},
  readAt: row.read_at,
  createdAt: row.created_at,
  canDismiss,
});

async function dismissibleNotificationIds(rows: any[]) {
  const dismissible = new Set<string>(
    rows
      .filter(
        (row) =>
          row.type === "transaction" || row.type === "system" || row.metadata?.dismissible === true,
      )
      .map((row) => row.id),
  );
  const orderNumbers = [
    ...new Set(
      rows
        .filter((row) => row.entity_type === "order" && row.entity_id)
        .map((row) => row.entity_id),
    ),
  ];
  const productIds = [
    ...new Set(
      rows
        .filter((row) => row.entity_type === "product" && row.entity_id)
        .map((row) => Number(row.entity_id))
        .filter(Number.isFinite),
    ),
  ];
  const client = adminClient();
  const [{ data: orders }, { data: products }] = await Promise.all([
    orderNumbers.length
      ? client.from("orders").select("order_number,status").in("order_number", orderNumbers)
      : Promise.resolve({ data: [] }),
    productIds.length
      ? client.from("products").select("id,stock,active").in("id", productIds)
      : Promise.resolve({ data: [] }),
  ]);
  const resolvedOrders = new Set(
    (orders ?? [])
      .filter((order: any) => ["Completed", "Cancelled"].includes(order.status))
      .map((order: any) => order.order_number),
  );
  const resolvedProducts = new Set(
    (products ?? [])
      .filter((product: any) => product.active === false || Number(product.stock) >= 20)
      .map((product: any) => String(product.id)),
  );
  for (const row of rows) {
    if (
      (row.entity_type === "order" && resolvedOrders.has(row.entity_id)) ||
      (row.entity_type === "product" && resolvedProducts.has(row.entity_id))
    ) {
      dismissible.add(row.id);
    }
  }
  return dismissible;
}

type NotificationInput = {
  eventKey: string;
  type: "order" | "inventory" | "transaction" | "system";
  title: string;
  message: string;
  actionPage?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

async function notifyRecipients(
  recipients: Array<{ id: string; role: string }>,
  input: NotificationInput,
) {
  if (!recipients.length) return;
  const rows = recipients.map((recipient) => ({
    recipient_id: recipient.id,
    recipient_role: recipient.role,
    event_key: input.eventKey,
    type: input.type,
    title: input.title,
    message: input.message,
    action_page: input.actionPage ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  }));
  const { error } = await adminClient()
    .from("notifications")
    .upsert(rows, { onConflict: "recipient_id,event_key", ignoreDuplicates: true });
  if (error) console.log("Notification insert failed:", error.message);
}

async function notifyUser(userId: string, role: string, input: NotificationInput) {
  await notifyRecipients([{ id: userId, role }], input);
}

async function notifyRoles(roles: string[], input: NotificationInput) {
  const { data, error } = await adminClient()
    .from("profiles")
    .select("id,role")
    .in("role", roles)
    .eq("active", true);
  if (error) {
    console.log("Notification recipient lookup failed:", error.message);
    return;
  }
  await notifyRecipients(data ?? [], input);
}

const studentStatusCopy: Record<string, { title: string; message: (order: any) => string }> = {
  "Pending review": {
    title: "Order submitted",
    message: (order) => `${order.order_number} was received and is awaiting stock confirmation.`,
  },
  Confirmed: {
    title: "Order confirmed",
    message: (order) => `${order.order_number} is confirmed and will be prepared for pickup.`,
  },
  "Awaiting restock": {
    title: "Order needs attention",
    message: (order) =>
      `${order.order_number} has a stock issue. ${order.status_message || "We’ll update you when stock is available."}`,
  },
  "Ready for pickup": {
    title: "Order ready for pickup",
    message: (order) => `${order.order_number} is ready at the Business Center counter.`,
  },
  Completed: {
    title: "Order completed",
    message: (order) => `${order.order_number} has been completed. Thank you for your order.`,
  },
  Cancelled: {
    title: "Order cancelled",
    message: (order) =>
      `${order.order_number} was cancelled. ${order.status_message || "Contact the Business Center if you need help."}`,
  },
};

async function notifyOrderStatus(order: any, eventId: string) {
  const copy = studentStatusCopy[order.status];
  if (copy) {
    await notifyUser(order.user_id, "student", {
      eventKey: `order:${order.id}:status:${eventId}:student`,
      type: "order",
      title: copy.title,
      message: copy.message(order),
      actionPage: "My orders",
      entityType: "order",
      entityId: order.order_number,
      metadata: { status: order.status, urgent: order.status === "Awaiting restock" },
    });
  }

  if (order.status === "Awaiting restock" || order.status === "Cancelled") {
    await notifyRoles(["staff"], {
      eventKey: `order:${order.id}:status:${eventId}:staff`,
      type: "order",
      title:
        order.status === "Awaiting restock" ? "Stock conflict needs review" : "Order cancelled",
      message: `${order.order_number}: ${order.status_message}`,
      actionPage: "Order management",
      entityType: "order",
      entityId: order.order_number,
      metadata: { status: order.status, urgent: order.status === "Awaiting restock" },
    });
    await notifyRoles(["admin"], {
      eventKey: `order:${order.id}:status:${eventId}:admin`,
      type: "order",
      title:
        order.status === "Awaiting restock"
          ? "Order conflict requires oversight"
          : "Order cancellation recorded",
      message: `${order.order_number}: ${order.status_message}`,
      actionPage: "Dashboard",
      entityType: "order",
      entityId: order.order_number,
      metadata: { status: order.status, urgent: order.status === "Awaiting restock" },
    });
  }
}

async function notifyInventoryLevel(
  product: { id: number; name: string; stock: number },
  previousStock: number,
  eventKey: string,
) {
  const restored = previousStock < 20 && product.stock >= 20;
  if (product.stock >= 20 && !restored) return;
  const title = restored
    ? "Inventory restored"
    : product.stock <= 0
      ? "Product out of stock"
      : "Low stock warning";
  const message = restored
    ? `${product.name} is back to ${product.stock} units.`
    : `${product.name} has ${product.stock} ${product.stock === 1 ? "unit" : "units"} remaining.`;
  await notifyRoles(["staff"], {
    eventKey: `${eventKey}:staff`,
    type: "inventory",
    title,
    message,
    actionPage: "Dashboard",
    entityType: "product",
    entityId: String(product.id),
    metadata: { stock: product.stock, urgent: product.stock <= 0 },
  });
  await notifyRoles(["admin"], {
    eventKey: `${eventKey}:admin`,
    type: "inventory",
    title,
    message,
    actionPage: "Inventory management",
    entityType: "product",
    entityId: String(product.id),
    metadata: { stock: product.stock, urgent: product.stock <= 0 },
  });
}

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
  const { data, error } = await adminClient()
    .from("order_status_history")
    .insert({
      order_id: orderId,
      from_status: fromStatus,
      to_status: toStatus,
      message,
      changed_by: actorId ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

async function ensureOnlineTransaction(order: any, actor: any) {
  const client = adminClient();
  const { data: existing, error: existingError } = await client
    .from("transactions")
    .select("*")
    .eq("order_id", order.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;

  const { data: transaction, error } = await client
    .from("transactions")
    .insert({
      transaction_number: `ONL-${order.order_number}`,
      source: "online",
      staff_id: ["staff", "admin"].includes(actor.profile.role) ? actor.profile.id : null,
      order_id: order.id,
      total: Number(order.total),
    })
    .select()
    .single();
  if (error) throw error;
  const { error: itemError } = await client.from("transaction_items").insert(
    order.order_items.map((item: any) => ({
      transaction_id: transaction.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
    })),
  );
  if (itemError) {
    await client.from("transactions").delete().eq("id", transaction.id);
    throw itemError;
  }
  return transaction;
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
      const history = await recordStatus(order.id, order.status, status, message);
      const changedOrder = { ...order, status, status_message: message };
      await notifyOrderStatus(changedOrder, history.id);
      changed.push(changedOrder);
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

app.get(`${prefix}/notifications`, async (c) => {
  const auth = await authenticatedContext(c);
  if (!auth) return c.json({ error: "Authentication required." }, 401);
  const client = adminClient();
  const retentionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error: cleanupError } = await client
    .from("notifications")
    .delete()
    .eq("recipient_id", auth.user.id)
    .lt("created_at", retentionCutoff);
  if (cleanupError) console.log("Notification retention cleanup failed:", cleanupError.message);
  const { data, error } = await client
    .from("notifications")
    .select("*")
    .eq("recipient_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return c.json({ error: "Unable to load notifications." }, 500);
  const dismissibleIds = await dismissibleNotificationIds(data);
  return c.json({
    notifications: data.map((notification) =>
      toNotification(notification, dismissibleIds.has(notification.id)),
    ),
    unreadCount: data.filter((notification) => !notification.read_at).length,
  });
});

app.put(`${prefix}/notifications/read-all`, async (c) => {
  const auth = await authenticatedContext(c);
  if (!auth) return c.json({ error: "Authentication required." }, 401);
  const { data, error } = await adminClient()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", auth.user.id)
    .is("read_at", null)
    .select("id");
  if (error) return c.json({ error: "Unable to update notifications." }, 500);
  return c.json({ updated: data.length });
});

app.put(`${prefix}/notifications/:id/read`, async (c) => {
  const auth = await authenticatedContext(c);
  if (!auth) return c.json({ error: "Authentication required." }, 401);
  const { data, error } = await adminClient()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", c.req.param("id"))
    .eq("recipient_id", auth.user.id)
    .select()
    .single();
  if (error) return c.json({ error: "Notification not found." }, 404);
  return c.json({ notification: toNotification(data) });
});

app.delete(`${prefix}/notifications/:id`, async (c) => {
  const auth = await authenticatedContext(c);
  if (!auth) return c.json({ error: "Authentication required." }, 401);
  const client = adminClient();
  const { data: notification, error: findError } = await client
    .from("notifications")
    .select("*")
    .eq("id", c.req.param("id"))
    .eq("recipient_id", auth.user.id)
    .maybeSingle();
  if (findError || !notification) return c.json({ error: "Notification not found." }, 404);
  const dismissibleIds = await dismissibleNotificationIds([notification]);
  if (!dismissibleIds.has(notification.id)) {
    return c.json({ error: "This notification is still active and cannot be removed yet." }, 409);
  }
  const { error } = await client
    .from("notifications")
    .delete()
    .eq("id", notification.id)
    .eq("recipient_id", auth.user.id);
  if (error) return c.json({ error: "Notification could not be removed." }, 500);
  return c.json({ deleted: true });
});

app.get(`${prefix}/users`, async (c) => {
  const auth = await requireRole(c, ["admin"]);
  if (auth.response) return auth.response;
  const { data, error } = await adminClient()
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return c.json({ error: "Accounts could not be loaded. Please try again." }, 500);
  return c.json({ users: data });
});

app.post(`${prefix}/users`, async (c) => {
  const auth = await requireRole(c, ["admin"]);
  if (auth.response) return auth.response;
  const input = await c.req.json();
  const email = String(input.email ?? "")
    .trim()
    .toLowerCase();
  const fullName = String(input.fullName ?? "").trim();
  const password = String(input.password ?? "");
  const role = ["student", "staff", "admin"].includes(input.role) ? input.role : "student";
  if (!email.includes("@") || !fullName || password.length < 8) {
    return c.json(
      { error: "Enter a name, valid email, and a password with at least 8 characters." },
      400,
    );
  }
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: fullName, role, reference: String(input.reference ?? "") },
  });
  if (error || !data.user)
    return c.json(
      {
        error: error?.message.toLowerCase().includes("already")
          ? "An account with this email already exists."
          : "The account could not be created. Check the details and try again.",
      },
      400,
    );
  const { data: profile, error: profileError } = await adminClient()
    .from("profiles")
    .upsert({
      id: data.user.id,
      email,
      full_name: fullName,
      role,
      reference: String(input.reference ?? ""),
      active: true,
    })
    .select()
    .single();
  if (profileError)
    return c.json({ error: "The account profile could not be saved. Please try again." }, 500);
  return c.json({ user: profile }, 201);
});

app.put(`${prefix}/users/:id`, async (c) => {
  const auth = await requireRole(c, ["admin"]);
  if (auth.response) return auth.response;
  const id = c.req.param("id");
  const input = await c.req.json();
  const isSelf = id === auth.profile.id;
  const { data: current, error: currentError } = await adminClient()
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (currentError) return c.json({ error: "User not found." }, 404);
  const role = isSelf
    ? "admin"
    : ["student", "staff", "admin"].includes(input.role)
      ? input.role
      : current.role;
  const active = isSelf ? true : input.active !== false;
  const email = String(input.email ?? current.email)
    .trim()
    .toLowerCase();
  const fullName = String(input.fullName ?? current.full_name).trim();
  const reference = String(input.reference ?? current.reference);
  const authUpdates: any = {
    email,
    email_confirm: true,
    user_metadata: { name: fullName, role, reference },
    ban_duration: active ? "none" : "876000h",
  };
  if (input.password) {
    if (String(input.password).length < 8) {
      return c.json({ error: "A new password must contain at least 8 characters." }, 400);
    }
    authUpdates.password = String(input.password);
  }
  const { error: authError } = await adminClient().auth.admin.updateUserById(id, authUpdates);
  if (authError)
    return c.json({ error: "The sign-in details could not be updated. Please try again." }, 400);
  const { data, error } = await adminClient()
    .from("profiles")
    .update({ email, full_name: fullName, role, reference, active })
    .eq("id", id)
    .select()
    .single();
  if (error) return c.json({ error: "The account could not be updated. Please try again." }, 400);
  return c.json({ user: data });
});

app.delete(`${prefix}/users/:id`, async (c) => {
  const auth = await requireRole(c, ["admin"]);
  if (auth.response) return auth.response;
  const id = c.req.param("id");
  if (id === auth.profile.id) {
    return c.json({ error: "You cannot remove your own administrator access." }, 400);
  }
  const { error: authError } = await adminClient().auth.admin.updateUserById(id, {
    ban_duration: "876000h",
  });
  if (authError)
    return c.json({ error: "Account access could not be removed. Please try again." }, 400);
  const { data, error } = await adminClient()
    .from("profiles")
    .update({ active: false })
    .eq("id", id)
    .select()
    .single();
  if (error)
    return c.json({ error: "Account access could not be updated. Please try again." }, 400);
  return c.json({ user: data, removed: true });
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
      category: String(input.category ?? "School Supplies"),
      price: Number(input.price ?? 0),
      stock: Number(input.stock ?? 0),
      image: String(input.image ?? "/assets/stationery.jpg"),
      description: String(input.description ?? ""),
    })
    .select()
    .single();
  if (error) return c.json({ error: "The product could not be saved. Check the details." }, 400);
  await notifyInventoryLevel(
    toProduct(data),
    Number(data.stock),
    `product:${data.id}:created:${data.created_at}`,
  );
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
  if (error) return c.json({ error: "The product could not be updated. Please try again." }, 400);
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
    await notifyInventoryLevel(
      toProduct(data),
      Number(previous.stock),
      `product:${id}:stock:${data.updated_at}`,
    );
    await reconcileOnlineOrders();
  }
  return c.json({ product: toProduct(data) });
});

app.delete(`${prefix}/products/:id`, async (c) => {
  const auth = await requireRole(c, ["admin"]);
  if (auth.response) return auth.response;
  const id = Number(c.req.param("id"));
  const { data: product } = await adminClient().from("products").select("*").eq("id", id).single();
  if (!product?.active) return c.json({ deleted: true });
  const { error } = await adminClient().from("products").update({ active: false }).eq("id", id);
  if (error) return c.json({ error: "The product could not be removed. Please try again." }, 400);
  await notifyRoles(["staff"], {
    eventKey: `product:${id}:deactivated:staff`,
    type: "inventory",
    title: "Product unavailable",
    message: `${product.name} was removed from active inventory.`,
    actionPage: "Dashboard",
    entityType: "product",
    entityId: String(id),
    metadata: { urgent: true, stock: Number(product.stock) },
  });
  await notifyRoles(["admin"], {
    eventKey: `product:${id}:deactivated:admin`,
    type: "inventory",
    title: "Product removed",
    message: `${product.name} was removed from active inventory.`,
    actionPage: "Inventory management",
    entityType: "product",
    entityId: String(id),
    metadata: { urgent: true, stock: Number(product.stock) },
  });
  await reconcileOnlineOrders();
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

app.get(`${prefix}/admin/reports`, async (c) => {
  const auth = await requireRole(c, ["admin"]);
  if (auth.response) return auth.response;
  const client = adminClient();
  const [
    { data: transactions, error: transactionError },
    { data: movements, error: movementError },
  ] = await Promise.all([
    client
      .from("transactions")
      .select("*, transaction_items(*)")
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("inventory_movements")
      .select("*, products(name)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (transactionError || movementError) {
    return c.json({ error: "Reports could not be loaded. Please try again." }, 500);
  }
  const totalSales = transactions.reduce(
    (sum: number, transaction: any) => sum + Number(transaction.total),
    0,
  );
  return c.json({
    summary: {
      totalSales,
      transactionCount: transactions.length,
      walkInSales: transactions
        .filter((transaction: any) => transaction.source === "walk-in")
        .reduce((sum: number, transaction: any) => sum + Number(transaction.total), 0),
      onlineSales: transactions
        .filter((transaction: any) => transaction.source === "online")
        .reduce((sum: number, transaction: any) => sum + Number(transaction.total), 0),
    },
    transactions: transactions.map((transaction: any) => ({
      id: transaction.transaction_number,
      source: transaction.source,
      total: Number(transaction.total),
      itemCount: (transaction.transaction_items ?? []).reduce(
        (sum: number, item: any) => sum + Number(item.quantity),
        0,
      ),
      orderId: transaction.order_id,
      createdAt: transaction.created_at,
    })),
    inventoryMovements: movements.map((movement: any) => ({
      id: movement.id,
      productName: movement.products?.name ?? "Product",
      type: movement.movement_type,
      quantityChange: Number(movement.quantity_change),
      stockAfter: Number(movement.stock_after),
      reference: movement.reference_id,
      createdAt: movement.created_at,
    })),
  });
});

app.post(`${prefix}/orders`, async (c) => {
  const auth = await authenticatedContext(c);
  if (!auth) return c.json({ error: "Authentication required." }, 401);
  if (auth.profile.role !== "student") {
    return c.json({ error: "Only student accounts can place online orders." }, 403);
  }
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
  const pendingHistory = await recordStatus(
    order.id,
    null,
    "Pending review",
    "Order submitted for stock confirmation.",
    auth.user.id,
  );
  await notifyOrderStatus(
    {
      ...order,
      status: "Pending review",
      status_message: "Order submitted for stock confirmation.",
    },
    pendingHistory.id,
  );
  await notifyRoles(["staff"], {
    eventKey: `order:${order.id}:created:staff`,
    type: "order",
    title: "New online order received",
    message: `${orderNumber} is ready for review.`,
    actionPage: "Order management",
    entityType: "order",
    entityId: orderNumber,
  });
  await notifyRoles(["admin"], {
    eventKey: `order:${order.id}:created:admin`,
    type: "order",
    title: "New online order",
    message: `${orderNumber} was submitted with a total of ₱${total.toFixed(2)}.`,
    actionPage: "Dashboard",
    entityType: "order",
    entityId: orderNumber,
  });
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
  if (status === "Completed" && order.status === "Completed") {
    await ensureOnlineTransaction(order, auth);
    return c.json({ order: toOrder(order) });
  }
  const validTransitions: Record<string, string[]> = {
    Confirmed: ["Pending review", "Awaiting restock"],
    "Awaiting restock": ["Pending review", "Confirmed"],
    "Ready for pickup": ["Confirmed"],
    Completed: ["Ready for pickup"],
    Cancelled: ["Pending review", "Confirmed", "Awaiting restock"],
  };
  if (!validTransitions[status]?.includes(order.status)) {
    return c.json(
      { error: `${order.order_number} cannot move from ${order.status} to ${status}.` },
      409,
    );
  }

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
      await notifyInventoryLevel(
        { id: Number(product.id), name: product.name, stock: stockAfter },
        Number(product.stock),
        `order:${order.id}:product:${product.id}:fulfilled`,
      );
    }
  }

  const statusMessage = String(message ?? order.status_message);
  const { error } = await adminClient()
    .from("orders")
    .update({ status, status_message: statusMessage })
    .eq("id", order.id);
  if (error) return c.json({ error: "Unable to update the order." }, 500);
  const history = await recordStatus(
    order.id,
    order.status,
    status,
    statusMessage,
    auth.profile.id,
  );
  if (status === "Completed") {
    await ensureOnlineTransaction(order, auth);
  }
  await notifyOrderStatus({ ...order, status, status_message: statusMessage }, history.id);
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
    await notifyInventoryLevel(
      { id: Number(product.id), name: product.name, stock: stockAfter },
      Number(product.stock),
      `transaction:${transaction.id}:product:${product.id}:stock`,
    );
  }
  const impacted = (await reconcileOnlineOrders()).filter(
    (order) => order.status === "Awaiting restock",
  );
  await notifyUser(auth.profile.id, auth.profile.role, {
    eventKey: `transaction:${transaction.id}:completed:actor`,
    type: "transaction",
    title: "Transaction completed",
    message: `${transactionNumber} was completed for ₱${total.toFixed(2)}.`,
    actionPage: "POS terminal",
    entityType: "transaction",
    entityId: transactionNumber,
  });
  if (auth.profile.role !== "admin") {
    await notifyRoles(["admin"], {
      eventKey: `transaction:${transaction.id}:completed:admin`,
      type: "transaction",
      title: "Walk-in transaction completed",
      message: `${transactionNumber} was completed for ₱${total.toFixed(2)}.`,
      actionPage: "Reports & transactions",
      entityType: "transaction",
      entityId: transactionNumber,
    });
  }
  return c.json({
    transaction: { id: transactionNumber, total },
    impactedOrders: impacted.map(toOrder),
  });
});

Deno.serve(app.fetch);
