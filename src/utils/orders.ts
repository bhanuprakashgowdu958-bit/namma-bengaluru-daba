import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type Unsubscribe
} from 'firebase/firestore';
import type { CartItem } from '../types/menu';
import type {
  OrderItemLine,
  OrderRecord,
  OrderStatus,
  OrderType
} from '../types/order';
import { db } from './firebase';

const ACTIVE_ORDER_STORAGE_KEY = 'nb_active_order_id';
const ORDERS_COLLECTION = 'orders';

export interface PlaceOrderInput {
  orderType: OrderType;
  tableNumber: string;
  customerName: string;
  customerPhone: string;
  cookingNotes: string;
  items: CartItem[];
  totalAmount: number;
}

function generateOrderNumber(timestampMs: number): string {
  const timePart = String(timestampMs).slice(-4);
  const randPart = String(Math.floor(10 + Math.random() * 90));
  return `NB-${timePart}${randPart}`;
}

export function getSavedActiveOrderId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACTIVE_ORDER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveOrderId(orderId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (orderId) {
      window.localStorage.setItem(ACTIVE_ORDER_STORAGE_KEY, orderId);
    } else {
      window.localStorage.removeItem(ACTIVE_ORDER_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota / private mode issues
  }
}

export async function placeTableOrder(input: PlaceOrderInput): Promise<OrderRecord> {
  const now = Date.now();
  const orderItems: OrderItemLine[] = input.items.map((entry) => {
    const line: OrderItemLine = {
      id: entry.item.id,
      name: entry.item.name,
      variantLabel: entry.variant.label,
      unitPrice: entry.variant.price,
      quantity: entry.quantity,
      lineTotal: entry.variant.price * entry.quantity,
      diet: entry.item.diet
    };
    if (entry.item.poster) {
      line.poster = entry.item.poster;
    }
    return line;
  });

  const totalCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const cleanTable =
    input.orderType === 'takeaway' ? 'Takeaway' : input.tableNumber.trim();

  const payload = {
    orderNumber: generateOrderNumber(now),
    orderType: input.orderType,
    tableNumber: cleanTable,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    cookingNotes: input.cookingNotes.trim(),
    items: orderItems,
    totalCount,
    totalAmount: input.totalAmount,
    status: 'pending' as OrderStatus,
    createdAt: now,
    updatedAt: now
  };

  const docRef = await addDoc(collection(db, ORDERS_COLLECTION), payload);
  saveActiveOrderId(docRef.id);

  return {
    id: docRef.id,
    ...payload
  };
}

function mapDocToOrder(id: string, data: Record<string, unknown>): OrderRecord {
  return {
    id,
    orderNumber: typeof data.orderNumber === 'string' ? data.orderNumber : `NB-${id.slice(0, 5)}`,
    orderType: data.orderType === 'takeaway' ? 'takeaway' : 'dine-in',
    tableNumber: typeof data.tableNumber === 'string' ? data.tableNumber : '',
    customerName: typeof data.customerName === 'string' ? data.customerName : '',
    customerPhone: typeof data.customerPhone === 'string' ? data.customerPhone : '',
    cookingNotes: typeof data.cookingNotes === 'string' ? data.cookingNotes : '',
    items: Array.isArray(data.items) ? (data.items as OrderItemLine[]) : [],
    totalCount: typeof data.totalCount === 'number' ? data.totalCount : 0,
    totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
    status: (data.status as OrderStatus) || 'pending',
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now()
  };
}

export function subscribeOrderById(
  orderId: string,
  onOrder: (order: OrderRecord | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, ORDERS_COLLECTION, orderId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onOrder(null);
        return;
      }
      onOrder(mapDocToOrder(snapshot.id, snapshot.data() as Record<string, unknown>));
    },
    (error) => {
      onError?.(error);
    }
  );
}

export function subscribeAllOrders(
  onOrders: (orders: OrderRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, ORDERS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) =>
        mapDocToOrder(d.id, d.data() as Record<string, unknown>)
      );
      onOrders(list);
    },
    (error) => {
      onError?.(error);
    }
  );
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<void> {
  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), {
    status,
    updatedAt: Date.now()
  });
}
