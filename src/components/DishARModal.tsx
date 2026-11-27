import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Box, Check, Minus, Plus, X } from 'lucide-react';
import type { MenuItem, PriceVariant } from '../types/menu';
import { buildSceneViewerIntentUrl, isAndroidDevice } from '../utils/device';
import { formatINR, getDefaultVariant } from '../utils/format';
import { DietaryBadge } from './DietaryBadge';
import { ModelViewerStage, type ModelViewerStageHandle } from './ModelViewerStage';

interface DishARModalProps {
  item: MenuItem | null;
  onClose: () => void;
  onAddToTray: (item: MenuItem, variant: PriceVariant, quantity: number) => void;
  onFallbackDesktopQR?: (item: MenuItem) => void;
}

/**
 * Full-Screen Mobile 3D & AR Studio Sheet (for AR dishes)
 * or Sleek Dish Customization Sheet (for standard dishes with variants).
 */
export function DishARModal({
  item,
  onClose,
  onAddToTray,
  onFallbackDesktopQR
}: DishARModalProps) {
  const stageRef = useRef<ModelViewerStageHandle | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<PriceVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [arHintMessage, setArHintMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setSelectedVariant(getDefaultVariant(item));
    setQuantity(1);
    setJustAdded(false);
    setArHintMessage(null);
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const activeVariant = selectedVariant ?? getDefaultVariant(item);
  const totalLinePrice = activeVariant.price * quantity;
  const isAREnabled = Boolean(item.hasAR && item.modelGlb);

  const handleViewOnTable = async () => {
    setArHintMessage(null);
    const launched = await stageRef.current?.activateAR();
    if (!launched && onFallbackDesktopQR) {
      onFallbackDesktopQR(item);
    }
  };

  const handleAdd = () => {
    onAddToTray(item, activeVariant, quantity);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1400);
  };

  return (
    <AnimatePresence>
      <motion.div
        key={item.id}
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        className={`fixed inset-0 z-50 flex flex-col lg:hidden ${
          isAREnabled ? 'bg-[#12100E]' : 'justify-end bg-black/70 backdrop-blur-sm'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={`${item.name} details`}
        onClick={!isAREnabled ? onClose : undefined}
      >
        {/* Top 65% Stage for 3D / AR Hero Dishes */}
        {isAREnabled && (
          <div className="relative h-[62dvh] min-h-[350px] w-full shrink-0">
            <ModelViewerStage
              ref={stageRef}
              item={item}
              onARUnsupported={(reason) =>
                setArHintMessage(
                  reason ??
                    'Open in Safari (iOS) or Chrome (Android) to place this dish at 1:1 scale on your table.'
                )
              }
              onARFailed={(reason) => setArHintMessage(reason)}
            />

            <button
              type="button"
              onClick={onClose}
              aria-label="Close 3D Dish Studio"
              className="absolute right-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#1C1917]/85 text-[#F7F3EC] backdrop-blur-xl transition hover:bg-[#1C1917] active:scale-90"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Bottom Thumb-Zone Sheet */}
        <div
          onClick={(e) => e.stopPropagation()}
          className={`relative z-20 flex flex-col justify-between overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#1C1917]/95 px-5 pb-6 pt-5 backdrop-blur-2xl ${
            isAREnabled ? 'flex-1' : 'max-h-[75dvh]'
          }`}
        >
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <DietaryBadge type={item.diet} size="sm" showLabel />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[#A8A29E]">
                    • {item.category}
                  </span>
                </div>
                <h2 className="mt-1.5 font-serif text-xl font-semibold leading-tight tracking-tight text-[#F7F3EC]">
                  {item.name}
                </h2>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xl font-bold tabular-nums text-[#F7F3EC]">
                  {formatINR(activeVariant.price)}
                </span>
                {!isAREnabled && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close dish sheet"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#A8A29E]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {item.description && (
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#A8A29E]">
                {item.description}
              </p>
            )}

            {/* Variant Chips (Regular / Half / Full / Veg / Chicken) */}
            {item.variants.length > 1 && (
              <div className="mt-3.5">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[#A8A29E]">
                  Choose Option
                </p>
                <div className="flex flex-wrap gap-2">
                  {item.variants.map((variant) => {
                    const active = activeVariant.label === variant.label;
                    return (
                      <button
                        key={variant.label}
                        type="button"
                        onClick={() => setSelectedVariant(variant)}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition active:scale-95 ${
                          active
                            ? 'border-[#D96B27] bg-[#D96B27]/20 text-[#F7F3EC]'
                            : 'border-white/10 bg-[#12100E]/60 text-[#A8A29E] hover:border-white/20'
                        }`}
                      >
                        {variant.label} •{' '}
                        <span className="tabular-nums text-[#F4A26E]">
                          {formatINR(variant.price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {arHintMessage && (
              <p className="mt-2.5 rounded-xl border border-[#D96B27]/30 bg-[#D96B27]/10 px-3 py-1.5 text-[11px] text-[#F4A26E]">
                {arHintMessage}
              </p>
            )}
          </div>

          {/* Dual Primary Action Bar (Thumb-Reachable) */}
          <div className="mt-5 space-y-2.5 pt-1">
            {isAREnabled &&
              (isAndroidDevice() && item.modelGlb ? (
                <a
                  href={buildSceneViewerIntentUrl(`${item.modelGlb}?v=6`, item.name)}
                  onClick={() => setArHintMessage(null)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D96B27] px-4 py-3.5 text-sm font-semibold text-[#F7F3EC] shadow-saffron transition hover:bg-[#E87A35] active:scale-[0.98]"
                >
                  <Box className="h-[18px] w-[18px]" />
                  <span>View on Your Table (AR)</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleViewOnTable}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D96B27] px-4 py-3.5 text-sm font-semibold text-[#F7F3EC] shadow-saffron transition hover:bg-[#E87A35] active:scale-[0.98]"
                >
                  <Box className="h-[18px] w-[18px]" />
                  <span>View on Your Table (AR)</span>
                </button>
              ))}

            <div className="flex items-center gap-2.5">
              <div className="flex min-h-[48px] items-center rounded-2xl border border-white/10 bg-[#12100E] px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[#A8A29E] transition hover:bg-white/5 hover:text-[#F7F3EC] active:scale-90"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-7 text-center text-sm font-semibold tabular-nums text-[#F7F3EC]">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  aria-label="Increase quantity"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[#A8A29E] transition hover:bg-white/5 hover:text-[#F7F3EC] active:scale-90"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAdd}
                className={`flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-[#F7F3EC] transition active:scale-[0.98] ${
                  isAREnabled
                    ? 'border border-white/15 bg-white/5 hover:border-white/25 hover:bg-white/10'
                    : 'bg-[#D96B27] shadow-saffron hover:bg-[#E87A35]'
                }`}
              >
                {justAdded ? (
                  <>
                    <Check className="h-4 w-4 text-[#22C55E]" />
                    <span>Added to Tray</span>
                  </>
                ) : (
                  <span className="tabular-nums">
                    Add to Tray • {formatINR(totalLinePrice)}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
