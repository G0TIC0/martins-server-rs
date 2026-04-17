import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Quote, QuoteStatus, Customer, Item, ItemType, QuoteItem, TimelineEvent, UserProfile, UserRole, Ncm } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatDateTime(date: string | Date | undefined | null) {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  
  return dateTimeFormatter.format(d);
}

export function generateQuoteNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORC-${year}${month}-${random}`;
}

export function mapQuote(q: any): Quote {
  return {
    id: q.id,
    quoteNumber: q.quote_number,
    title: q.title,
    classification: q.classification,
    customerId: q.customer_id,
    customerName: q.customer_name,
    vehicleId: q.vehicle_id,
    vehiclePlate: q.vehicle_plate,
    vehicleModel: q.vehicle_model,
    currentKm: q.current_km,
    status: q.status as QuoteStatus,
    serviceStatus: q.service_status,
    subtotal: Number(q.subtotal),
    discountTotal: Number(q.discount_total),
    taxTotal: Number(q.tax_total),
    shippingFee: Number(q.shipping_fee),
    urgencyFee: Number(q.urgency_fee),
    grandTotal: Number(q.grand_total),
    validUntil: q.valid_until,
    notes: q.notes,
    terms: q.terms,
    observations: q.observations,
    createdBy: q.created_by,
    createdAt: q.created_at,
    updatedAt: q.updated_at,
    approvedAt: q.approved_at,
    approvedBy: q.approved_by,
    items: q.quote_items ? q.quote_items.map(mapQuoteItem) : [],
    timeline: q.timeline_events ? q.timeline_events.map(mapTimelineEvent) : [],
    photos: q.quote_photos ? q.quote_photos.map((p: any) => ({
      id: p.id,
      quoteId: p.quote_id,
      photoUrl: p.photo_url,
      caption: p.caption,
      sortOrder: p.sort_order,
      createdAt: p.created_at
    })) : [],
  };
}

export function mapQuoteItem(i: any): QuoteItem {
  return {
    itemId: i.item_id,
    itemCode: i.item_code,
    name: i.name,
    ncm: i.ncm,
    type: i.type as ItemType,
    quantity: Number(i.quantity),
    costPrice: Number(i.cost_price),
    unitPrice: Number(i.unit_price),
    discount: Number(i.discount),
    total: Number(i.total),
  };
}

export function mapTimelineEvent(e: any): TimelineEvent {
  return {
    status: e.status as QuoteStatus,
    timestamp: e.timestamp,
    userId: e.user_id,
    userName: e.user_name,
    userRole: e.user_role as UserRole,
    notes: e.notes,
  };
}

export function mapCustomer(c: any): Customer {
  return {
    id: c.id,
    name: c.name,
    document: c.document,
    email: c.email,
    phone: c.phone,
    address: c.address,
    observations: c.observations,
    createdBy: c.created_by,
    createdAt: c.created_at,
  };
}

export function mapItem(i: any): Item {
  return {
    id: i.id,
    name: i.name,
    description: i.description,
    type: i.type as ItemType,
    costPrice: Number(i.cost_price),
    basePrice: Number(i.base_price),
    unit: i.unit,
    active: i.active,
    ncm: i.ncm,
    ncmDescription: i.ncm_description,
    fci: i.fci,
    partCodes: i.part_codes,
    observations: i.observations,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
  };
}

export function mapNcm(n: any): Ncm {
  return {
    id: n.id,
    code: n.code,
    description: n.description,
    updatedAt: n.updated_at,
  };
}

export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function mapProfile(p: any): UserProfile {
  return {
    uid: p.id || p.uid,
    email: p.email,
    displayName: p.display_name,
    photoURL: p.photo_url,
    role: p.role as UserRole,
    cpf: p.cpf,
    phone: p.phone,
    createdAt: p.created_at,
  };
}
