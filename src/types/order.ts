export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';

export type OrderType = 'dine-in' | 'takeaway';

export interface OrderItemLine {
  id: string;
  name: string;
  variantLabel: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  diet: 'veg' | 'non-veg' | 'egg';
  poster?: string;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  orderType: OrderType;
  tableNumber: string;
  customerName: string;
  customerPhone: string;
  cookingNotes: string;
  items: OrderItemLine[];
  totalCount: number;
  totalAmount: number;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
}
