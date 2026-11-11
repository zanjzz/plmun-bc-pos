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
