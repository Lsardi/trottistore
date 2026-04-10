/**
 * API client pour communiquer avec les microservices TrottiStore
 */

// In browser: use relative URLs (proxied via Next.js rewrites)
// On server: call services directly
const isBrowser = typeof window !== "undefined";

const API_URLS = {
  ecommerce: isBrowser ? "" : (process.env.NEXT_PUBLIC_API_ECOMMERCE || 'http://localhost:3001'),
  crm: isBrowser ? "" : (process.env.NEXT_PUBLIC_API_CRM || 'http://localhost:3002'),
  analytics: isBrowser ? "" : (process.env.NEXT_PUBLIC_API_ANALYTICS || 'http://localhost:3003'),
  sav: isBrowser ? "" : (process.env.NEXT_PUBLIC_API_SAV || 'http://localhost:3004'),
} as const;

type Service = keyof typeof API_URLS;

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export class ApiError extends Error {
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

    const sessionStorageKey = "trottistore-session-id";
    let sessionId = localStorage.getItem(sessionStorageKey);
    if (!sessionId) {
      sessionId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(sessionStorageKey, sessionId);
    }
    headers["x-session-id"] = sessionId;
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
    apiFetch<{ success: boolean; data: CartSummary }>('ecommerce', '/cart'),

  addItem: (body: { productId: string; variantId?: string; quantity: number }) =>
    apiFetch<{ success: boolean; data: CartSummary }>('ecommerce', '/cart/items', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateItem: (productId: string, body: { quantity: number }) =>
    apiFetch<{ success: boolean; data: CartSummary }>('ecommerce', `/cart/items/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  removeItem: (productId: string) =>
    apiFetch<{ success: boolean; data: CartSummary }>('ecommerce', `/cart/items/${productId}`, {
      method: 'DELETE',
    }),

  clear: () =>
    apiFetch<{ success: boolean; data: CartSummary }>('ecommerce', '/cart', { method: 'DELETE' }),
};

export const ordersApi = {
  create: (body: {
    shippingAddressId: string;
    billingAddressId?: string;
    paymentMethod: string;
    notes?: string;
    shippingMethod?: "DELIVERY" | "STORE_PICKUP";
    acceptedCgv: true;
  }) =>
    apiFetch<{ success: boolean; data: Order }>('ecommerce', '/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  list: (params?: { page?: number }) =>
    apiFetch<{ success: boolean; data: Order[]; pagination: Pagination }>('ecommerce', '/orders', { params }),

  getById: (id: string) =>
    apiFetch<{ success: boolean; data: Order }>('ecommerce', `/orders/${id}`),

  adminList: (params?: { page?: number; limit?: number; status?: string; search?: string }) =>
    apiFetch<{ success: boolean; data: AdminOrderSummary[]; pagination: Pagination }>('ecommerce', '/admin/orders', { params }),

  adminGetById: (id: string) =>
    apiFetch<{ success: boolean; data: Order }>('ecommerce', `/admin/orders/${id}`),

  adminUpdateStatus: (id: string, body: { status: string; note?: string }) =>
    apiFetch<{ success: boolean; data: Order }>('ecommerce', `/admin/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  adminUpdateTracking: (
    id: string,
    body: { trackingNumber: string; note?: string; markAsShipped?: boolean }
  ) =>
    apiFetch<{ success: boolean; data: Order }>('ecommerce', `/admin/orders/${id}/tracking`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

export const addressesApi = {
  list: () =>
    apiFetch<{ success: boolean; data: Address[] }>('ecommerce', '/addresses'),

  create: (body: {
    firstName: string;
    lastName: string;
    street: string;
    street2?: string;
    city: string;
    postalCode: string;
    country?: string;
    phone?: string;
    company?: string;
    label?: string;
    type?: 'SHIPPING' | 'BILLING';
    isDefault?: boolean;
  }) =>
    apiFetch<{ success: boolean; data: Address }>('ecommerce', '/addresses', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (id: string, body: Partial<{
    firstName: string;
    lastName: string;
    street: string;
    street2: string;
    city: string;
    postalCode: string;
    country: string;
    phone: string;
    company: string;
    label: string;
    type: 'SHIPPING' | 'BILLING';
    isDefault: boolean;
  }>) =>
    apiFetch<{ success: boolean; data: Address }>('ecommerce', `/addresses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>('ecommerce', `/addresses/${id}`, {
      method: 'DELETE',
    }),
};

export const leadsApi = {
  createPro: (body: {
    company: string;
    contact: string;
    email: string;
    phone?: string;
    fleetSize?: string;
    message?: string;
  }) =>
    apiFetch<{ success: boolean; data: { id: string; createdAt: string } }>('ecommerce', '/leads/pro', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export const stockAlertsApi = {
  create: (body: { productId: string; variantId?: string; email: string }) =>
    apiFetch<{
      success: boolean;
      data: {
        id: string;
        productId: string;
        variantId: string | null;
        email: string;
        status: string;
        createdAt: string;
        updatedAt: string;
      };
    }>('ecommerce', '/stock-alerts', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export const checkoutApi = {
  config: () =>
    apiFetch<{ success: boolean; data: { publishableKey: string; supportedMethods: string[] } }>(
      "ecommerce",
      "/checkout/config",
    ),

  createPaymentIntent: (body: {
    orderId?: string;
    paymentMethod: "CARD" | "APPLE_PAY" | "GOOGLE_PAY" | "LINK";
    shippingMethod?: "DELIVERY" | "STORE_PICKUP";
  }) =>
    apiFetch<{
      success: boolean;
      data: {
        clientSecret: string;
        paymentIntentId: string;
        amount: number;
        amountCents: number;
        currency: string;
      };
    }>("ecommerce", "/checkout/payment-intent", {
      method: "POST",
      body: JSON.stringify(body),
    }),
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

export interface AdminCategoryPayload {
  name: string;
  slug?: string;
  parentId?: string | null;
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  productCount: number;
  createdAt: string;
}

export const adminCategoriesApi = {
  list: () =>
    apiFetch<{ success: boolean; data: AdminCategory[] }>('ecommerce', '/admin/categories'),

  create: (body: AdminCategoryPayload) =>
    apiFetch<{ success: boolean; data: AdminCategory }>('ecommerce', '/admin/categories', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (id: string, body: Partial<AdminCategoryPayload>) =>
    apiFetch<{ success: boolean; data: AdminCategory }>('ecommerce', `/admin/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>('ecommerce', `/admin/categories/${id}`, {
      method: 'DELETE',
    }),
};

// ─── AUTH ──────────────────────────────────────────────────

export const authApi = {
  login: (body: { email: string; password: string }) =>
    apiFetch<{ success: boolean; data: { accessToken: string; user: User } }>(
      'ecommerce',
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    ).then((res) => ({ success: res.success, ...res.data })),

  register: (body: { email: string; password: string; firstName: string; lastName: string; phone?: string }) =>
    apiFetch<{ success: boolean; data: { user: User } }>('ecommerce', '/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((res) => ({ success: res.success, ...res.data })),

  refresh: () =>
    apiFetch<{ success: boolean; data: { accessToken: string } }>('ecommerce', '/auth/refresh', {
      method: 'POST',
    }).then((res) => ({ success: res.success, ...res.data })),

  logout: () =>
    apiFetch<{ success: boolean }>('ecommerce', '/auth/logout', { method: 'POST' }),

  me: () =>
    apiFetch<{ success: boolean; data: { user: User } }>('ecommerce', '/auth/me').then((res) => ({
      success: res.success,
      data: res.data.user,
    })),

  updateProfile: (body: { firstName?: string; lastName?: string; phone?: string | null }) =>
    apiFetch<{ success: boolean; data: { user: User } }>('ecommerce', '/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  forgotPassword: (body: { email: string }) =>
    apiFetch<{ success: boolean; data: { message: string } }>('ecommerce', '/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  resetPassword: (body: { token: string; newPassword: string }) =>
    apiFetch<{ success: boolean; data: { message: string } }>('ecommerce', '/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// ─── Reviews ─────────────────────────────────────────────

export interface ReviewData {
  id: string;
  rating: number;
  title: string | null;
  content: string;
  serviceTag: string | null;
  verifiedPurchase: boolean;
  createdAt: string;
  user: { firstName: string; lastName: string };
  product?: { name: string; slug: string } | null;
}

export const reviewsApi = {
  list: (params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    return apiFetch<{ success: boolean; data: ReviewData[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      'ecommerce', `/reviews?${qs.toString()}`,
    );
  },

  stats: () =>
    apiFetch<{ success: boolean; data: { averageRating: number; totalReviews: number } }>(
      'ecommerce', '/reviews/stats',
    ),

  forProduct: (slug: string) =>
    apiFetch<{ success: boolean; data: ReviewData[]; stats: { averageRating: number; totalReviews: number } }>(
      'ecommerce', `/products/${slug}/reviews`,
    ),

  create: (body: { productId?: string; rating: number; title?: string; content: string; serviceTag?: string }) =>
    apiFetch<{ success: boolean; data: ReviewData }>('ecommerce', '/reviews', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// ─── SAV ──────────────────────────────────────────────────

export const repairsApi = {
  create: (body: {
    customerId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    productModel: string;
    serialNumber?: string;
    type: string;
    priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    issueDescription: string;
    photosUrls?: string[];
  }) =>
    apiFetch<{ success: boolean; data: RepairTicket }>('sav', '/repairs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  list: (params?: { status?: string; page?: number; limit?: number; customerId?: string; sort?: string }) =>
    apiFetch<{ success: boolean; data: RepairTicket[]; pagination: Pagination }>('sav', '/repairs', { params }),

  getById: (id: string) =>
    apiFetch<{ success: boolean; data: RepairTicket }>('sav', `/repairs/${id}`),

  getTracking: (token: string) =>
    apiFetch<{ success: boolean; data: RepairTracking }>('sav', `/repairs/tracking/${token}`),

  updateStatus: (id: string, body: { status: RepairStatus; note?: string }) =>
    apiFetch<{ success: boolean; data: RepairTicket }>('sav', `/repairs/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  acceptQuoteClient: (id: string, trackingToken?: string) =>
    apiFetch<{ success: boolean; data: RepairTicket }>('sav', `/repairs/${id}/quote/accept-client`, {
      method: 'PUT',
      body: JSON.stringify({ trackingToken }),
    }),

  diagnosticStats: () =>
    apiFetch<{
      success: boolean;
      data: {
        categories: Array<{
          category: string;
          count: number;
          avgCost: number | null;
          minCost: number | null;
          maxCost: number | null;
          avgDays: number | null;
        }>;
        totalRepairs: number;
      };
    }>('sav', '/repairs/diagnostic-stats'),
};

export const appointmentsApi = {
  slots: (params: { date: string; durationMin?: number }) =>
    apiFetch<{ success: boolean; data: AppointmentSlot[] }>('sav', '/appointments/slots', { params }),

  create: (body: {
    ticketId?: string;
    customerId?: string;
    customerName: string;
    customerEmail?: string;
    customerPhone: string;
    serviceType?: "REPARATION" | "DIAGNOSTIC" | "ESSAI_BOUTIQUE";
    isExpress?: boolean;
    startsAt: string;
    durationMin?: number;
    notes?: string;
  }) =>
    apiFetch<{ success: boolean; data: RepairAppointment }>('sav', '/appointments', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// ─── ANALYTICS (admin) ────────────────────────────────────

export const analyticsApi = {
  realtime: () =>
    apiFetch<{ success: boolean; data: RealtimeKpis }>('analytics', '/analytics/realtime'),

  cockpit: () =>
    apiFetch<{ success: boolean; data: CockpitSnapshot }>('analytics', '/analytics/cockpit'),

  kpis: (period: string) =>
    apiFetch<{ success: boolean; data: AggregatedKpis }>('analytics', '/analytics/kpis', { params: { period } }),

  topProducts: (params?: { period?: string; limit?: number }) =>
    apiFetch<{ success: boolean; data: TopProduct[] }>('analytics', '/analytics/products/top', { params }),

  sales: (params?: { period?: string; group?: string }) =>
    apiFetch<{ success: boolean; data: SalesDataPoint[] }>('analytics', '/analytics/sales', { params }),

  trackFunnel: (
    type:
      | "diagnostic_category_selected"
      | "diagnostic_result_viewed"
      | "diagnostic_ticket_cta_clicked"
      | "urgence_slots_loaded"
      | "urgence_ticket_created"
      | "repair_tracking_viewed",
    properties?: Record<string, string | number | boolean | null>,
  ) =>
    apiFetch<{ accepted: number; message: string }>('analytics', '/analytics/events/public', {
      method: "POST",
      body: JSON.stringify({
        events: [{ type, properties }],
      }),
    }),
};

// ─── STOCK (admin) ────────────────────────────────────────

export const stockApi = {
  createMovement: (body: {
    variantId: string;
    type: StockMovementType;
    quantity: number;
    reason?: string;
    referenceId?: string;
    referenceType?: "ORDER" | "REPAIR_TICKET" | "MANUAL";
  }) =>
    apiFetch<{ success: boolean; data: { movement: StockMovement; stockAfter: number; alert: StockAlertMessage | null } }>(
      "ecommerce",
      "/stock/movements",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),

  listMovements: (params?: { page?: number; limit?: number; variantId?: string; type?: StockMovementType }) =>
    apiFetch<{ success: boolean; data: StockMovement[]; pagination: Pagination }>(
      "ecommerce",
      "/stock/movements",
      { params },
    ),

  listAlerts: (params?: { threshold?: number }) =>
    apiFetch<{ success: boolean; data: StockAlert[]; count: number }>(
      "ecommerce",
      "/stock/alerts",
      { params },
    ),

  summary: () =>
    apiFetch<{ success: boolean; data: StockMovementSummary[] }>(
      "ecommerce",
      "/stock/movements/summary",
    ),
};

// ─── CRM ───────────────────────────────────────────────────

export const customersApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    loyaltyTier?: "BRONZE" | "SILVER" | "GOLD";
  }) =>
    apiFetch<{ success: boolean; data: CustomerListItem[]; pagination: Pagination }>("crm", "/customers", { params }),

  getById: (customerId: string) =>
    apiFetch<{ success: boolean; data: CustomerDetail }>("crm", `/customers/${customerId}`),

  getGarage: (customerId: string) =>
    apiFetch<{ success: boolean; data: CustomerGarage }>("crm", `/customers/${customerId}/garage`),

  update: (
    customerId: string,
    body: Partial<{
      firstName: string;
      lastName: string;
      phone: string | null;
      source: string;
      tags: string[];
      scooterModels: string[];
      healthScore: number | null;
    }>
  ) =>
    apiFetch<{ success: boolean; data: CustomerDetail }>("crm", `/customers/${customerId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

// ─── TRIGGERS (SAV) ───────────────────────────────────────

export const triggersApi = {
  run: (body?: { dryRun?: boolean }) =>
    apiFetch<{ success: boolean; data?: TriggerRunResult; message?: string }>("crm", "/triggers/run", {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
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
  salePriceHt?: string;
  weightGrams?: number;
  status: string;
  isFeatured: boolean;
  images: ProductImage[];
  variants: ProductVariant[];
  categories: { category: Category }[];
  brand?: { id: string; name: string; slug: string };
  createdAt?: string;
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
  product: {
    name: string;
    slug: string;
    sku: string;
    image?: ProductImage | null;
  };
  variant?: {
    name: string;
    sku: string;
    attributes?: Record<string, string>;
  } | null;
  unitPriceHt: number;
  lineTotalHt: number;
  availableStock?: number | null;
}

export interface CartSummary {
  items: CartItem[];
  itemCount: number;
  totalHt: number;
  updatedAt: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  shippingMethod?: string;
  trackingNumber?: string | null;
  notes?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  subtotalHt: string;
  tvaAmount: string;
  shippingCost?: string;
  totalTtc: string;
  items: OrderItem[];
  itemsCount?: number;
  customer?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  };
  statusHistory?: Array<{
    id: string;
    fromStatus: string;
    toStatus: string;
    note?: string | null;
    changedAt: string;
    changedBy?: string | null;
  }>;
  createdAt: string;
}

export interface AdminOrderSummary {
  id: string;
  orderNumber: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  shippingMethod?: string;
  trackingNumber?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  totalTtc: string;
  itemsCount?: number;
  customer?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  };
  createdAt: string;
}

export interface OrderItem {
  id: string;
  quantity: number;
  unitPriceHt: string;
  totalHt?: string;
  product: Product;
  variant?: {
    id: string;
    name: string;
    sku: string;
    attributes?: Record<string, string> | null;
  } | null;
}

export interface Address {
  id: string;
  type: string;
  label?: string | null;
  firstName: string;
  lastName: string;
  company?: string | null;
  street: string;
  street2?: string | null;
  city: string;
  postalCode: string;
  country: string;
  phone?: string | null;
  isDefault: boolean;
}

export interface User {
  id: string;
  email: string;
  emailVerified?: boolean;
  phone?: string | null;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  role: string;
  status?: string;
  lastLoginAt?: string | null;
  loginCount?: number;
  createdAt?: string;
  addresses?: Address[];
  customerProfile?: {
    loyaltyTier: string;
    loyaltyPoints: number;
    totalOrders: number;
    totalSpent: string;
    lastOrderAt?: string | null;
  } | null;
}

export interface RepairTicket {
  id: string;
  ticketNumber: number;
  trackingToken?: string;
  trackingUrl?: string;
  productModel: string;
  status: string;
  type: string;
  priority: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  issueDescription: string;
  photosUrls?: string[];
  diagnosis?: string;
  estimatedCost?: string;
  quoteAcceptedAt?: string;
  statusLog?: Array<{
    fromStatus: string;
    toStatus: string;
    note?: string;
    createdAt: string;
  }>;
  appointments?: RepairAppointment[];
  createdAt: string;
  updatedAt?: string;
}

export type RepairStatus =
  | "RECU"
  | "DIAGNOSTIC"
  | "DEVIS_ENVOYE"
  | "DEVIS_ACCEPTE"
  | "EN_REPARATION"
  | "EN_ATTENTE_PIECE"
  | "PRET"
  | "RECUPERE"
  | "REFUS_CLIENT"
  | "IRREPARABLE";

export interface RepairAppointment {
  id: string;
  ticketId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  serviceType: string;
  isExpress: boolean;
  expressSurcharge: string;
  startsAt: string;
  endsAt: string;
  status: string;
  notes?: string;
}

export interface AppointmentSlot {
  startsAt: string;
  endsAt: string;
  available: boolean;
}

export interface RepairTracking {
  ticketNumber: number;
  productModel: string;
  status: string;
  priority: string;
  type: string;
  diagnosis?: string;
  estimatedCost?: string;
  actualCost?: string;
  estimatedDays?: number;
  photosUrls: string[];
  quoteAcceptedAt?: string;
  createdAt: string;
  updatedAt: string;
  nextAppointment?: RepairAppointment | null;
  statusLog: Array<{
    fromStatus: string;
    toStatus: string;
    note?: string;
    createdAt: string;
  }>;
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

export interface CockpitSnapshot {
  revenue: {
    today: number;
    yesterday: number;
    sameDayLastWeek: number;
  };
  ordersToPrepare: Array<{
    id: string;
    orderNumber: number;
    status: string;
    totalTtc: string;
    createdAt: string;
  }>;
  appointmentsToday: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    customerName: string;
    serviceType: string;
    isExpress: boolean;
    status: string;
  }>;
  savWaiting: Array<{
    id: string;
    ticketNumber: number;
    status: string;
    priority: string;
    productModel: string;
    customerName: string | null;
    createdAt: string;
  }>;
  lowStock: Array<{
    id: string;
    sku: string;
    name: string;
    stockQuantity: number;
    lowStockThreshold: number;
    product: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
  crmInteractions: Array<{
    id: string;
    type: string;
    channel: string;
    subject: string | null;
    referenceId: string | null;
    createdAt: string;
    customer: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  }>;
  updatedAt: string;
}

export type StockMovementType =
  | "IN_PURCHASE"
  | "IN_RETURN"
  | "IN_ADJUSTMENT"
  | "OUT_SALE"
  | "OUT_REPAIR"
  | "OUT_ADJUSTMENT"
  | "OUT_LOSS";

export interface StockMovement {
  id: string;
  variantId: string;
  type: StockMovementType;
  quantity: number;
  reason?: string | null;
  referenceId?: string | null;
  referenceType?: "ORDER" | "REPAIR_TICKET" | "MANUAL" | null;
  performedBy: string;
  stockBefore: number;
  stockAfter: number;
  createdAt: string;
  variant?: {
    id: string;
    sku: string;
    name: string;
    stockQuantity: number;
  };
}

export interface StockAlert {
  variantId: string;
  sku: string;
  variantName: string;
  productName: string;
  stockQuantity: number;
  lowStockThreshold: number;
  severity: "OUT_OF_STOCK" | "LOW_STOCK";
}

export interface StockAlertMessage {
  type: "LOW_STOCK";
  message: string;
}

export interface StockMovementSummary {
  variantId: string;
  sku: string;
  name: string;
  totalIn: number;
  totalOut: number;
  movementCount: number;
  currentStock: number;
}

export interface CustomerListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  customerProfile?: {
    loyaltyTier: string;
    loyaltyPoints: number;
    totalOrders: number;
    totalSpent: number | string;
  } | null;
}

export interface CustomerGarage {
  profile: {
    loyaltyTier: string;
    loyaltyPoints: number;
    totalOrders: number;
    totalSpent: number;
    scooterModels: string[];
    tags: string[];
  };
  stats: {
    totalRepairs: number;
    activeRepairs: number;
    totalOrders: number;
    totalSpent: number;
    scooterModels: string[];
  };
  timeline: Array<{
    date: string;
    type: "REPAIR" | "ORDER" | "INTERACTION";
    data: Record<string, unknown>;
  }>;
}

export interface CustomerDetail {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  customerProfile?: {
    loyaltyTier: string;
    loyaltyPoints: number;
    totalOrders: number;
    totalSpent: number | string;
    source?: string | null;
    tags?: string[];
    scooterModels?: string[];
    healthScore?: number | null;
  } | null;
}

export interface TriggerRunResult {
  processed?: number;
  sent?: number;
  failed?: number;
  details?: Array<Record<string, unknown>>;
}
