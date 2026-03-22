/**
 * Contrats d'événements métier — partagés entre tous les services.
 */

export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  version: number;
  data: T;
  metadata: {
    correlationId: string;
    causationId?: string;
    userId?: string;
  };
}

// ─── E-COMMERCE ────────────────────────────────────────────

export interface OrderCreatedEvent
  extends DomainEvent<{
    orderId: string;
    customerId: string;
    items: Array<{
      productId: string;
      variantId: string;
      quantity: number;
      unitPrice: number;
    }>;
    total: number;
    currency: "EUR";
    paymentMethod: string;
  }> {
  type: "order.created";
  source: "service-ecommerce";
}

export interface OrderStatusChangedEvent
  extends DomainEvent<{
    orderId: string;
    fromStatus: string;
    toStatus: string;
    reason?: string;
  }> {
  type: "order.status_changed";
  source: "service-ecommerce";
}

export interface PaymentConfirmedEvent
  extends DomainEvent<{
    orderId: string;
    paymentId: string;
    amount: number;
    method: string;
    reference: string;
  }> {
  type: "payment.confirmed";
  source: "service-ecommerce";
}

export interface PaymentInstallmentDueEvent
  extends DomainEvent<{
    orderId: string;
    installmentId: string;
    installmentNumber: number;
    totalInstallments: number;
    amountDue: number;
    dueDate: string;
    customerId: string;
  }> {
  type: "payment.installment_due";
  source: "service-ecommerce";
}

export interface StockLowEvent
  extends DomainEvent<{
    productId: string;
    variantId: string;
    currentQty: number;
    threshold: number;
    sku: string;
    productName: string;
  }> {
  type: "stock.low";
  source: "service-ecommerce";
}

// ─── CRM ───────────────────────────────────────────────────

export interface CustomerUpdatedEvent
  extends DomainEvent<{
    customerId: string;
    changes: Record<string, unknown>;
  }> {
  type: "customer.updated";
  source: "service-crm";
}

export interface CampaignSentEvent
  extends DomainEvent<{
    campaignId: string;
    name: string;
    recipientCount: number;
    channel: "email" | "sms";
  }> {
  type: "campaign.sent";
  source: "service-crm";
}

export interface LoyaltyTierChangedEvent
  extends DomainEvent<{
    customerId: string;
    fromTier: string;
    toTier: string;
    totalPoints: number;
  }> {
  type: "loyalty.tier_changed";
  source: "service-crm";
}

// ─── SAV ───────────────────────────────────────────────────

export interface RepairTicketCreatedEvent
  extends DomainEvent<{
    ticketId: string;
    customerId: string;
    productModel: string;
    serialNumber?: string;
    issueDescription: string;
  }> {
  type: "repair.created";
  source: "service-sav";
}

export interface RepairStatusChangedEvent
  extends DomainEvent<{
    ticketId: string;
    fromStatus: string;
    toStatus: string;
    technicianId?: string;
    note?: string;
  }> {
  type: "repair.status_changed";
  source: "service-sav";
}

export interface RepairCompletedEvent
  extends DomainEvent<{
    ticketId: string;
    customerId: string;
    totalCost: number;
    partsUsed: Array<{ name: string; quantity: number; cost: number }>;
    resolutionNote: string;
  }> {
  type: "repair.completed";
  source: "service-sav";
}

// ─── ANALYTICS ─────────────────────────────────────────────

export interface KpiThresholdEvent
  extends DomainEvent<{
    metric: string;
    currentValue: number;
    threshold: number;
    direction: "above" | "below";
  }> {
  type: "kpi.threshold_breached";
  source: "service-analytics";
}

// ─── REGISTRY ──────────────────────────────────────────────

export type EventType =
  | "order.created"
  | "order.status_changed"
  | "payment.confirmed"
  | "payment.installment_due"
  | "stock.low"
  | "customer.updated"
  | "campaign.sent"
  | "loyalty.tier_changed"
  | "repair.created"
  | "repair.status_changed"
  | "repair.completed"
  | "kpi.threshold_breached";
