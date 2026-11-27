import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Box,
  ClipboardList,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Utensils,
  X
} from 'lucide-react';
import { RESTAURANT_CONFIG } from '../data/menu';
import type { CartItem } from '../types/menu';
import { buildWhatsAppOrderUrl, formatINR } from '../utils/format';
import { DietaryBadge } from './DietaryBadge';

interface TableTrayDrawerProps {
  items: CartItem[];
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onUpdateQuantity: (cartKey: string, delta: number) => void;
  onClearTray: () => void;
  onOpenTableSpread: () => void;
}

export function TableTrayDrawer({
  items,
  isOpen,
  onOpen,
  onClose,
  onUpdateQuantity,
  onClearTray,
  onOpenTableSpread
}: TableTrayDrawerProps) {
  const [tableNumber, setTableNumber] = useState('');
  const [cookingNotes, setCookingNotes] = useState('');
  const [serverTicketMode, setServerTicketMode] = useState(false);

  const totalCount = items.reduce((sum, entry) => sum + entry.quantity, 0);
  const totalAmount = items.reduce(
    (sum, entry) => sum + entry.variant.price * entry.quantity,
    0
  );

  const handleClose = () => {
    setServerTicketMode(false);
    onClose();
  };

  const handleSendWhatsApp = () => {
    const url = buildWhatsAppOrderUrl({
      items,
      tableNumber,
      cookingNotes,
      totalAmount
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (totalCount === 0 && !isOpen) {
    return null;
  }

  return (
    <>
      {/* Sleek Floating Glass Bar when 1+ items are in the tray */}
      <AnimatePresence>
        {totalCount > 0 && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="fixed bottom-4 left-4 right-4 z-40 lg:left-auto lg:right-6 lg:w-[410px]"
          >
            <button
              type="button"
              onClick={onOpen}
              className="liquid-glass flex w-full items-center justify-between gap-3 rounded-2xl border border-white/20 px-4 py-3.5 text-left transition hover:border-[#D96B27]/70 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <span className="liquid-glass-saffron flex h-9 w-9 items-center justify-center rounded-xl border border-white/25 text-[#F7F3EC]">
                  <ShoppingBag className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold tabular-nums text-[#F7F3EC]">
                    {totalCount} {totalCount === 1 ? 'Item' : 'Items'} •{' '}
                    {formatINR(totalAmount)}
                  </p>
                  <p className="text-[11px] text-[#A8A29E]">
                    Ready to send to kitchen
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F4A26E]">
                View Table Tray
                <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table Tray Drawer / Server Ticket Screen */}
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
              className="liquid-glass-sheet relative z-10 flex max-h-[90dvh] w-full flex-col rounded-t-3xl border-t border-white/15 lg:h-full lg:max-h-none lg:w-[440px] lg:rounded-none lg:border-l lg:border-t-0"
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
                          {tableNumber.trim() ? `#${tableNumber.trim()}` : 'Dine-In'}
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

                        <div className="space-y-3 rounded-2xl border border-white/10 bg-[#12100E]/55 p-4">
                          <div>
                            <label
                              htmlFor="table-number"
                              className="block text-[11px] font-medium uppercase tracking-wider text-[#A8A29E]"
                            >
                              Table Number (Optional)
                            </label>
                            <input
                              id="table-number"
                              type="text"
                              value={tableNumber}
                              onChange={(e) => setTableNumber(e.target.value)}
                              placeholder="e.g. Table 7 or Patio 2"
                              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#1C1917] px-3 py-2 text-sm text-[#F7F3EC] placeholder-[#A8A29E]/60 outline-none focus:border-[#D96B27]/70"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor="cooking-notes"
                              className="block text-[11px] font-medium uppercase tracking-wider text-[#A8A29E]"
                            >
                              Cooking Preferences
                            </label>
                            <textarea
                              id="cooking-notes"
                              rows={2}
                              value={cookingNotes}
                              onChange={(e) => setCookingNotes(e.target.value)}
                              placeholder="e.g. Less oil, extra raita, crispy naan"
                              className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-[#1C1917] px-3 py-2 text-sm text-[#F7F3EC] placeholder-[#A8A29E]/60 outline-none focus:border-[#D96B27]/70"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {items.length > 0 && (
                    <div className="border-t border-white/10 bg-[#12100E]/80 px-5 pb-6 pt-4">
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
                          className="liquid-glass-pill flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-[#D96B27]/60 bg-[#D96B27]/15 px-4 py-3 text-sm font-semibold text-[#F7F3EC] transition hover:bg-[#D96B27]/25 active:scale-[0.98]"
                        >
                          <Box className="h-[18px] w-[18px] text-[#D96B27]" />
                          View Full Spread on Table (3D / AR)
                        </button>

                        <button
                          type="button"
                          onClick={handleSendWhatsApp}
                          className="liquid-glass-saffron flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-white/25 px-4 py-3.5 text-sm font-semibold text-[#F7F3EC] transition hover:brightness-110 active:scale-[0.98]"
                        >
                          <MessageCircle className="h-[18px] w-[18px]" />
                          Send Order via WhatsApp
                        </button>

                        <button
                          type="button"
                          onClick={() => setServerTicketMode(true)}
                          className="liquid-glass-pill flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold text-[#F7F3EC] transition hover:border-white/25 hover:brightness-110 active:scale-[0.98]"
                        >
                          <ClipboardList className="h-[18px] w-[18px] text-[#F4A26E]" />
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
