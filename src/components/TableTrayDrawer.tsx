import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Box,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Clock,
  Loader2,
  Minus,
  Phone,
  Plus,
  ShoppingBag,
  Trash2,
  User,
  Utensils,
  X
} from 'lucide-react';
import { RESTAURANT_CONFIG } from '../data/menu';
import type { CartItem } from '../types/menu';
import type { OrderRecord, OrderStatus, OrderType } from '../types/order';
import { formatINR } from '../utils/format';
import {
  getSavedActiveOrderId,
  placeTableOrder,
  saveActiveOrderId,
  subscribeOrderById
} from '../utils/orders';
import { DietaryBadge } from './DietaryBadge';

interface TableTrayDrawerProps {
  items: CartItem[];
  isOpen: boolean;
  tableNumber: string;
  onTableNumberChange: (val: string) => void;
  onOpen: () => void;
  onClose: () => void;
  onUpdateQuantity: (cartKey: string, delta: number) => void;
  onClearTray: () => void;
  onOpenTableSpread: () => void;
}

const COOKING_CHIPS = [
  'Less Spicy',
  'Less Oil',
  'No Onion / Garlic',
  'Extra Raita',
  'Crispy'
] as const;

const STATUS_META: Record<
  OrderStatus,
  { label: string; headline: string; step: number; badgeClass: string }
> = {
  pending: {
    label: 'Order Sent',
    headline: 'Waiting for kitchen confirmation',
    step: 1,
    badgeClass: 'border-[#F59E0B]/45 bg-[#F59E0B]/15 text-[#FCD34D]'
  },
  preparing: {
    label: 'Preparing',
    headline: 'Chef is preparing your dishes',
    step: 2,
    badgeClass: 'border-[#D96B27]/55 bg-[#D96B27]/20 text-[#F4A26E]'
  },
  ready: {
    label: 'Ready',
    headline: 'Fresh & ready — heading to you now',
    step: 3,
    badgeClass: 'border-[#22C55E]/50 bg-[#22C55E]/15 text-[#86EFAC]'
  },
  served: {
    label: 'Served',
    headline: 'Enjoy your meal at Namma Bengaluru Daba',
    step: 4,
    badgeClass: 'border-[#22C55E]/60 bg-[#22C55E]/20 text-[#86EFAC]'
  },
  cancelled: {
    label: 'Cancelled',
    headline: 'This order was cancelled by the restaurant',
    step: 0,
    badgeClass: 'border-red-500/45 bg-red-500/15 text-red-300'
  }
};

export function TableTrayDrawer({
  items,
  isOpen,
  tableNumber,
  onTableNumberChange,
  onOpen,
  onClose,
  onUpdateQuantity,
  onClearTray,
  onOpenTableSpread
}: TableTrayDrawerProps) {
  const [orderType, setOrderType] = useState<OrderType>('dine-in');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [cookingNotes, setCookingNotes] = useState('');
  const [serverTicketMode, setServerTicketMode] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tableError, setTableError] = useState(false);

  const [activeOrderId, setActiveOrderId] = useState<string | null>(() =>
    getSavedActiveOrderId()
  );
  const [activeOrder, setActiveOrder] = useState<OrderRecord | null>(null);
  const [showTrackerScreen, setShowTrackerScreen] = useState(false);

  useEffect(() => {
    if (!activeOrderId) {
      setActiveOrder(null);
      return;
    }

    const unsub = subscribeOrderById(
      activeOrderId,
      (order) => {
        if (!order) {
          setActiveOrder(null);
          setActiveOrderId(null);
          saveActiveOrderId(null);
          return;
        }
        // Expire old completed tickets automatically after 4 hours
        const ageMs = Date.now() - order.createdAt;
        if (
          (order.status === 'served' || order.status === 'cancelled') &&
          ageMs > 4 * 60 * 60 * 1000
        ) {
          setActiveOrder(null);
          setActiveOrderId(null);
          saveActiveOrderId(null);
          return;
        }
        setActiveOrder(order);
      },
      () => {
        // Keep last state gracefully if offline briefly
      }
    );

    return () => unsub();
  }, [activeOrderId]);

  const totalCount = items.reduce((sum, entry) => sum + entry.quantity, 0);
  const totalAmount = items.reduce(
    (sum, entry) => sum + entry.variant.price * entry.quantity,
    0
  );

  const handleClose = () => {
    setServerTicketMode(false);
    setSubmitError(null);
    onClose();
  };

  const toggleCookingChip = (chip: string) => {
    setCookingNotes((prev) => {
      const parts = prev
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const exists = parts.some((p) => p.toLowerCase() === chip.toLowerCase());
      if (exists) {
        return parts
          .filter((p) => p.toLowerCase() !== chip.toLowerCase())
          .join(', ');
      }
      return [...parts, chip].join(', ');
    });
  };

  const handlePlaceOrder = async () => {
    setSubmitError(null);
    setTableError(false);

    if (items.length === 0) return;

    if (orderType === 'dine-in' && !tableNumber.trim()) {
      setTableError(true);
      setSubmitError('Please enter your table number (or switch to Takeaway).');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await placeTableOrder({
        orderType,
        tableNumber,
        customerName,
        customerPhone,
        cookingNotes,
        items,
        totalAmount
      });
      setActiveOrder(created);
      setActiveOrderId(created.id);
      setShowTrackerScreen(true);
      setCookingNotes('');
      onClearTray();
    } catch (err) {
      const msg =
        err instanceof Error && err.message.toLowerCase().includes('permission')
          ? 'Could not submit order to Firestore (check Firestore security rules in Firebase Console).'
          : 'Could not place your order right now. Please check your internet connection and try again.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasLivePendingOrder =
    Boolean(activeOrder) &&
    activeOrder?.status !== 'served' &&
    activeOrder?.status !== 'cancelled';

  if (totalCount === 0 && !isOpen && !hasLivePendingOrder) {
    return null;
  }

  const activeMeta = activeOrder ? STATUS_META[activeOrder.status] : null;

  return (
    <>
      {/* Bottom Floating Bar: shows current Tray OR Live Order Status pill */}
      <AnimatePresence>
        {!isOpen && (totalCount > 0 || hasLivePendingOrder) && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="fixed bottom-4 left-4 right-4 z-40 lg:left-auto lg:right-6 lg:w-[410px]"
          >
            {totalCount > 0 ? (
              <div className="liquid-glass flex w-full items-center justify-between gap-2 rounded-2xl border border-white/20 p-2 pl-3.5 transition hover:border-[#D96B27]/70">
                <button
                  type="button"
                  onClick={() => {
                    setShowTrackerScreen(false);
                    onOpen();
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left active:scale-[0.99]"
                >
                  <motion.span
                    key={totalCount}
                    initial={{ scale: 0.78 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 460, damping: 20 }}
                    className="liquid-glass-saffron flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/25 text-[#F7F3EC]"
                  >
                    <ShoppingBag className="h-4 w-4" />
                  </motion.span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold tabular-nums text-[#F7F3EC]">
                      {totalCount} {totalCount === 1 ? 'Plate' : 'Plates'} •{' '}
                      {formatINR(totalAmount)}
                    </p>
                    <p className="truncate text-[11px] text-[#A8A29E]">
                      Tap to review &amp; place order
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={onOpenTableSpread}
                  className="liquid-glass-pill inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-xl border border-[#D96B27]/55 bg-[#D96B27]/20 px-3 text-[11px] font-semibold text-[#F4A26E] transition hover:bg-[#D96B27]/30 active:scale-95"
                >
                  <Box className="h-3.5 w-3.5 text-[#D96B27]" />
                  Table
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowTrackerScreen(false);
                    onOpen();
                  }}
                  aria-label="Open Table Tray"
                  className="liquid-glass-saffron inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-xl border border-white/25 px-3 text-xs font-semibold text-[#F7F3EC] transition hover:brightness-110 active:scale-95"
                >
                  Tray
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              activeOrder &&
              activeMeta && (
                <button
                  type="button"
                  onClick={() => {
                    setShowTrackerScreen(true);
                    onOpen();
                  }}
                  className="liquid-glass flex w-full items-center justify-between gap-3 rounded-2xl border border-[#D96B27]/45 p-2.5 pl-3.5 text-left transition hover:border-[#D96B27]/80"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="liquid-glass-saffron flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/25 text-[#F7F3EC]">
                      <ChefHat className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#F7F3EC]">
                        Order {activeOrder.orderNumber} •{' '}
                        <span className="text-[#F4A26E]">{activeMeta.label}</span>
                      </p>
                      <p className="truncate text-[11px] text-[#A8A29E]">
                        {activeOrder.tableNumber === 'Takeaway'
                          ? 'Takeaway'
                          : `Table #${activeOrder.tableNumber}`}{' '}
                        • {activeOrder.totalCount} items • {formatINR(activeOrder.totalAmount)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#F7F3EC]">
                    Track
                  </span>
                </button>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table Tray Drawer / Order Tracker / Server Ticket */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-stretch lg:justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />

            <motion.aside
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              className="liquid-glass-sheet relative z-10 flex max-h-[92dvh] w-full flex-col rounded-t-3xl border-t border-white/15 lg:h-full lg:max-h-none lg:w-[440px] lg:rounded-none lg:border-l lg:border-t-0"
              role="dialog"
              aria-modal="true"
              aria-label="Table Tray"
            >
              {serverTicketMode ? (
                /* HIGH-CONTRAST KITCHEN / SERVER TICKET MODE */
                <div className="flex h-full flex-col justify-between bg-[#F7F3EC] p-6 text-[#12100E]">
                  <div className="overflow-y-auto">
                    <div className="flex items-center justify-between border-b-2 border-[#12100E]/15 pb-4">
                      <button
                        type="button"
                        onClick={() => setServerTicketMode(false)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#12100E]/20 px-3 py-1.5 text-xs font-semibold text-[#12100E] hover:bg-[#12100E]/5"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Edit Tray
                      </button>
                      <button
                        type="button"
                        onClick={handleClose}
                        aria-label="Close ticket"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#12100E]/15 text-[#12100E]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-5">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D96B27]">
                        {RESTAURANT_CONFIG.brandName}
                      </p>
                      <div className="mt-1 flex items-baseline justify-between">
                        <h2 className="font-serif text-3xl font-bold tracking-tight">
                          Table Order
                        </h2>
                        <span className="rounded-xl bg-[#12100E] px-3 py-1 text-lg font-bold tabular-nums text-[#F7F3EC]">
                          {orderType === 'takeaway'
                            ? 'Takeaway'
                            : tableNumber.trim()
                              ? `#${tableNumber.trim()}`
                              : 'Dine-In'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 divide-y divide-[#12100E]/15 border-y-2 border-[#12100E]">
                      {items.map((entry) => {
                        const showVariant =
                          entry.item.variants.length > 1 ||
                          entry.variant.label !== 'Regular';
                        return (
                          <div key={entry.cartKey} className="py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5">
                                <span className="rounded-lg bg-[#D96B27] px-2.5 py-0.5 text-lg font-extrabold tabular-nums text-[#F7F3EC]">
                                  {entry.quantity}x
                                </span>
                                <div>
                                  <p className="text-lg font-bold leading-snug">
                                    {entry.item.name}
                                  </p>
                                  {showVariant && (
                                    <p className="mt-0.5 text-sm font-semibold text-[#12100E]/70">
                                      {entry.variant.label}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="text-base font-bold tabular-nums">
                                {formatINR(entry.variant.price * entry.quantity)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {cookingNotes.trim() && (
                      <div className="mt-5 rounded-2xl border-2 border-[#D96B27]/50 bg-[#D96B27]/10 p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-[#D96B27]">
                          Kitchen Notes
                        </p>
                        <p className="mt-1 text-lg font-semibold text-[#12100E]">
                          {cookingNotes}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 border-t border-[#12100E]/15 pt-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold uppercase tracking-wider text-[#12100E]/70">
                        Estimated Total ({totalCount} items)
                      </span>
                      <span className="text-2xl font-extrabold tabular-nums">
                        {formatINR(totalAmount)}
                      </span>
                    </div>
                    <p className="mt-2 text-center text-xs font-medium text-[#12100E]/60">
                      Show this screen to your server to confirm with the kitchen
                    </p>
                  </div>
                </div>
              ) : showTrackerScreen && activeOrder && activeMeta ? (
                /* LIVE ORDER CONFIRMATION & STATUS TRACKER */
                <div className="flex h-full flex-col justify-between overflow-hidden">
                  <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#22C55E]/40 bg-[#22C55E]/15 text-[#86EFAC]">
                        <CheckCircle2 className="h-5 w-5" />
                      </span>
                      <div>
                        <h2 className="font-serif text-lg font-semibold text-[#F7F3EC]">
                          Order {activeOrder.orderNumber}
                        </h2>
                        <p className="text-[11px] text-[#A8A29E]">
                          Sent directly to kitchen &amp; admin desk
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClose}
                      aria-label="Close Order Tracker"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#F7F3EC] transition hover:bg-white/10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                    {/* Live Status Stepper */}
                    <div className="rounded-2xl border border-white/12 bg-[#141418] p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${activeMeta.badgeClass}`}
                        >
                          <Clock className="h-3.5 w-3.5" />
                          {activeMeta.label}
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-semibold text-[#F7F3EC]">
                          {activeOrder.orderType === 'takeaway'
                            ? 'Takeaway'
                            : `Table #${activeOrder.tableNumber}`}
                        </span>
                      </div>

                      <p className="mt-2.5 text-sm font-medium text-[#F7F3EC]">
                        {activeMeta.headline}
                      </p>

                      {activeOrder.status !== 'cancelled' && (
                        <div className="mt-4 grid grid-cols-4 gap-1.5">
                          {(['Sent', 'Preparing', 'Ready', 'Served'] as const).map(
                            (label, idx) => {
                              const reached = activeMeta.step >= idx + 1;
                              return (
                                <div key={label} className="space-y-1.5 text-center">
                                  <div
                                    className={`h-1.5 rounded-full transition-colors ${
                                      reached ? 'bg-[#D96B27]' : 'bg-white/10'
                                    }`}
                                  />
                                  <span
                                    className={`block text-[10px] font-medium ${
                                      reached ? 'text-[#F7F3EC]' : 'text-[#A8A29E]/60'
                                    }`}
                                  >
                                    {label}
                                  </span>
                                </div>
                              );
                            }
                          )}
                        </div>
                      )}
                    </div>

                    {/* Customer Details Summary */}
                    {(activeOrder.customerName || activeOrder.customerPhone) && (
                      <div className="rounded-2xl border border-white/10 bg-[#12100E]/70 p-3.5 text-xs">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#A8A29E]">
                          Guest Details
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-[#F7F3EC]">
                          {activeOrder.customerName && (
                            <span className="inline-flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-[#D96B27]" />
                              {activeOrder.customerName}
                            </span>
                          )}
                          {activeOrder.customerPhone && (
                            <span className="inline-flex items-center gap-1.5 tabular-nums">
                              <Phone className="h-3.5 w-3.5 text-[#D96B27]" />
                              {activeOrder.customerPhone}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Ordered Dishes */}
                    <div className="space-y-2 rounded-2xl border border-white/10 bg-[#12100E]/55 p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A8A29E]">
                        Ordered Items ({activeOrder.totalCount})
                      </p>
                      <div className="divide-y divide-white/10">
                        {activeOrder.items.map((line, i) => (
                          <div
                            key={`${line.id}-${line.variantLabel}-${i}`}
                            className="flex items-center justify-between gap-2 py-2 text-xs"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="rounded-md bg-[#D96B27]/20 px-1.5 py-0.5 font-bold tabular-nums text-[#F4A26E]">
                                {line.quantity}x
                              </span>
                              <span className="truncate font-medium text-[#F7F3EC]">
                                {line.name}
                                {line.variantLabel !== 'Regular'
                                  ? ` (${line.variantLabel})`
                                  : ''}
                              </span>
                            </div>
                            <span className="shrink-0 font-semibold tabular-nums text-[#F7F3EC]">
                              {formatINR(line.lineTotal)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {activeOrder.cookingNotes && (
                        <p className="mt-2 rounded-xl border border-[#D96B27]/35 bg-[#D96B27]/10 px-3 py-2 text-xs text-[#F4A26E]">
                          Notes: {activeOrder.cookingNotes}
                        </p>
                      )}
                      <div className="flex items-center justify-between border-t border-white/10 pt-2.5 text-sm font-bold text-[#F7F3EC]">
                        <span>Total</span>
                        <span className="tabular-nums">
                          {formatINR(activeOrder.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/10 bg-[#12100E]/85 px-5 pb-6 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowTrackerScreen(false);
                        onClose();
                      }}
                      className="liquid-glass-saffron flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-white/25 px-4 text-sm font-semibold text-[#F7F3EC] transition hover:brightness-110 active:scale-[0.98]"
                    >
                      <Plus className="h-4 w-4" />
                      Order More Dishes
                    </button>
                  </div>
                </div>
              ) : (
                /* STANDARD DARK OBSIDIAN TABLE TRAY */
                <>
                  <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <div>
                      <h2 className="font-serif text-xl font-semibold text-[#F7F3EC]">
                        Your Table Tray
                      </h2>
                      <p className="text-xs text-[#A8A29E]">
                        {totalCount} {totalCount === 1 ? 'dish' : 'dishes'} selected
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeOrder && (
                        <button
                          type="button"
                          onClick={() => setShowTrackerScreen(true)}
                          className="rounded-full border border-[#D96B27]/45 bg-[#D96B27]/15 px-3 py-1.5 text-[11px] font-semibold text-[#F4A26E]"
                        >
                          Live Order
                        </button>
                      )}
                      {items.length > 0 && (
                        <button
                          type="button"
                          onClick={onClearTray}
                          title="Clear tray"
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[#A8A29E] transition hover:border-red-400/40 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleClose}
                        aria-label="Close Table Tray"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#F7F3EC] transition hover:bg-white/10"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                    {items.length === 0 ? (
                      <div className="py-12 text-center">
                        <p className="font-serif text-lg text-[#F7F3EC]">
                          Your table tray is empty
                        </p>
                        <p className="mt-1 text-xs text-[#A8A29E]">
                          Inspect any dish in 3D or tap + Add to start ordering.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {items.map((entry) => {
                            const showVariant =
                              entry.item.variants.length > 1 ||
                              entry.variant.label !== 'Regular';
                            return (
                              <div
                                key={entry.cartKey}
                                className="liquid-glass-card flex items-center justify-between gap-3 rounded-2xl border border-white/12 p-3"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  {entry.item.poster ? (
                                    <img
                                      src={entry.item.poster}
                                      alt={entry.item.name}
                                      className="h-14 w-14 shrink-0 rounded-xl border border-white/10 object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#1C1917]">
                                      <Utensils className="h-4 w-4 text-[#D96B27]" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <DietaryBadge type={entry.item.diet} />
                                      <h3 className="truncate font-serif text-sm font-semibold text-[#F7F3EC]">
                                        {entry.item.name}
                                      </h3>
                                    </div>
                                    {showVariant && (
                                      <p className="mt-0.5 text-[11px] text-[#A8A29E]">
                                        Option: {entry.variant.label}
                                      </p>
                                    )}
                                    <p className="mt-1 text-xs font-semibold tabular-nums text-[#F7F3EC]">
                                      {formatINR(entry.variant.price * entry.quantity)}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-[#1C1917] px-2 py-1">
                                  <button
                                    type="button"
                                    onClick={() => onUpdateQuantity(entry.cartKey, -1)}
                                    aria-label="Decrease quantity"
                                    className="flex h-6 w-6 items-center justify-center rounded-full text-[#A8A29E] hover:bg-white/5 hover:text-[#F7F3EC]"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="w-5 text-center text-xs font-semibold tabular-nums text-[#F7F3EC]">
                                    {entry.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onUpdateQuantity(entry.cartKey, 1)}
                                    aria-label="Increase quantity"
                                    className="flex h-6 w-6 items-center justify-center rounded-full text-[#A8A29E] hover:bg-white/5 hover:text-[#F7F3EC]"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Order Type, Table #, Optional Guest Details & Cooking Notes */}
                        <div className="space-y-3 rounded-2xl border border-white/10 bg-[#12100E]/55 p-4">
                          <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-[#0C0C0F] p-1">
                            {(['dine-in', 'takeaway'] as const).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => {
                                  setOrderType(mode);
                                  setTableError(false);
                                  setSubmitError(null);
                                }}
                                className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                                  orderType === mode
                                    ? 'bg-[#D96B27] text-[#F7F3EC]'
                                    : 'text-[#A8A29E] hover:text-[#F7F3EC]'
                                }`}
                              >
                                {mode === 'dine-in' ? 'Dine-In (Table)' : 'Takeaway / Pickup'}
                              </button>
                            ))}
                          </div>

                          {orderType === 'dine-in' && (
                            <div>
                              <label
                                htmlFor="table-number"
                                className="block text-[11px] font-medium uppercase tracking-wider text-[#A8A29E]"
                              >
                                Table Number <span className="text-[#F4A26E]">*</span>
                              </label>
                              <input
                                id="table-number"
                                type="text"
                                value={tableNumber}
                                onChange={(e) => {
                                  onTableNumberChange(e.target.value);
                                  if (e.target.value.trim()) setTableError(false);
                                }}
                                placeholder="e.g. 7 or Patio 2"
                                className={`mt-1.5 w-full rounded-xl border bg-[#1C1917] px-3 py-2 text-sm text-[#F7F3EC] placeholder-[#A8A29E]/60 outline-none focus:border-[#D96B27]/70 ${
                                  tableError ? 'border-red-400' : 'border-white/10'
                                }`}
                              />
                            </div>
                          )}

                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            <div>
                              <label
                                htmlFor="customer-name"
                                className="block text-[11px] font-medium uppercase tracking-wider text-[#A8A29E]"
                              >
                                Your Name (Optional)
                              </label>
                              <input
                                id="customer-name"
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="e.g. Rahul"
                                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#1C1917] px-3 py-2 text-sm text-[#F7F3EC] placeholder-[#A8A29E]/60 outline-none focus:border-[#D96B27]/70"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="customer-phone"
                                className="block text-[11px] font-medium uppercase tracking-wider text-[#A8A29E]"
                              >
                                Mobile No. (Optional)
                              </label>
                              <input
                                id="customer-phone"
                                type="tel"
                                inputMode="tel"
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                                placeholder="e.g. 98765 43210"
                                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#1C1917] px-3 py-2 text-sm text-[#F7F3EC] placeholder-[#A8A29E]/60 outline-none focus:border-[#D96B27]/70"
                              />
                            </div>
                          </div>

                          <div>
                            <label
                              htmlFor="cooking-notes"
                              className="block text-[11px] font-medium uppercase tracking-wider text-[#A8A29E]"
                            >
                              Cooking Preferences
                            </label>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {COOKING_CHIPS.map((chip) => {
                                const selected = cookingNotes
                                  .toLowerCase()
                                  .includes(chip.toLowerCase());
                                return (
                                  <button
                                    key={chip}
                                    type="button"
                                    onClick={() => toggleCookingChip(chip)}
                                    className={`rounded-full border px-2.5 py-1 text-[10.5px] font-medium transition ${
                                      selected
                                        ? 'border-[#D96B27] bg-[#D96B27]/20 text-[#F4A26E]'
                                        : 'border-white/10 bg-[#1C1917] text-[#A8A29E] hover:text-[#F7F3EC]'
                                    }`}
                                  >
                                    {chip}
                                  </button>
                                );
                              })}
                            </div>
                            <textarea
                              id="cooking-notes"
                              rows={2}
                              value={cookingNotes}
                              onChange={(e) => setCookingNotes(e.target.value)}
                              placeholder="Any extra instructions for the kitchen..."
                              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-[#1C1917] px-3 py-2 text-sm text-[#F7F3EC] placeholder-[#A8A29E]/60 outline-none focus:border-[#D96B27]/70"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {items.length > 0 && (
                    <div className="border-t border-white/10 bg-[#12100E]/85 px-5 pb-6 pt-4">
                      {submitError && (
                        <p className="mb-2.5 rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                          {submitError}
                        </p>
                      )}

                      <div className="mb-3 flex items-baseline justify-between">
                        <span className="text-xs font-medium text-[#A8A29E]">
                          Tray Total (Taxes extra as applicable)
                        </span>
                        <span className="text-lg font-bold tabular-nums text-[#F7F3EC]">
                          {formatINR(totalAmount)}
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        <button
                          type="button"
                          onClick={onOpenTableSpread}
                          className="liquid-glass-pill flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl border border-[#D96B27]/60 bg-[#D96B27]/15 px-4 py-2.5 text-sm font-semibold text-[#F7F3EC] transition hover:bg-[#D96B27]/25 active:scale-[0.98]"
                        >
                          <Box className="h-[18px] w-[18px] text-[#D96B27]" />
                          View Full Spread on Table (3D / AR)
                        </button>

                        <button
                          type="button"
                          onClick={handlePlaceOrder}
                          disabled={isSubmitting}
                          className="liquid-glass-saffron flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-white/25 px-4 py-3.5 text-sm font-semibold text-[#F7F3EC] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="h-[18px] w-[18px] animate-spin" />
                              Placing Order…
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-[18px] w-[18px]" />
                              Place Order • {formatINR(totalAmount)}
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setServerTicketMode(true)}
                          className="liquid-glass-pill flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-[#F7F3EC] transition hover:border-white/25 hover:brightness-110 active:scale-[0.98]"
                        >
                          <ClipboardList className="h-4 w-4 text-[#F4A26E]" />
                          Show Order to Server
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
