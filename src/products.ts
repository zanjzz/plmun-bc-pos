import { apiRequest } from "./api";

export type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  image: string;
  description: string;
};

export const fallbackProducts: Product[] = [
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

export async function getProducts() {
  return (await apiRequest<{ products: Product[] }>("/products")).products;
}

export async function createProduct(product: Omit<Product, "id">) {
  return (
    await apiRequest<{ product: Product }>(
      "/products",
      { method: "POST", body: JSON.stringify(product) },
      true,
    )
  ).product;
}

export async function updateProduct(id: number, updates: Partial<Product>) {
  return (
    await apiRequest<{ product: Product }>(
      `/products/${id}`,
      { method: "PUT", body: JSON.stringify(updates) },
      true,
    )
  ).product;
}

export async function deleteProduct(id: number) {
  await apiRequest(`/products/${id}`, { method: "DELETE" }, true);
}
