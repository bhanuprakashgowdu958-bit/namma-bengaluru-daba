import { AnimatePresence, motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowRight, BookOpen, Box, Smartphone, Sparkles, Utensils } from 'lucide-react';
import { RESTAURANT_CONFIG } from '../data/menu';
import { isMobileARCapableDevice } from '../utils/device';

interface MenuCoverOverlayProps {
  isVisible: boolean;
  tableNumber: string;
  arDishCount: number;
  totalDishCount: number;
  onEnterMenu: () => void;
}

/**
 * Mobile-first 3D Menu Book Cover:
 * - On Mobile (99% of guests): Opens immediately as a sleek interactive menu book cover
 *   with a single-tap "Open 3D Menu" hinge reveal.
 * - On Desktop/Laptop: Displays a scannable QR code so guests can open the 3D/AR menu
 *   directly on their phone, plus a secondary button to browse on desktop.
 */
export function MenuCoverOverlay({
  isVisible,
  tableNumber,
  arDishCount,
  totalDishCount,
  onEnterMenu
}: MenuCoverOverlayProps) {
  const isMobile = isMobileARCapableDevice();
  const currentUrl =
    typeof window !== 'undefined' ? window.location.href : 'https://namma-bengaluru-daba.vercel.app/';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            rotateY: -18,
            scale: 0.96,
            transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] }
          }}
          style={{ transformOrigin: 'left center', perspective: 1400 }}
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-y-auto bg-[#070709] px-5 py-8"
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to Namma Bengaluru Daba 3D Menu"
        >
          {/* Warm Tandoor Saffron Ambient Glow */}
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-1/4 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[#D96B27]/20 blur-[130px]" />
            <div className="absolute bottom-0 right-0 h-[20rem] w-[20rem] rounded-full bg-[#F59E0B]/10 blur-[120px]" />
            <div className="noise-grain absolute inset-0 opacity-[0.04]" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="liquid-glass relative z-10 w-full max-w-md overflow-hidden rounded-[32px] border border-white/20 shadow-[0_32px_90px_-16px_rgba(0,0,0,0.95)]"
          >
            {/* Book Spine Accent */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#F4A26E] via-[#D96B27] to-[#7C2D12]"
            />

            {/* Cover Hero Photo Strip */}
            <div className="relative h-48 w-full overflow-hidden sm:h-52">
              <img
                src="/categories/all.jpg"
                alt="Namma Bengaluru Daba Feast"
                className="h-full w-full object-cover object-center"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0E0D10] via-[#0E0D10]/45 to-black/30"
              />

              <div className="absolute left-5 right-5 top-4 flex items-center justify-between gap-2">
                <span className="liquid-glass-pill inline-flex items-center gap-1.5 rounded-full border border-white/25 px-3 py-1 text-[11px] font-semibold text-[#F7F3EC]">
                  <Sparkles className="h-3 w-3 text-[#D96B27]" />
                  Spatial 3D &amp; AR Menu
                </span>
                {tableNumber.trim() && (
                  <span className="liquid-glass-saffron rounded-full border border-white/30 px-3 py-1 text-[11px] font-bold text-[#F7F3EC]">
                    Table #{tableNumber.trim()}
                  </span>
                )}
              </div>

              <div className="absolute inset-x-5 bottom-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#F4A26E]">
                  Authentic North Indian &amp; Tandoor
                </p>
                <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#F7F3EC] sm:text-3xl">
                  {RESTAURANT_CONFIG.brandName}
                </h1>
              </div>
            </div>

            {/* Cover Body: Mobile Direct Launch vs Desktop QR Handoff */}
            <div className="space-y-5 p-6">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-2 py-2.5">
                  <Utensils className="mx-auto h-4 w-4 text-[#D96B27]" />
                  <p className="mt-1 text-xs font-bold tabular-nums text-[#F7F3EC]">
                    {totalDishCount} Dishes
                  </p>
                  <p className="text-[10px] text-[#A8A29E]">Freshly Prepared</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-2 py-2.5">
                  <Box className="mx-auto h-4 w-4 text-[#D96B27]" />
                  <p className="mt-1 text-xs font-bold tabular-nums text-[#F7F3EC]">
                    {arDishCount} in 1:1 AR
                  </p>
                  <p className="text-[10px] text-[#A8A29E]">Place on Table</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-2 py-2.5">
                  <BookOpen className="mx-auto h-4 w-4 text-[#D96B27]" />
                  <p className="mt-1 text-xs font-bold text-[#F7F3EC]">8 Chapters</p>
                  <p className="text-[10px] text-[#A8A29E]">Swipe to Flip</p>
                </div>
              </div>

              {!isMobile ? (
                <div className="rounded-2xl border border-white/12 bg-black/30 p-4 text-center">
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F4A26E]">
                    <Smartphone className="h-3.5 w-3.5" />
                    Scan on Mobile for Live Table AR
                  </p>
                  <div className="mx-auto mt-3 inline-flex rounded-2xl border border-white/15 bg-[#F7F3EC] p-3">
                    <QRCodeSVG
                      value={currentUrl}
                      size={148}
                      bgColor="#F7F3EC"
                      fgColor="#12100E"
                      level="M"
                    />
                  </div>
                  <p className="mt-2.5 text-[11px] text-[#A8A29E]">
                    Point your phone camera here to preview dishes on your physical table.
                  </p>
                </div>
              ) : (
                <p className="text-center text-xs leading-relaxed text-[#A8A29E]">
                  Flip through categories like a physical menu, tap any dish to inspect it, and preview your full order on your table before sending it to the kitchen.
                </p>
              )}

              <button
                type="button"
                onClick={onEnterMenu}
                className="liquid-glass-saffron flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-white/30 px-5 text-sm font-semibold text-[#F7F3EC] transition hover:brightness-110 active:scale-[0.98]"
              >
                <span>{isMobile ? 'Open 3D Menu' : 'Browse Menu on Desktop'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
