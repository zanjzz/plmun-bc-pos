import { apiRequest } from "./api";
import { requestNotificationRefresh } from "./notifications";

export type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  image: string;
  description: string;
};

export const SERVICE_CATEGORY = "Services";
export const isServiceProduct = (product: Product) =>
  product.category.trim().toLowerCase() === SERVICE_CATEGORY.toLowerCase();
export const isPhysicalProduct = (product: Product) => !isServiceProduct(product);

export const fallbackProducts: Product[] = [
  {
    id: 1,
    name: "School Uniform Set",
    category: "Uniforms",
    price: 850,
    stock: 35,
    image: "/assets/stationery.jpg",
    description:
      "Official PLMun blouse or polo and matching pants or skirt for regular school days.",
  },
  {
    id: 2,
    name: "PE Uniform Set",
    category: "PE & Athletics",
    price: 650,
    stock: 28,
    image: "/assets/stationery.jpg",
    description: "Official PE shirt and jogging pants designed for classes and campus activities.",
  },
  {
    id: 3,
    name: "University ID Lace",
    category: "Identification",
    price: 80,
    stock: 90,
    image: "/assets/notebook-pen.jpg",
    description: "Official PLMun woven ID lace with a durable metal clip.",
  },
  {
    id: 4,
    name: "ID Card Holder",
    category: "Identification",
    price: 35,
    stock: 75,
    image: "/assets/stationery.jpg",
    description: "Clear protective holder sized for the university identification card.",
  },
  {
    id: 5,
    name: "Scantron Answer Sheet",
    category: "Assessment Supplies",
    price: 15,
    stock: 200,
    image: "/assets/stationery.jpg",
    description: "Standard machine-readable answer sheet for university examinations.",
  },
  {
    id: 6,
    name: "Examination Booklet",
    category: "Assessment Supplies",
    price: 12,
    stock: 180,
    image: "/assets/spiral-notebook.jpg",
    description: "Ruled examination booklet for written tests and essay responses.",
  },
  {
    id: 7,
    name: "Spiral Notebook",
    category: "School Supplies",
    price: 45,
    stock: 60,
    image: "/assets/spiral-notebook.jpg",
    description: "A5 ruled notebook with 80 smooth, easy-tear pages.",
  },
  {
    id: 8,
    name: "Black Ballpen",
    category: "School Supplies",
    price: 20,
    stock: 120,
    image: "/assets/notebook-pen.jpg",
    description: "Reliable 0.5 mm black ink ballpen for classwork and examinations.",
  },
  {
    id: 9,
    name: "Black & White Printing · per page",
    category: "Services",
    price: 3,
    stock: 999,
    image: "/assets/stationery.jpg",
    description: "Clear black and white printing on standard A4 paper.",
  },
  {
    id: 10,
    name: "Color Printing · per page",
    category: "Services",
    price: 10,
    stock: 999,
    image: "/assets/stationery.jpg",
    description: "Full-color printing on standard A4 paper for school requirements.",
  },
  {
    id: 11,
    name: "Photocopying · per page",
    category: "Services",
    price: 2,
    stock: 999,
    image: "/assets/notebook-pen.jpg",
    description: "Fast, clear A4 photocopying for documents and class materials.",
  },
  {
    id: 12,
    name: "ID-size Lamination",
    category: "Services",
    price: 25,
    stock: 999,
    image: "/assets/notebook-pen.jpg",
    description: "Protective hot lamination for identification cards and small documents.",
  },
];

export async function getProducts() {
  return (await apiRequest<{ products: Product[] }>("/products")).products;
}

export async function createProduct(product: Omit<Product, "id">) {
  const created = (
    await apiRequest<{ product: Product }>(
      "/products",
      { method: "POST", body: JSON.stringify(product) },
      true,
    )
  ).product;
  requestNotificationRefresh();
  return created;
}

export async function updateProduct(id: number, updates: Partial<Product>) {
  const updated = (
    await apiRequest<{ product: Product }>(
      `/products/${id}`,
      { method: "PUT", body: JSON.stringify(updates) },
      true,
    )
  ).product;
  requestNotificationRefresh();
  return updated;
}

export async function deleteProduct(id: number) {
  await apiRequest(`/products/${id}`, { method: "DELETE" }, true);
  requestNotificationRefresh();
}
