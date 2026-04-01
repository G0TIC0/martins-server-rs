export type UserRole = 'admin' | 'manager' | 'sales' | 'finance' | 'technician' | 'customer';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  cpf?: string;
  phone?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  document: string;
  email?: string;
  phone?: string;
  address: string;
  observations: string;
  createdBy: string;
  createdAt: string;
}

export type ItemType = 'service' | 'product' | 'package' | 'labor';

export interface Vehicle {
  id: string;
  customerId: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  vin?: string; // Chassi
  observations?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  costPrice: number;
  basePrice: number;
  unit: string;
  active: boolean;
  ncm?: string;
  ncmDescription?: string;
  fci?: string;
  partCodes?: string[];
  observations?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type QuoteStatus = 'received' | 'analyzing' | 'negotiating' | 'awaiting_approval' | 'executing' | 'finished';
export type ServiceStatus = 'waiting' | 'in_progress' | 'testing' | 'ready' | 'delivered';

export interface TimelineEvent {
  status: QuoteStatus;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  notes?: string;
}

export interface QuoteItem {
  itemId: string;
  itemCode?: string;
  name: string;
  ncm?: string;
  type: ItemType;
  quantity: number;
  costPrice: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export type QuoteClassification = 'preventive' | 'preventive_preview' | 'corrective' | 'corrective_preview' | 'general_overhaul' | 'general_overhaul_preview' | 'complementary';

export interface Quote {
  id: string;
  quoteNumber: string;
  title: string;
  classification?: QuoteClassification;
  customerId: string;
  customerName: string;
  vehicleId?: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  currentKm?: number;
  status: QuoteStatus;
  serviceStatus?: ServiceStatus;
  items: QuoteItem[];
  timeline: TimelineEvent[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingFee: number;
  urgencyFee: number;
  grandTotal: number;
  validUntil: string;
  notes: string;
  terms: string;
  observations?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface CompanySettings {
  id: string;
  name: string;
  logoUrl: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  updatedAt: string;
}

export interface Ncm {
  id: string;
  code: string;
  description: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  timestamp: string;
}
