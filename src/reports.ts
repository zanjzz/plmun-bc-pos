import { apiRequest } from "./api";

export type AdminReportData = {
  summary: {
    totalSales: number;
    transactionCount: number;
    walkInSales: number;
    onlineSales: number;
  };
  transactions: Array<{
    id: string;
    source: "walk-in" | "online";
    total: number;
    itemCount: number;
    items: Array<{
      productName: string;
      variationLabel: string | null;
      quantity: number;
      unitPrice: number;
    }>;
    orderId: string | null;
    createdAt: string;
  }>;
  inventoryMovements: Array<{
    id: string;
    productName: string;
    variationLabel: string | null;
    type: string;
    reason: string | null;
    quantityChange: number;
    stockAfter: number;
    reference: string | null;
    createdAt: string;
  }>;
};

export async function getAdminReports() {
  return apiRequest<AdminReportData>("/admin/reports", {}, true);
}
