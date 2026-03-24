export interface User {
  id: number;
  email: string;
  name: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface DashboardMetrics {
  today: {
    totalSales: string;
    totalOrders: number;
    averageTicket: string;
  };
  activeUsers: number;
  conversionRate: string;
  salesLast7Days: Sale[];
  salesLast30Days: Sale[];
  topProducts: TopProduct[];
}

export interface Sale {
  date: string;
  value: number;
  product: string;
  category: string;
}

export interface TopProduct {
  name: string;
  category: string;
}

export interface RecentSale {
  id: number;
  productName: string;
  amount: number;
  price: number;
  totalValue: number;
  category: string;
  createdAt: string;
}