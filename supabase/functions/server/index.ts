import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";

const functionName = "server";
const app = new Hono().basePath(`/${functionName}`);
const prefix = "/make-server-2e4384b4";

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

const normalizeVariation = (row: any) => ({
  id: Number(row.id),
  updatedAt: row.updated_at,
  key: row.combination_key,
  values: row.attributes ?? {},
  sku: row.sku ?? "",
  price: Number(row.price),
  stock: Number(row.stock),
  active: row.active !== false,
  image: row.image ?? null,
});

const toProduct = (row: any) => {
  const variations = (row.product_variations ?? []).map(normalizeVariation);
  const activeVariations = variations.filter((variation: any) => variation.active);
  const variable = row.product_type === "variable" || activeVariations.length > 0;
  return {
    id: Number(row.id),
    updatedAt: row.updated_at,
    name: row.name,
    category: row.category,
    price: variable
      ? activeVariations.length
        ? Math.min(...activeVariations.map((variation: any) => variation.price))
        : Number(row.price)
      : Number(row.price),
    stock: variable
      ? activeVariations.reduce((sum: number, variation: any) => sum + Number(variation.stock), 0)
      : Number(row.stock),
    image: row.image,
    description: row.description,
    sizes: Array.isArray(row.sizes) ? row.sizes : [],
    productType: variable ? "variable" : "simple",
    attributes: Array.isArray(row.attributes) ? row.attributes : [],
    variations,
  };
};

const cleanAttributes = (input: unknown) =>
  Array.isArray(input)
    ? input
        .map((attribute: any) => ({
          id: String(attribute.id ?? crypto.randomUUID()),
          name: String(attribute.name ?? "").trim(),
          values: [
            ...new Set(
              (Array.isArray(attribute.values) ? attribute.values : [])
                .map((value: unknown) => String(value).trim())
                .filter(Boolean),
            ),
          ],
        }))
        .filter((attribute: any) => attribute.name && attribute.values.length)
    : [];

const cleanVariations = (input: unknown) =>
  Array.isArray(input)
    ? input
        .map((variation: any) => ({
          key: String(variation.key ?? "").trim(),
          attributes:
            variation.values && typeof variation.values === "object" ? variation.values : {},
          sku: String(variation.sku ?? "").trim(),
          price: Number(variation.price),
          stock: Number(variation.stock),
          active: variation.active !== false,
          image: String(variation.image ?? "").trim() || null,
          updatedAt: variation.updatedAt ? String(variation.updatedAt) : null,
        }))
        .filter(
          (variation: any) =>
            variation.key &&
            Number.isFinite(variation.price) &&
            variation.price >= 0 &&
            Number.isInteger(variation.stock) &&
            variation.stock >= 0,
        )
    : [];

const canonicalVariationKey = (values: Record<string, unknown>) =>
  Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name.trim().toLowerCase()}=${String(value).trim().toLowerCase()}`)
    .join("|");

function validateProductInput(
  input: any,
  productType: "simple" | "variable",
  attributes: any[],
  variations: any[],
) {
  if (!String(input.name ?? "").trim()) return "Enter a product name.";
  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0) return "Price must be zero or greater.";
  if (productType === "simple") return null;
  if (!attributes.length || !variations.length) {
    return "Variable products need attributes and at least one variation.";
  }
  if (
    attributes.length !== (Array.isArray(input.attributes) ? input.attributes.length : 0) ||
    variations.length !== (Array.isArray(input.variations) ? input.variations.length : 0)
  ) {
    return "Complete every attribute and variation field.";
  }
  const attributeNames = attributes.map((attribute) => attribute.name.toLowerCase());
  if (new Set(attributeNames).size !== attributeNames.length) {
    return "Attribute names must be unique.";
  }
  const expectedValues = attributes.reduce<Record<string, string>[]>(
    (combinations, attribute) =>
      combinations.flatMap((combination) =>
        attribute.values.map((value: string) => ({ ...combination, [attribute.name]: value })),
      ),
    [{}],
  );
  const expectedKeys = new Set(expectedValues.map(canonicalVariationKey));
  const submittedKeys = variations.map((variation) => canonicalVariationKey(variation.attributes));
  if (
    submittedKeys.some((key) => !expectedKeys.has(key)) ||
    new Set(submittedKeys).size !== expectedKeys.size ||
    submittedKeys.length !== expectedKeys.size
  ) {
    return "Generate every unique attribute combination before saving.";
  }
  const skus = variations.map((variation) => variation.sku.toLowerCase()).filter(Boolean);
  if (new Set(skus).size !== skus.length) return "Variation SKUs must be unique.";
  if (!variations.some((variation) => variation.active)) {
    return "Keep at least one variation available.";
  }
  return null;
}

async function fetchProduct(id: number) {
  const { data, error } = await adminClient()
    .from("products")
    .select("*, product_variations(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

async function syncProductVariations(productId: number, variations: any[]) {
  const { error } = await adminClient().rpc("sync_product_variations", {
    p_product_id: productId,
    p_variations: variations,
  });
  if (error) throw error;
}

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
    size: item.selected_size ?? null,
    variationId: item.variation_id ? Number(item.variation_id) : null,
    variationLabel: item.variation_label ?? item.selected_size ?? null,
    variationValues: item.variation_attributes ?? {},
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
      selected_size: item.selected_size ?? null,
      variation_id: item.variation_id ?? null,
      variation_label: item.variation_label ?? null,
      variation_attributes: item.variation_attributes ?? {},
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
    .select("id,name,stock,product_type,product_variations(id,stock,active)")
    .eq("active", true);
  if (productsError) throw productsError;
  const { data: orders, error: ordersError } = await client
    .from("orders")
    .select("*, order_items(*)")
    .in("status", ["Pending review", "Confirmed", "Awaiting restock"])
    .order("created_at", { ascending: true });
  if (ordersError) throw ordersError;

  const available = new Map<string, number>();
  for (const product of products) {
    if (product.product_type === "variable") {
      for (const variation of product.product_variations ?? []) {
        if (variation.active) {
          available.set(`${product.id}:${variation.id}`, Number(variation.stock));
        }
      }
    } else {
      available.set(`${product.id}:simple`, Number(product.stock));
    }
  }
  const changed: any[] = [];
  for (const order of orders) {
    const missing = order.order_items.filter((item: any) => {
      const key = `${item.product_id}:${item.variation_id ?? "simple"}`;
      return (available.get(key) ?? 0) < Number(item.quantity);
    });
    const status = missing.length ? "Awaiting restock" : "Confirmed";
    const message = missing.length
      ? `${missing.map((item: any) => item.product_name).join(", ")} became unavailable after a walk-in sale.`
      : "Stock is available and your order is confirmed.";
    if (!missing.length) {
      for (const item of order.order_items) {
        const key = `${item.product_id}:${item.variation_id ?? "simple"}`;
        available.set(key, (available.get(key) ?? 0) - Number(item.quantity));
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

app.get(`${prefix}/health`, (c) =>
  c.json({ status: "ok", storage: "relational", version: "variations-inventory-v3" }),
);

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
    .select("*, product_variations(*)")
    .eq("active", true)
    .order("id");
  if (error) return c.json({ error: "Unable to load products." }, 500);
  return c.json({ products: data.map(toProduct) });
});

app.post(`${prefix}/products`, async (c) => {
  const auth = await requireRole(c, ["admin"]);
  if (auth.response) return auth.response;
  const input = await c.req.json();
  const productType =
    input.productType === "variable" || input.product_type === "variable" ? "variable" : "simple";
  const attributes = cleanAttributes(input.attributes);
  const variations = cleanVariations(input.variations);
  for (const variation of variations) {
    variation.key = canonicalVariationKey(variation.attributes);
  }
  const validationError = validateProductInput(input, productType, attributes, variations);
  if (validationError) return c.json({ error: validationError }, 400);
  const { data, error } = await adminClient()
    .from("products")
    .insert({
      name: String(input.name ?? "").trim(),
      category: String(input.category ?? "School Supplies"),
      price: Number(input.price ?? 0),
      stock: 0,
      image: String(input.image ?? "/assets/stationery.jpg"),
      description: String(input.description ?? ""),
      sizes: Array.isArray(input.sizes) ? input.sizes : [],
      product_type: productType,
      attributes,
    })
    .select()
    .single();
  if (error) return c.json({ error: "The product could not be saved. Check the details." }, 400);
  try {
    if (productType === "variable") await syncProductVariations(Number(data.id), variations);
  } catch (reason) {
    await adminClient().from("products").delete().eq("id", data.id);
    console.log("Variation save failed:", reason);
    return c.json({ error: "The product variations could not be saved." }, 400);
  }
  const saved = await fetchProduct(Number(data.id));
  await notifyInventoryLevel(
    toProduct(saved),
    Number(saved.stock),
    `product:${data.id}:created:${data.created_at}`,
  );
  return c.json({ product: toProduct(saved) }, 201);
});

app.post(`${prefix}/products/image`, async (c) => {
  const auth = await requireRole(c, ["admin"]);
  if (auth.response) return auth.response;
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return c.json({ error: "Choose an image to upload." }, 400);
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return c.json({ error: "Use a JPG, PNG, or WebP image." }, 400);
  }
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: "Images must be 5 MB or smaller." }, 400);
  }
  const client = adminClient();
  const bucket = "product-images";
  const { data: existingBucket } = await client.storage.getBucket(bucket);
  if (!existingBucket) {
    const { error: bucketError } = await client.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: allowed,
    });
    if (bucketError) return c.json({ error: "Image storage could not be prepared." }, 500);
  }
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${auth.profile.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return c.json({ error: "The image could not be uploaded." }, 500);
  return c.json({ url: client.storage.from(bucket).getPublicUrl(path).data.publicUrl });
});

app.put(`${prefix}/products/:id`, async (c) => {
  const auth = await requireRole(c, ["admin"]);
  if (auth.response) return auth.response;
  const id = Number(c.req.param("id"));
  const input = await c.req.json();
  const productType =
    input.productType === "variable" || input.product_type === "variable" ? "variable" : "simple";
  const attributes = cleanAttributes(input.attributes);
  const variations = cleanVariations(input.variations);
  for (const variation of variations) {
    variation.key = canonicalVariationKey(variation.attributes);
  }
  const validationError = validateProductInput(input, productType, attributes, variations);
  if (validationError) return c.json({ error: validationError }, 400);
  const { data: previous } = await adminClient()
    .from("products")
    .select("*, product_variations(*)")
    .eq("id", id)
    .single();
  if (previous?.product_type !== productType) {
    const currentStock =
      previous.product_type === "variable"
        ? (previous.product_variations ?? []).reduce(
            (sum: number, variation: any) => sum + Number(variation.stock),
            0,
          )
        : Number(previous.stock);
    if (currentStock > 0) {
      return c.json(
        {
          error: "Set this product’s inventory to zero before changing whether it has options.",
        },
        409,
      );
    }
  }
  let updateQuery = adminClient()
    .from("products")
    .update({
      name: input.name,
      category: input.category,
      price: Number(input.price),
      image: input.image,
      description: input.description,
      sizes: Array.isArray(input.sizes) ? input.sizes : [],
      product_type: productType,
      attributes,
    })
    .eq("id", id);
  if (input.updatedAt) updateQuery = updateQuery.eq("updated_at", input.updatedAt);
  const { data, error } = await updateQuery.select().single();
  if (error) {
    if (input.updatedAt && error.code === "PGRST116") {
      return c.json(
        { error: "This product changed while you were editing it. Reopen it and try again." },
        409,
      );
    }
    return c.json({ error: "The product could not be updated. Please try again." }, 400);
  }
  try {
    await syncProductVariations(id, productType === "variable" ? variations : []);
  } catch (reason) {
    if (previous) {
      await adminClient()
        .from("products")
        .update({
          name: previous.name,
          category: previous.category,
          price: previous.price,
          image: previous.image,
          description: previous.description,
          sizes: previous.sizes,
          product_type: previous.product_type,
          attributes: previous.attributes,
          active: previous.active,
        })
        .eq("id", id);
    }
    console.log("Variation update failed:", reason);
    const conflict = String((reason as any)?.message ?? reason).includes(
      "changed while it was being edited",
    );
    return c.json(
      {
        error: conflict
          ? "Variation stock changed while you were editing. Reopen the product and try again."
          : "The product variations could not be updated.",
      },
      conflict ? 409 : 400,
    );
  }
  const saved = await fetchProduct(id);
  return c.json({ product: toProduct(saved) });
});

app.post(`${prefix}/inventory/adjust`, async (c) => {
  const auth = await requireRole(c, ["admin"]);
  if (auth.response) return auth.response;
  const input = await c.req.json();
  const productId = Number(input.productId);
  const variationId = input.variationId == null ? null : Number(input.variationId);
  const quantityChange = Number(input.quantityChange);
  if (
    !Number.isInteger(productId) ||
    !Number.isInteger(quantityChange) ||
    quantityChange === 0 ||
    (variationId !== null && !Number.isInteger(variationId))
  ) {
    return c.json({ error: "Enter a valid non-zero stock adjustment." }, 400);
  }
  let before;
  try {
    before = await fetchProduct(productId);
  } catch {
    return c.json({ error: "Product not found." }, 400);
  }
  const previousStock = toProduct(before).stock;
  const { data: stockAfter, error } = await adminClient().rpc("adjust_inventory", {
    p_product_id: productId,
    p_variation_id: variationId,
    p_quantity_change: quantityChange,
    p_actor_id: auth.profile.id,
    p_reason: quantityChange > 0 ? "Stock received" : "Manual adjustment",
  });
  if (error) {
    const conflict =
      error.message.includes("below zero") ||
      error.message.includes("not found") ||
      error.message.includes("reserved quantity");
    return c.json(
      { error: conflict ? error.message : "Inventory could not be adjusted." },
      conflict ? 409 : 400,
    );
  }
  const saved = await fetchProduct(productId);
  await notifyInventoryLevel(
    toProduct(saved),
    previousStock,
    `product:${productId}:inventory:${Date.now()}`,
  );
  await reconcileOnlineOrders();
  return c.json({ product: toProduct(saved), stockAfter: Number(stockAfter) });
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
      .order("created_at", { ascending: false }),
    client
      .from("inventory_movements")
      .select("*, products(name), product_variations(attributes)")
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
      items: (transaction.transaction_items ?? []).map((item: any) => ({
        productName: item.product_name,
        variationLabel: item.variation_label ?? null,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
      })),
      orderId: transaction.order_id,
      createdAt: transaction.created_at,
    })),
    inventoryMovements: movements.map((movement: any) => ({
      id: movement.id,
      productName: movement.products?.name ?? "Product",
      variationLabel: movement.product_variations
        ? Object.values(movement.product_variations.attributes ?? {})
            .filter(Boolean)
            .join(" / ")
        : null,
      type: movement.movement_type,
      reason: movement.reference_type,
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
  const requestedItems = Array.isArray(input.items) ? input.items : [];
  const requestedKeys = requestedItems.map(
    (item: any) =>
      `${Number(item.productId)}:${item.variationId == null ? "simple" : Number(item.variationId)}`,
  );
  if (
    !requestedItems.length ||
    requestedItems.some(
      (item: any) =>
        !Number.isInteger(Number(item.productId)) ||
        !Number.isInteger(Number(item.quantity)) ||
        Number(item.quantity) < 1,
    ) ||
    new Set(requestedKeys).size !== requestedKeys.length
  ) {
    return c.json({ error: "Review the products and quantities in your cart." }, 400);
  }
  const productIds = requestedItems.map((item: any) => Number(item.productId));
  const { data: products, error: productError } = await adminClient()
    .from("products")
    .select("*, product_variations(*)")
    .in("id", productIds)
    .eq("active", true);
  if (productError) return c.json({ error: "Unable to validate order items." }, 500);
  const items = requestedItems
    .map((item: any) => {
      const product = products.find((candidate) => Number(candidate.id) === Number(item.productId));
      if (!product || Number(item.quantity) < 1) return null;
      const variable = product.product_type === "variable";
      if (!variable && item.variationId != null) return null;
      const variation = variable
        ? (product.product_variations ?? []).find(
            (candidate: any) =>
              Number(candidate.id) === Number(item.variationId) &&
              candidate.active &&
              Number(candidate.stock) > 0,
          )
        : null;
      if (variable && !variation) return null;
      return {
        product_id: product.id,
        product_name: product.name,
        quantity: Number(item.quantity),
        unit_price: Number(variation?.price ?? product.price),
        variation_id: variation?.id ?? null,
        variation_label: variation
          ? Object.values(variation.attributes ?? {})
              .filter(Boolean)
              .join(" / ")
          : null,
        variation_attributes: variation?.attributes ?? {},
      };
    })
    .filter(Boolean);
  if (!items.length || items.length !== requestedItems.length) {
    return c.json(
      {
        error: "One or more items has an invalid quantity or size. Review your cart and try again.",
      },
      400,
    );
  }
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
    Cancelled: ["Pending review", "Confirmed", "Awaiting restock", "Ready for pickup"],
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

  const inventoryItems = order.order_items.map((item: any) => ({
    productId: Number(item.product_id),
    variationId: item.variation_id ? Number(item.variation_id) : null,
    quantity: Number(item.quantity),
  }));
  const statusMessage = String(message ?? order.status_message);
  let inventoryStatusHandled = false;
  if (status === "Ready for pickup") {
    const { data: deducted, error: deductionError } = await adminClient().rpc(
      "deduct_ready_order_inventory",
      {
        p_order_id: order.id,
        p_items: inventoryItems,
        p_message: statusMessage,
        p_actor_id: auth.profile.id,
        p_reference: order.order_number,
      },
    );
    if (deductionError) {
      await reconcileOnlineOrders();
      return c.json({ error: "One or more order variations are no longer available." }, 409);
    }
    if (deducted === null) {
      return c.json({ order: toOrder(await fetchOrderByNumber(order.order_number)) });
    }
    inventoryStatusHandled = true;
  }
  if (status === "Cancelled" && order.status === "Ready for pickup") {
    const { error: returnError } = await adminClient().rpc("cancel_ready_order_inventory", {
      p_order_id: order.id,
      p_items: inventoryItems,
      p_message: statusMessage,
      p_actor_id: auth.profile.id,
      p_reference: order.order_number,
    });
    if (returnError) {
      return c.json({ error: "Deducted inventory could not be returned." }, 409);
    }
    inventoryStatusHandled = true;
  }

  const { error } = inventoryStatusHandled
    ? { error: null }
    : await adminClient()
        .from("orders")
        .update({ status, status_message: statusMessage })
        .eq("id", order.id);
  if (error) {
    return c.json({ error: "Unable to update the order." }, 500);
  }
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
  const saleItems = Array.isArray(input.items) ? input.items : [];
  const saleKeys = saleItems.map(
    (item: any) =>
      `${Number(item.productId)}:${item.variationId == null ? "simple" : Number(item.variationId)}`,
  );
  if (
    !saleItems.length ||
    saleItems.some(
      (item: any) =>
        !Number.isInteger(Number(item.productId)) ||
        !Number.isInteger(Number(item.quantity)) ||
        Number(item.quantity) < 1,
    ) ||
    new Set(saleKeys).size !== saleKeys.length
  ) {
    return c.json({ error: "One or more sale quantities is invalid." }, 400);
  }
  const productIds = saleItems.map((item: any) => Number(item.productId));
  const { data: products, error: productError } = await adminClient()
    .from("products")
    .select("*, product_variations(*)")
    .in("id", productIds)
    .eq("active", true);
  if (productError) return c.json({ error: "Unable to load inventory." }, 500);
  const validatedItems = saleItems.map((item: any) => {
    const product = products.find((candidate) => Number(candidate.id) === Number(item.productId));
    const variation =
      product?.product_type === "variable"
        ? (product.product_variations ?? []).find(
            (candidate: any) =>
              Number(candidate.id) === Number(item.variationId) && candidate.active,
          )
        : null;
    if (
      !product ||
      (product.product_type === "variable" && !variation) ||
      (product.product_type !== "variable" && item.variationId != null)
    )
      return null;
    return {
      product,
      variation,
      productId: Number(product.id),
      variationId: variation ? Number(variation.id) : null,
      quantity: Number(item.quantity),
      price: Number(variation?.price ?? product.price),
    };
  });
  if (!validatedItems.length || validatedItems.some((item) => !item)) {
    return c.json({ error: "One or more selected product variations is invalid." }, 400);
  }
  const transactionNumber = `TX-${Date.now().toString().slice(-7)}`;
  const total = validatedItems.reduce(
    (sum: number, item: any) => sum + item.price * item.quantity,
    0,
  );
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
  const { data: reserved, error: reserveError } = await adminClient().rpc("reserve_inventory", {
    p_items: validatedItems.map((item: any) => ({
      productId: item.productId,
      variationId: item.variationId,
      quantity: item.quantity,
    })),
  });
  if (reserveError) {
    await adminClient().from("transactions").delete().eq("id", transaction.id);
    return c.json({ error: "One or more selected variations no longer has enough stock." }, 409);
  }
  const transactionItems = [];
  const movements = [];
  for (const item of validatedItems as any[]) {
    const attributes = item.variation?.attributes ?? {};
    const label = item.variation ? Object.values(attributes).filter(Boolean).join(" / ") : null;
    const result = (reserved ?? []).find(
      (entry: any) =>
        Number(entry.productId) === item.productId &&
        Number(entry.variationId ?? 0) === Number(item.variationId ?? 0),
    );
    transactionItems.push({
      transaction_id: transaction.id,
      product_id: item.productId,
      product_name: item.product.name,
      quantity: item.quantity,
      unit_price: item.price,
      variation_id: item.variationId,
      variation_label: label,
      variation_attributes: attributes,
    });
    movements.push({
      product_id: item.productId,
      variation_id: item.variationId,
      movement_type: "walk-in sale",
      quantity_change: -item.quantity,
      stock_after: Number(result?.stockAfter ?? 0),
      reference_type: "transaction",
      reference_id: transactionNumber,
      actor_id: auth.profile.id,
    });
  }
  const { error: transactionItemsError } = await adminClient()
    .from("transaction_items")
    .insert(transactionItems);
  const { error: movementsError } = transactionItemsError
    ? { error: transactionItemsError }
    : await adminClient().from("inventory_movements").insert(movements);
  if (transactionItemsError || movementsError) {
    await adminClient().rpc("restore_inventory", {
      p_items: validatedItems.map((item: any) => ({
        productId: item.productId,
        variationId: item.variationId,
        quantity: item.quantity,
      })),
    });
    await adminClient().from("transactions").delete().eq("id", transaction.id);
    return c.json({ error: "The transaction could not be recorded. Inventory was restored." }, 500);
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
      actionPage: "Sales & transactions",
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
