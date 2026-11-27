import '@google/model-viewer';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Box,
  Minus,
  Plus,
  RotateCcw,
  Ruler,
  Sparkles,
  Users,
  X
} from 'lucide-react';
import { MENU_ITEMS } from '../data/menu';
import type { CartItem, MenuItem, PriceVariant } from '../types/menu';
import type { ModelViewerElement } from '../types/model-viewer';
import { isMobileARCapableDevice } from '../utils/device';
import { formatINR, getDefaultVariant } from '../utils/format';
import {
  buildTableSpreadModels,
  getSpreadDeepLinkUrl,
  type TableSpreadResult
} from '../utils/tableSpread';

interface TableSpreadModalProps {
  isOpen: boolean;
  items: CartItem[];
  onClose: () => void;
  onProceedToOrder: () => void;
  onUpdateQuantity: (cartKey: string, delta: number) => void;
  onQuickAddPairing: (item: MenuItem, variant: PriceVariant) => void;
  onOpenSpreadQR: (spreadUrl: string, title: string, subtitle: string) => void;
}

type TableToneId = 'charcoal' | 'teak' | 'stone';

const TABLE_TONES: Record<
  TableToneId,
  { label: string; swatch: string; stageBg: string }
> = {
  charcoal: {
    label: 'Dark Slate',
    swatch: '#1E1A17',
    stageBg: 'radial-gradient(circle at 50% 48%, rgba(36,31,27,0.98) 0%, rgba(18,16,14,1) 85%)'
  },
  teak: {
    label: 'Warm Teak',
    swatch: '#5C3A24',
    stageBg: 'radial-gradient(circle at 50% 52%, rgba(74,47,30,0.92) 0%, rgba(28,19,14,1) 86%)'
  },
  stone: {
    label: 'Light Stone',
    swatch: '#B9B0A4',
    stageBg: 'radial-gradient(circle at 50% 52%, rgba(92,86,78,0.88) 0%, rgba(26,23,20,1) 88%)'
  }
};

const DESKTOP_SPREAD_ORBIT = '0deg 38deg 84%';
const MOBILE_SPREAD_ORBIT = '0deg 40deg 106%';

export function TableSpreadModal({
  isOpen,
  items,
  onClose,
  onProceedToOrder,
  onUpdateQuantity,
  onQuickAddPairing,
  onOpenSpreadQR
}: TableSpreadModalProps) {
  const viewerRef = useRef<ModelViewerElement | null>(null);
  const [spread, setSpread] = useState<TableSpreadResult | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [arNotice, setArNotice] = useState<string | null>(null);
  const [tableTone, setTableTone] = useState<TableToneId>('charcoal');
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : true
  );

  useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const activeOrbit = isMobileViewport ? MOBILE_SPREAD_ORBIT : DESKTOP_SPREAD_ORBIT;
  const activeFov = isMobileViewport ? '34deg' : '26deg';

  const totalDishes = items.reduce((sum, entry) => sum + entry.quantity, 0);
  const totalAmount = items.reduce(
    (sum, entry) => sum + entry.variant.price * entry.quantity,
    0
  );

  // Suggest smart pairings if curries are added without breads/rice
  const suggestedPairing = useMemo(() => {
    const hasMain = items.some(
      (e) =>
        e.item.category === 'Veg Main Course' ||
        e.item.category === 'Non-Veg Main Course'
    );
    const hasBreadOrRice = items.some(
      (e) =>
        e.item.category === 'Breads' ||
        e.item.name.toLowerCase().includes('rice') ||
        e.item.name.toLowerCase().includes('biryani')
    );

    if (hasMain && !hasBreadOrRice) {
      return MENU_ITEMS.find((i) => i.id === 'br-1') ?? null;
    }
    const hasRaita = items.some((e) => e.item.id === 'vm-26');
    if (items.length > 0 && !hasRaita && !hasMain) {
      return MENU_ITEMS.find((i) => i.id === 'vm-26') ?? null;
    }
    return null;
  }, [items]);

  useEffect(() => {
    if (isOpen && items.length === 0) {
      onClose();
    }
  }, [isOpen, items.length, onClose]);

  useEffect(() => {
    if (!isOpen || items.length === 0) return;

    let cancelled = false;
    let currentCleanup: (() => void) | undefined;

    setIsBuilding(true);
    setBuildError(null);
    setArNotice(null);

    buildTableSpreadModels(items)
      .then((res) => {
        if (cancelled) {
          res.cleanup();
          return;
        }
        currentCleanup = res.cleanup;
        setSpread(res);
        setIsBuilding(false);
      })
      .catch(() => {
        if (!cancelled) {
          setBuildError('Could not compose the 3D table spread. Please try again.');
          setIsBuilding(false);
        }
      });

    return () => {
      cancelled = true;
      currentCleanup?.();
    };
  }, [isOpen, items]);

  useEffect(() => {
    const el = viewerRef.current;
    if (!el || !spread) return;
    const onArStatus = (event: Event) => {
      const customEvent = event as CustomEvent<{ status?: string }>;
      if (customEvent.detail?.status === 'failed') {
        setArNotice(
          'Table Spread AR session failed to start on this browser. Try tapping any single dish card for Scene Viewer AR, or inspect in 3D above.'
        );
      }
    };
    el.addEventListener('ar-status', onArStatus);
    return () => {
      el.removeEventListener('ar-status', onArStatus);
    };
  }, [spread]);

  if (!isOpen) return null;

  const estimatedGuests =
    totalDishes <= 1
      ? '1 guest'
      : totalDishes <= 3
        ? '1–2 guests'
        : `${Math.ceil(totalDishes / 1.5)} guests`;

  const handleActivateAR = async () => {
    setArNotice(null);

    // On desktop/laptop (>= 1024px or non-mobile browser), hand off via QR code
    if (!isMobileARCapableDevice()) {
      const url = getSpreadDeepLinkUrl(items);
      const widthLabel = spread ? `~${spread.estimatedWidthCm} cm spread` : '1:1 Table Spread';
      onOpenSpreadQR(
        url,
        `Full Table Spread (${totalDishes} ${totalDishes === 1 ? 'Plate' : 'Plates'})`,
        `True 1:1 Scale • ${widthLabel}`
      );
      return;
    }

    const el = viewerRef.current;
    if (el) {
      if (!el.canActivateAR) {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 45));
          if (el.canActivateAR) break;
        }
      }
      if (el.canActivateAR) {
        try {
          await el.activateAR();
          return;
        } catch {
          // Handled below
        }
      }
    }

    setArNotice(
      'Multi-dish table AR uses WebXR (Chrome on Android) or AR Quick Look (Safari on iPhone). You can also tap any single dish card for individual AR.'
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 360, damping: 34 }}
        className="fixed inset-0 z-[60] flex flex-col bg-[#12100E]"
        role="dialog"
        aria-modal="true"
        aria-label="Full Table Spread 3D and AR Preview"
      >
        {/* Top 52% (Mobile) / 58% (Desktop): Combined Multi-Dish 3D & AR Stage */}
        <div
          className="relative flex h-[52dvh] min-h-[310px] w-full shrink-0 flex-col overflow-hidden px-2 pb-16 pt-14 transition-colors duration-500 lg:h-[58dvh] lg:pb-14 lg:pt-12"
          style={{ background: TABLE_TONES[tableTone].stageBg }}
        >
          <div className="pointer-events-none absolute left-3.5 top-4 z-20 flex flex-wrap items-center gap-1.5 pr-14 sm:left-4 sm:gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D96B27]/40 bg-[#1C1917]/85 px-2.5 py-1 text-[11px] font-semibold text-[#F4A26E] backdrop-blur-xl sm:px-3 sm:py-1.5 sm:text-xs">
              <Sparkles className="h-3 w-3 text-[#D96B27] sm:h-3.5 sm:w-3.5" />
              Table Spread
            </span>
            {spread && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#1C1917]/85 px-2.5 py-1 text-[11px] font-medium text-[#F7F3EC] backdrop-blur-xl sm:px-3 sm:py-1.5 sm:text-xs">
                <Ruler className="h-3 w-3 text-[#D96B27] sm:h-3.5 sm:w-3.5" />
                ~{spread.estimatedWidthCm} cm
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Table Spread"
            className="absolute right-3.5 top-3.5 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#1C1917]/85 text-[#F7F3EC] backdrop-blur-xl transition hover:bg-[#1C1917] active:scale-90 sm:right-4 sm:top-4"
          >
            <X className="h-5 w-5" />
          </button>

          {isBuilding ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-[#D96B27]" />
              <p className="text-xs font-medium text-[#A8A29E]">
                Arranging {totalDishes} {totalDishes === 1 ? 'dish' : 'dishes'} on your table at 1:1 scale...
              </p>
            </div>
          ) : buildError ? (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <p className="text-sm text-red-400">{buildError}</p>
            </div>
          ) : spread ? (
            <model-viewer
              key={spread.glbUrl}
              ref={viewerRef}
              src={spread.glbUrl}
              ios-src={spread.usdzUrl}
              alt="Your complete ordered meal spread in 3D"
              ar
              ar-modes="webxr quick-look"
              ar-scale="fixed"
              ar-placement="floor"
              camera-controls
              auto-rotate
              auto-rotate-delay="900"
              rotation-per-second="12deg"
              shadow-intensity="1.2"
              shadow-softness="0.85"
              exposure="1.0"
              environment-image="neutral"
              camera-orbit={activeOrbit}
              field-of-view={activeFov}
              min-camera-orbit="auto 16deg auto"
              max-camera-orbit="auto 78deg auto"
              interaction-prompt="none"
              touch-action="pan-y"
              className="h-full w-full flex-1"
            >
              <span slot="ar-button" className="hidden" aria-hidden="true" />
            </model-viewer>
          ) : null}

          {/* Bottom-Left Reset + Table Tone Swatches */}
          {spread && !isBuilding && (
            <div className="absolute bottom-3 left-3.5 z-20 flex items-center gap-2 sm:bottom-4 sm:left-4">
              <button
                type="button"
                onClick={() => {
                  const el = viewerRef.current;
                  if (!el) return;
                  el.resetTurntableRotation();
                  el.cameraOrbit = activeOrbit;
                  el.jumpCameraToGoal();
                }}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/10 bg-[#1C1917]/85 px-3.5 text-xs font-medium text-[#F7F3EC] backdrop-blur-xl transition hover:border-white/20 active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5 text-[#D96B27]" />
                Reset
              </button>

              <div
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/10 bg-[#1C1917]/85 px-2.5 backdrop-blur-xl"
                title="Adjust table background tone"
              >
                <span className="hidden text-[11px] text-[#A8A29E] sm:inline">Table:</span>
                {(Object.keys(TABLE_TONES) as TableToneId[]).map((toneId) => {
                  const tone = TABLE_TONES[toneId];
                  const active = tableTone === toneId;
                  return (
                    <button
                      key={toneId}
                      type="button"
                      onClick={() => setTableTone(toneId)}
                      aria-label={`Match ${tone.label} table color`}
                      className={`h-6 w-6 rounded-full border transition active:scale-90 ${
                        active
                          ? 'scale-110 border-[#D96B27] ring-2 ring-[#D96B27]/40'
                          : 'border-white/25 opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: tone.swatch }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom 42%: Live Spread Chips with Dish Thumbnails, Pairing & Dual Actions */}
        <div className="flex flex-1 flex-col justify-between overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#1C1917]/95 px-5 pb-6 pt-4 backdrop-blur-2xl">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-semibold text-[#F7F3EC]">
                  Table Spread ({totalDishes} {totalDishes === 1 ? 'Plate' : 'Plates'})
                </h2>
                <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-[#A8A29E]">
                  <Users className="h-3.5 w-3.5 text-[#D96B27]" />
                  Ideal for {estimatedGuests} • Drag to inspect full spread
                </p>
              </div>
              <span className="text-xl font-bold tabular-nums text-[#F7F3EC]">
                {formatINR(totalAmount)}
              </span>
            </div>

            {/* Live Tray Dish Chips with Studio Thumbnails */}
            <div className="no-scrollbar mt-3 flex items-center gap-2.5 overflow-x-auto pb-1">
              {items.map((entry) => (
                <div
                  key={entry.cartKey}
                  className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-white/10 bg-[#12100E]/85 p-2 pr-2.5"
                >
                  {entry.item.poster && (
                    <img
                      src={entry.item.poster}
                      alt={entry.item.name}
                      className="h-10 w-10 shrink-0 rounded-xl border border-white/10 object-cover"
                    />
                  )}
                  <div className="max-w-[135px]">
                    <p className="truncate text-xs font-medium text-[#F7F3EC]">
                      {entry.item.name}
                    </p>
                    <p className="text-[10px] tabular-nums text-[#A8A29E]">
                      {entry.variant.label} • {formatINR(entry.variant.price)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(entry.cartKey, -1)}
                      aria-label={`Remove one ${entry.item.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#A8A29E] hover:text-[#F7F3EC]"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-4 text-center text-xs font-semibold tabular-nums text-[#F7F3EC]">
                      {entry.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(entry.cartKey, 1)}
                      aria-label={`Add one ${entry.item.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#A8A29E] hover:text-[#F7F3EC]"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {suggestedPairing && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-[#D96B27]/30 bg-[#D96B27]/10 px-3.5 py-2">
                <span className="text-xs text-[#F7F3EC]">
                  Complete your spread with{' '}
                  <strong className="font-semibold text-[#F4A26E]">
                    {suggestedPairing.name}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onQuickAddPairing(suggestedPairing, getDefaultVariant(suggestedPairing))
                  }
                  className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-full bg-[#D96B27] px-3 text-xs font-semibold text-[#F7F3EC] transition hover:bg-[#E87A35] active:scale-95"
                >
                  <Plus className="h-3 w-3" />
                  {formatINR(getDefaultVariant(suggestedPairing).price)}
                </button>
              </div>
            )}

            {arNotice && (
              <p className="mt-2.5 rounded-xl border border-[#D96B27]/30 bg-[#D96B27]/10 px-3 py-1.5 text-[11px] text-[#F4A26E]">
                {arNotice}
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={handleActivateAR}
              disabled={!spread || isBuilding}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#D96B27] px-4 text-sm font-semibold text-[#F7F3EC] shadow-saffron transition hover:bg-[#E87A35] active:scale-[0.98] disabled:opacity-50"
            >
              <Box className="h-[18px] w-[18px]" />
              Place Full Spread on Table (AR)
            </button>

            <button
              type="button"
              onClick={onProceedToOrder}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-[#F7F3EC] transition hover:border-white/25 hover:bg-white/10 active:scale-[0.98]"
            >
              <span>Proceed to Order</span>
              <ArrowRight className="h-4 w-4 text-[#F4A26E]" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
