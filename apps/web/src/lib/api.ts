/**
 * API client pour communiquer avec les microservices TrottiStore
 */

const API_URLS = {
  ecommerce: process.env.NEXT_PUBLIC_API_ECOMMERCE || 'http://localhost:3001',
  crm: process.env.NEXT_PUBLIC_API_CRM || 'http://localhost:3002',
  analytics: process.env.NEXT_PUBLIC_API_ANALYTICS || 'http://localhost:3003',
  sav: process.env.NEXT_PUBLIC_API_SAV || 'http://localhost:3004',
} as const;

type Service = keyof typeof API_URLS;

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data: unknown,
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(
  service: Service,
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${API_URLS[service]}/api/v1${path}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  // Ajouter le token d'auth si disponible (côté client)
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    credentials: 'include', // Pour les cookies refresh_token
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, response.statusText, data);
  }

  return response.json();
}

// ─── E-COMMERCE ────────────────────────────────────────────

export const productsApi = {
  list: (params?: { page?: number; limit?: number; categorySlug?: string; search?: string; sort?: string }) =>
    apiFetch<{ success: boolean; data: Product[]; pagination: Pagination }>('ecommerce', '/products', { params }),

  getBySlug: (slug: string) =>
    apiFetch<{ success: boolean; data: Product }>('ecommerce', `/products/${slug}`),

  featured: () =>
    apiFetch<{ success: boolean; data: Product[] }>('ecommerce', '/products/featured'),
};

export const categoriesApi = {
  list: () =>
    apiFetch<{ success: boolean; data: Category[] }>('ecommerce', '/categories'),

  getBySlug: (slug: string, params?: { page?: number }) =>
    apiFetch<{ success: boolean; data: Category }>('ecommerce', `/categories/${slug}`, { params }),
};

export const cartApi = {
  get: () =>
    apiFetch<{ success: boolean; data: CartItem[] }>('ecommerce', '/cart'),

  addItem: (body: { productId: string; variantId?: string; quantity: number }) =>
    apiFetch<{ success: boolean; data: CartItem[] }>('ecommerce', '/cart/items', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateItem: (productId: string, body: { quantity: number }) =>
    apiFetch<{ success: boolean; data: CartItem[] }>('ecommerce', `/cart/items/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  removeItem: (productId: string) =>
    apiFetch<{ success: boolean }>('ecommerce', `/cart/items/${productId}`, { method: 'DELETE' }),

  clear: () =>
    apiFetch<{ success: boolean }>('ecommerce', '/cart', { method: 'DELETE' }),
};

export const ordersApi = {
  create: (body: { shippingAddressId: string; paymentMethod: string; notes?: string }) =>
    apiFetch<{ success: boolean; data: Order }>('ecommerce', '/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  list: (params?: { page?: number }) =>
    apiFetch<{ success: boolean; data: Order[]; pagination: Pagination }>('ecommerce', '/orders', { params }),

  getById: (id: string) =>
    apiFetch<{ success: boolean; data: Order }>('ecommerce', `/orders/${id}`),
};

// ─── ADMIN PRODUCTS ──────────────────────────────────────────

export interface AdminProductPayload {
  name: string;
  sku: string;
  description?: string;
  shortDescription?: string;
  brandId?: string | null;
  priceHt: number;
  tvaRate?: number;
  weightGrams?: number | null;
  status?: string;
  isFeatured?: boolean;
  metaTitle?: string | null;
  metaDesc?: string | null;
  categories?: string[];
  images?: { url: string; alt?: string; isPrimary?: boolean }[];
}

export const adminProductsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    categorySlug?: string;
    search?: string;
    sort?: string;
    status?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: string;
  }) =>
    apiFetch<{ success: boolean; data: Product[]; pagination: Pagination }>(
      'ecommerce',
      '/products',
      { params: { ...params, status: params?.status || undefined } }
    ),

  getById: (id: string) =>
    apiFetch<{ success: boolean; data: Product }>('ecommerce', `/admin/products/${id}`),

  create: (body: AdminProductPayload) =>
    apiFetch<{ success: boolean; data: Product }>('ecommerce', '/admin/products', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (id: string, body: Partial<AdminProductPayload>) =>
    apiFetch<{ success: boolean; data: Product }>('ecommerce', `/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  delete: (id: string, hard?: boolean) =>
    apiFetch<{ success: boolean; message: string }>(
      'ecommerce',
      `/admin/products/${id}${hard ? '?hard=true' : ''}`,
      { method: 'DELETE' }
    ),

  updateStock: (id: string, body: { variantId?: string; quantity: number }) =>
    apiFetch<{ success: boolean; data: ProductVariant }>(
      'ecommerce',
      `/admin/products/${id}/stock`,
      { method: 'PATCH', body: JSON.stringify(body) }
    ),

  bulkPrice: (updates: { productId: string; priceHt: number }[]) =>
    apiFetch<{ success: boolean; data: { updatedCount: number } }>(
      'ecommerce',
      '/admin/products/bulk-price',
      { method: 'PATCH', body: JSON.stringify({ updates }) }
    ),

  bulkStatus: (productIds: string[], status: string) =>
    apiFetch<{ success: boolean; data: { updatedCount: number } }>(
      'ecommerce',
      '/admin/products/bulk-status',
      { method: 'PATCH', body: JSON.stringify({ productIds, status }) }
    ),

  duplicate: (id: string) =>
    apiFetch<{ success: boolean; data: Product }>('ecommerce', `/admin/products/${id}/duplicate`, {
      method: 'POST',
    }),
};

// ─── AUTH ──────────────────────────────────────────────────

export const authApi = {
  login: (body: { email: string; password: string }) =>
    apiFetch<{ success: boolean; accessToken: string; user: User }>('ecommerce', '/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  register: (body: { email: string; password: string; firstName: string; lastName: string; phone?: string }) =>
    apiFetch<{ success: boolean; user: User }>('ecommerce', '/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  refresh: () =>
    apiFetch<{ success: boolean; accessToken: string }>('ecommerce', '/auth/refresh', { method: 'POST' }),

  logout: () =>
    apiFetch<{ success: boolean }>('ecommerce', '/auth/logout', { method: 'POST' }),

  me: () =>
    apiFetch<{ success: boolean; data: User }>('ecommerce', '/auth/me'),
};

// ─── SAV ──────────────────────────────────────────────────

export const repairsApi = {
  create: (body: { productModel: string; serialNumber?: string; type: string; issueDescription: string }) =>
    apiFetch<{ success: boolean; data: RepairTicket }>('sav', '/repairs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  list: (params?: { status?: string; page?: number }) =>
    apiFetch<{ success: boolean; data: RepairTicket[]; pagination: Pagination }>('sav', '/repairs', { params }),

  getById: (id: string) =>
    apiFetch<{ success: boolean; data: RepairTicket }>('sav', `/repairs/${id}`),
};

// ─── ANALYTICS (admin) ────────────────────────────────────

export const analyticsApi = {
  realtime: () =>
    apiFetch<{ success: boolean; data: RealtimeKpis }>('analytics', '/analytics/realtime'),

  kpis: (period: string) =>
    apiFetch<{ success: boolean; data: AggregatedKpis }>('analytics', '/analytics/kpis', { params: { period } }),

  topProducts: (params?: { period?: string; limit?: number }) =>
    apiFetch<{ success: boolean; data: TopProduct[] }>('analytics', '/analytics/products/top', { params }),

  sales: (params?: { period?: string; group?: string }) =>
    apiFetch<{ success: boolean; data: SalesDataPoint[] }>('analytics', '/analytics/sales', { params }),
};

// ─── TYPES ────────────────────────────────────────────────

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  priceHt: string;
  tvaRate: string;
  status: string;
  isFeatured: boolean;
  images: ProductImage[];
  variants: ProductVariant[];
  categories: { category: Category }[];
  brand?: { id: string; name: string; slug: string };
}

export interface ProductImage {
  id: string;
  url: string;
  alt?: string;
  position: number;
  isPrimary: boolean;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  priceOverride?: string;
  stockQuantity: number;
  attributes?: Record<string, string>;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  children?: Category[];
  _count?: { products: number };
}

export interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  product: Product;
}

export interface Order {
  id: string;
  orderNumber: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotalHt: string;
  tvaAmount: string;
  totalTtc: string;
  items: OrderItem[];
  createdAt: string;
}

export interface OrderItem {
  id: string;
  quantity: number;
  unitPriceHt: string;
  product: Product;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface RepairTicket {
  id: string;
  ticketNumber: number;
  productModel: string;
  status: string;
  type: string;
  priority: string;
  issueDescription: string;
  diagnosis?: string;
  estimatedCost?: string;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface RealtimeKpis {
  revenueToday: number;
  revenueYesterday: number;
  ordersToday: number;
  openSavTickets: number;
  lowStockAlerts: number;
}

export interface AggregatedKpis {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  newCustomers: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  slug: string;
  totalRevenue: number;
  totalQuantity: number;
}

export interface SalesDataPoint {
  date: string;
  revenue: number;
  orders: number;
}
