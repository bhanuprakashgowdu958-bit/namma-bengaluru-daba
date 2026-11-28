import '@google/model-viewer';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Box,
  Minus,
  Plus,
  Ruler,
  Sparkles,
  Users,
  Utensils,
  X
} from 'lucide-react';
import { MENU_ITEMS } from '../data/menu';
import type { CartItem, MenuItem, PriceVariant } from '../types/menu';
import type { ModelViewerElement } from '../types/model-viewer';
import {
  buildOpenInChromeIntentUrl,
  buildSceneViewerIntentUrl,
  checkWebXRSupported,
  isAndroidDevice,
  isInAppWebView,
  isMobileARCapableDevice,
  isSceneViewerCandidate
} from '../utils/device';
import { formatINR, getDefaultVariant } from '../utils/format';
import {
  buildTableSpreadModels,
  getSpreadApiGlbPath,
  getSpreadDeepLinkUrl,
  type TableSpreadResult
} from '../utils/tableSpread';
import { startAnchoredTableAR } from '../utils/webxrTableAR';

interface TableSpreadModalProps {
  isOpen: boolean;
  items: CartItem[];
  onClose: () => void;
  onProceedToOrder: () => void;
  onUpdateQuantity: (cartKey: string, delta: number) => void;
  onQuickAddPairing: (item: MenuItem, variant: PriceVariant) => void;
  onOpenSpreadQR: (spreadUrl: string, title: string, subtitle: string) => void;
}

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
  const [sceneViewerFailed, setSceneViewerFailed] = useState(false);
  const [canUseWebXR, setCanUseWebXR] = useState(false);
  const [isPresentingAR, setIsPresentingAR] = useState(false);
  const [viewMode, setViewMode] = useState<'photos' | '3d'>('photos');

  const totalDishes = items.reduce((sum, entry) => sum + entry.quantity, 0);
  const totalAmount = items.reduce(
    (sum, entry) => sum + entry.variant.price * entry.quantity,
    0
  );

  // Respect exact cart dishes cleanly on the white table (up to 8 plates visually)
  const displayPlates = useMemo(() => {
    const plates: Array<{ key: string; entry: CartItem }> = [];
    for (const entry of items) {
      if (plates.length >= 8) break;
      if (totalDishes <= 8) {
        for (let i = 0; i < entry.quantity; i++) {
          plates.push({ key: `${entry.cartKey}-${i}`, entry });
        }
      } else {
        plates.push({ key: entry.cartKey, entry });
      }
    }
    return plates.slice(0, 8);
  }, [items, totalDishes]);

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
    setSceneViewerFailed(false);
    setCanUseWebXR(false);

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
    if (!isOpen) return;

    let active = true;
    checkWebXRSupported().then((supported) => {
      if (active) setCanUseWebXR(supported);
    });

    const handleFallbackHash = (event?: HashChangeEvent) => {
      const hashFromUrl = event?.newURL ? new URL(event.newURL).hash : window.location.hash;
      if (
        hashFromUrl === '#ar-fallback' ||
        hashFromUrl === '#model-viewer-no-ar-fallback' ||
        window.location.hash === '#ar-fallback' ||
        window.location.hash === '#model-viewer-no-ar-fallback'
      ) {
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search
        );
        setSceneViewerFailed(true);
        setArNotice(
          'Google Scene Viewer could not launch on this device (Google Play Services for AR is required). You can inspect the 3D Table above instead.'
        );
      }
    };

    handleFallbackHash();
    window.addEventListener('hashchange', handleFallbackHash);
    return () => {
      active = false;
      window.removeEventListener('hashchange', handleFallbackHash);
    };
  }, [isOpen]);

  useEffect(() => {
    const el = viewerRef.current;
    if (!el || !spread) return;

    const updateReadiness = () => {
      if (el.canActivateAR) {
        setCanUseWebXR(true);
      }
    };

    const onArStatus = (event: Event) => {
      updateReadiness();
      const customEvent = event as CustomEvent<{ status?: string }>;
      const status = customEvent.detail?.status;
      setIsPresentingAR(status === 'session-started');
      if (status === 'failed') {
        setArNotice(
          'Table Spread AR session could not start on this browser. Try Google Scene Viewer or inspect the 3D Table above.'
        );
      }
    };

    updateReadiness();
    el.addEventListener('load', updateReadiness);
    el.addEventListener('ar-status', onArStatus);
    return () => {
      el.removeEventListener('load', updateReadiness);
      el.removeEventListener('ar-status', onArStatus);
    };
  }, [spread]);

  const isAndroid = isAndroidDevice();
  const isInWebView = isAndroid && isInAppWebView();
  const isAndroidSceneViewerEligible = isSceneViewerCandidate();

  const androidSceneViewerUrl = useMemo(() => {
    if (!isOpen || !isAndroid || items.length === 0) return null;
    if (totalDishes === 1) {
      const singlePath = items[0]?.item.modelGlb
        ? `${items[0].item.modelGlb}?v=10`
        : '/models/dal-tadka.glb?v=10';
      return buildSceneViewerIntentUrl(singlePath, items[0].item.name);
    }
    const spreadTitle = `Table Spread (${totalDishes} Plates)`;
    return buildSceneViewerIntentUrl(getSpreadApiGlbPath(items), spreadTitle);
  }, [isOpen, isAndroid, items, totalDishes]);

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

    if (isAndroid && canUseWebXR && spread?.arGlbUrl) {
      try {
        await startAnchoredTableAR({
          glbUrl: spread.arGlbUrl,
          title: `Table Spread (${totalDishes} ${totalDishes === 1 ? 'Plate' : 'Plates'})`,
          onError: (msg) => setArNotice(msg)
        });
        return;
      } catch {
        // Fall back to model-viewer AR below
      }
    }

    const el = viewerRef.current;
    if (el && el.canActivateAR) {
      try {
        await el.activateAR();
        return;
      } catch {
        // Handled below
      }
    }

    setArNotice(
      'Table AR requires Safari on iPhone or Chrome with Google Play Services for AR on Android. You can preview the interactive 3D Table above.'
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 360, damping: 34 }}
        className="fixed inset-0 z-[60] flex flex-col bg-[#070709] lg:flex-row"
        role="dialog"
        aria-modal="true"
        aria-label="Full Table Spread 3D and AR Preview"
      >
        {/* Top 56% (Mobile) / Left 62% Full-Height (Desktop): Zero-Gap Full-Bleed Dish Presentation */}
        <div className="relative flex h-[56dvh] min-h-[320px] w-full shrink-0 flex-col overflow-hidden bg-[#070709] lg:h-full lg:w-[62%]">
          <div className="pointer-events-none absolute left-3.5 top-4 z-20 flex flex-wrap items-center gap-1.5 pr-14 sm:left-4 sm:gap-2">
            <div className="pointer-events-auto inline-flex items-center rounded-full border border-white/20 bg-black/55 p-0.5 backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setViewMode('photos')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  viewMode === 'photos'
                    ? 'bg-[#D96B27] text-[#F7F3EC]'
                    : 'text-[#D6D0C8] hover:text-[#F7F3EC]'
                }`}
              >
                Photos
              </button>
              <button
                type="button"
                onClick={() => setViewMode('3d')}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  viewMode === '3d'
                    ? 'bg-[#D96B27] text-[#F7F3EC]'
                    : 'text-[#D6D0C8] hover:text-[#F7F3EC]'
                }`}
              >
                <Sparkles className="h-3 w-3" />
                3D Table
              </button>
            </div>
            {spread && (
              <span className="liquid-glass-pill inline-flex items-center gap-1 rounded-full border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-[#F7F3EC] sm:px-3 sm:py-1.5 sm:text-xs">
                <Ruler className="h-3 w-3 text-[#D96B27] sm:h-3.5 sm:w-3.5" />
                ~{spread.estimatedWidthCm} cm
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Table Spread"
            className="liquid-glass-pill absolute right-3.5 top-3.5 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-[#F7F3EC] transition hover:brightness-110 active:scale-90 sm:right-4 sm:top-4"
          >
            <X className="h-5 w-5" />
          </button>

          {buildError ? (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <p className="text-sm text-red-400">{buildError}</p>
            </div>
          ) : viewMode === '3d' ? (
            <div className="relative h-full w-full studio-spotlight">
              {spread?.glbUrl ? (
                <>
                  <model-viewer
                    key={spread.glbUrl}
                    src={spread.glbUrl}
                    alt="Interactive 3D Table Spread"
                    camera-controls
                    auto-rotate
                    auto-rotate-delay="600"
                    shadow-intensity="1.1"
                    shadow-softness="0.85"
                    exposure="1.05"
                    environment-image="neutral"
                    camera-orbit="0deg 46deg 88%"
                    field-of-view="26deg"
                    touch-action="pan-y"
                    className="h-full w-full"
                  />
                  <span className="liquid-glass-pill pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/20 px-3 py-1 text-[11px] font-medium text-[#F7F3EC]">
                    Drag to rotate • Pinch to zoom 3D Table
                  </span>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-[#A8A29E]">
                  <Box className="h-6 w-6 animate-pulse text-[#D96B27]" />
                  <span>Arranging plates on 3D table...</span>
                </div>
              )}
            </div>
          ) : displayPlates.length === 1 ? (
            /* Single Dish Full-Bleed Edge-to-Edge Studio Photograph (zero white gaps) */
            <div className="relative h-full w-full">
              {displayPlates[0].entry.item.poster ? (
                <img
                  src={displayPlates[0].entry.item.poster}
                  alt={displayPlates[0].entry.item.name}
                  className="h-full w-full object-cover object-center"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#F7F3EC]">
                  <Utensils className="h-10 w-10 text-[#D96B27]" />
                  <span className="font-serif text-lg">{displayPlates[0].entry.item.name}</span>
                </div>
              )}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60"
              />
              <div className="pointer-events-none absolute bottom-4 left-4 z-20 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/55 px-4 py-1.5 text-xs font-semibold text-[#F7F3EC] backdrop-blur-xl">
                <span>{displayPlates[0].entry.item.name}</span>
                <span className="text-[#A8A29E]">•</span>
                <span className="tabular-nums text-[#F4A26E]">
                  {formatINR(displayPlates[0].entry.variant.price)}
                </span>
              </div>
            </div>
          ) : (
            /* Multi-Dish Full-Bleed Spread Grid (zero white gaps) */
            <div
              className={`grid h-full w-full gap-1 bg-[#070709] ${
                displayPlates.length <= 2
                  ? 'grid-cols-2'
                  : displayPlates.length <= 4
                    ? 'grid-cols-2 grid-rows-2'
                    : displayPlates.length <= 6
                      ? 'grid-cols-3 grid-rows-2'
                      : 'grid-cols-4 grid-rows-2'
              }`}
            >
              {displayPlates.map(({ key, entry }) => (
                <div key={key} className="relative h-full w-full overflow-hidden bg-[#101013]">
                  {entry.item.poster ? (
                    <img
                      src={entry.item.poster}
                      alt={entry.item.name}
                      className="h-full w-full object-cover object-center"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#D96B27]">
                      <Utensils className="h-6 w-6" />
                    </div>
                  )}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent"
                  />
                  <span className="liquid-glass-pill pointer-events-none absolute bottom-2 left-2 max-w-[88%] truncate rounded-full border border-white/20 px-2.5 py-0.5 text-[10px] font-semibold text-[#F7F3EC]">
                    {entry.item.name}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Full-size AR Engine so WebXR DOMOverlay is never clipped */}
          {spread && (
            <div
              className={`absolute inset-0 overflow-hidden transition-opacity ${
                isPresentingAR ? 'pointer-events-auto z-30 opacity-100' : 'pointer-events-none z-0 opacity-0'
              }`}
              aria-hidden={!isPresentingAR}
            >
              <model-viewer
                key={spread.arGlbUrl}
                ref={viewerRef}
                src={spread.arGlbUrl}
                ios-src={spread.usdzUrl}
                alt="AR Table Spread Engine"
                loading="eager"
                ar
                ar-modes="webxr scene-viewer quick-look"
                ar-scale="fixed"
                ar-placement="floor"
                shadow-intensity="1.2"
                shadow-softness="0.85"
                environment-image="neutral"
                className="h-full w-full"
              >
                <span slot="ar-button" className="hidden" />
              </model-viewer>
            </div>
          )}
        </div>

        {/* Bottom Sheet (Mobile) / Right Side Editorial Glass Panel (Desktop) */}
        <div className="liquid-glass-sheet flex flex-1 flex-col justify-between overflow-y-auto rounded-t-3xl border-t border-white/15 px-5 pb-6 pt-5 lg:h-full lg:w-[38%] lg:rounded-none lg:border-l lg:border-t-0 lg:px-7 lg:py-8">
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
            <div className="no-scrollbar mt-3 flex items-center gap-2.5 overflow-x-auto pb-1 lg:mt-5 lg:flex-col lg:items-stretch lg:gap-2.5 lg:overflow-visible">
              {items.map((entry) => (
                <div
                  key={entry.cartKey}
                  className="liquid-glass-card flex shrink-0 items-center justify-between gap-2.5 rounded-2xl border border-white/15 p-2 pr-2.5 lg:p-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {entry.item.poster && (
                      <img
                        src={entry.item.poster}
                        alt={entry.item.name}
                        className="h-10 w-10 shrink-0 rounded-xl border border-white/10 object-cover lg:h-12 lg:w-12"
                      />
                    )}
                    <div className="max-w-[135px] lg:max-w-none">
                      <p className="truncate text-xs font-medium text-[#F7F3EC] lg:text-sm">
                        {entry.item.name}
                      </p>
                      <p className="text-[10px] tabular-nums text-[#A8A29E] lg:text-xs">
                        {entry.variant.label} • {formatINR(entry.variant.price)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
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
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            {arNotice && (
              <p className="rounded-xl border border-[#D96B27]/35 bg-[#D96B27]/12 px-3 py-2 text-[11px] leading-relaxed text-[#F4A26E]">
                {arNotice}
              </p>
            )}

            <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col">
              {isInWebView ? (
                <a
                  href={buildOpenInChromeIntentUrl()}
                  className="liquid-glass-saffron flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border border-white/25 px-4 text-sm font-semibold text-[#F7F3EC] transition hover:brightness-110 active:scale-[0.98]"
                >
                  <Box className="h-[18px] w-[18px]" />
                  Open in Chrome for Table AR
                </a>
              ) : isAndroid && !canUseWebXR && isAndroidSceneViewerEligible && androidSceneViewerUrl ? (
                <a
                  href={androidSceneViewerUrl}
                  onClick={() => {
                    setArNotice(null);
                    setSceneViewerFailed(false);
                  }}
                  className="liquid-glass-saffron flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border border-white/25 px-4 text-sm font-semibold text-[#F7F3EC] transition hover:brightness-110 active:scale-[0.98]"
                >
                  <Box className="h-[18px] w-[18px]" />
                  Place Full Spread on Table (AR)
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleActivateAR}
                  disabled={isMobileARCapableDevice() && (!spread || isBuilding)}
                  className="liquid-glass-saffron flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border border-white/25 px-4 text-sm font-semibold text-[#F7F3EC] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                >
                  <Box className="h-[18px] w-[18px]" />
                  Place Full Spread on Table (AR)
                </button>
              )}

              {isAndroid && arNotice && canUseWebXR && isAndroidSceneViewerEligible && androidSceneViewerUrl && (
                <a
                  href={androidSceneViewerUrl}
                  onClick={() => {
                    setArNotice(null);
                    setSceneViewerFailed(false);
                  }}
                  className="liquid-glass-pill flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl border border-[#D96B27]/50 px-4 text-xs font-semibold text-[#F4A26E] transition hover:brightness-110 active:scale-[0.98]"
                >
                  <Box className="h-4 w-4" />
                  Try Google Scene Viewer (AR)
                </a>
              )}

              {isAndroid && sceneViewerFailed && viewMode !== '3d' && (
                <button
                  type="button"
                  onClick={() => setViewMode('3d')}
                  className="liquid-glass-pill flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl border border-[#D96B27]/50 px-4 text-xs font-semibold text-[#F4A26E] transition hover:brightness-110 active:scale-[0.98]"
                >
                  <Sparkles className="h-4 w-4" />
                  Inspect 3D Table Preview
                </button>
              )}

              <button
                type="button"
                onClick={onProceedToOrder}
                className="liquid-glass-pill flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 text-sm font-semibold text-[#F7F3EC] transition hover:border-white/25 hover:brightness-110 active:scale-[0.98]"
              >
                <span>Proceed to Order</span>
                <ArrowRight className="h-4 w-4 text-[#F4A26E]" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
