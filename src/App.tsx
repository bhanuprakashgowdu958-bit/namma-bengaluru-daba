import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Box, Check, ChevronLeft, ChevronRight, Minus, Plus, Ruler, Sparkles } from 'lucide-react';
import { DesktopQRModal } from './components/DesktopQRModal';
import { DietaryBadge } from './components/DietaryBadge';
import { DishARModal } from './components/DishARModal';
import type { CategoryFilter } from './components/HeaderFilters';
import { MenuCatalog } from './components/MenuCatalog';
import { MenuCoverOverlay } from './components/MenuCoverOverlay';
import { ModelViewerStage } from './components/ModelViewerStage';
import { TableSpreadModal } from './components/TableSpreadModal';
import { TableTrayDrawer } from './components/TableTrayDrawer';
import { MENU_ITEMS } from './data/menu';
import type { CartItem, MenuItem, PriceVariant } from './types/menu';
import { buildCartKey, formatINR, getDefaultVariant } from './utils/format';

const DEFAULT_HERO_ITEM =
  MENU_ITEMS.find((item) => item.hasAR) ?? MENU_ITEMS[0];

export default function App() {
  const [vegOnly, setVegOnly] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Mobile AR modal item vs Desktop split-screen sticky AR dish
  const [mobileModalItem, setMobileModalItem] = useState<MenuItem | null>(null);
  const [desktopActiveItem, setDesktopActiveItem] =
    useState<MenuItem>(DEFAULT_HERO_ITEM);
  const [desktopVariant, setDesktopVariant] = useState<PriceVariant>(() =>
    getDefaultVariant(DEFAULT_HERO_ITEM)
  );
  const [desktopQty, setDesktopQty] = useState(1);
  const [desktopJustAdded, setDesktopJustAdded] = useState(false);

  // Desktop QR handoff modal (single dish or full spread)
  const [qrModalItem, setQrModalItem] = useState<MenuItem | null>(null);
  const [spreadQrPayload, setSpreadQrPayload] = useState<{
    url: string;
    title: string;
    subtitle: string;
  } | null>(null);

  // Table Tray & Full Spread state
  const [trayItems, setTrayItems] = useState<CartItem[]>([]);
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const [isSpreadOpen, setIsSpreadOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktopViewport(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);
  const [showMenuCover, setShowMenuCover] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('dish') || params.get('spread')) return false;
    try {
      return window.sessionStorage.getItem('nb_menu_opened') !== '1';
    } catch {
      return true;
    }
  });

  // Deep-link ?table=<num>, ?dish=<id>, and ?spread=<id:variant:qty,...> support
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const tableParam = params.get('table');
    if (tableParam) {
      setTableNumber(tableParam.trim());
    }

    const spreadParam = params.get('spread');
    if (spreadParam) {
      const parsed: CartItem[] = [];
      for (const token of spreadParam.split(',')) {
        const [id, variantLabel, qtyStr] = token.split(':');
        const matched = MENU_ITEMS.find((d) => d.id === id);
        if (!matched) continue;
        const variant =
          matched.variants.find((v) => v.label === variantLabel) ??
          getDefaultVariant(matched);
        const qty = Math.max(1, Number.parseInt(qtyStr || '1', 10) || 1);
        parsed.push({
          cartKey: buildCartKey(matched.id, variant.label),
          item: matched,
          variant,
          quantity: qty
        });
      }
      if (parsed.length > 0) {
        setTrayItems(parsed);
        setIsSpreadOpen(true);
        return;
      }
    }

    const dishId = params.get('dish');
    if (!dishId) return;

    const matched = MENU_ITEMS.find((d) => d.id === dishId);
    if (!matched) return;

    if (matched.hasAR) {
      setDesktopActiveItem(matched);
      setDesktopVariant(getDefaultVariant(matched));
    }

    if (window.innerWidth < 1024) {
      setMobileModalItem(matched);
    }
  }, []);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return MENU_ITEMS.filter((item) => {
      if (vegOnly && item.diet !== 'veg') return false;
      if (activeCategory !== 'All' && item.category !== activeCategory) return false;

      if (query) {
        const haystack =
          `${item.name} ${item.category} ${item.description ?? ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [vegOnly, activeCategory, searchQuery]);

  // Add item variant to Table Tray with subtle mobile tactile pulse
  const addToTray = (item: MenuItem, variant: PriceVariant, quantity = 1) => {
    const cartKey = buildCartKey(item.id, variant.label);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(12);
    }

    setTrayItems((prev) => {
      const existing = prev.find((entry) => entry.cartKey === cartKey);
      if (existing) {
        return prev.map((entry) =>
          entry.cartKey === cartKey
            ? { ...entry, quantity: entry.quantity + quantity }
            : entry
        );
      }
      return [
        ...prev,
        {
          cartKey,
          item,
          variant,
          quantity
        }
      ];
    });
  };

  const handleDecrementVariant = (item: MenuItem, variant: PriceVariant) => {
    const cartKey = buildCartKey(item.id, variant.label);
    setTrayItems((prev) =>
      prev
        .map((entry) =>
          entry.cartKey === cartKey
            ? { ...entry, quantity: entry.quantity - 1 }
            : entry
        )
        .filter((entry) => entry.quantity > 0)
    );
  };

  const getVariantQuantity = (
    itemId: string,
    variantLabel: PriceVariant['label']
  ): number => {
    const cartKey = buildCartKey(itemId, variantLabel);
    return trayItems.find((entry) => entry.cartKey === cartKey)?.quantity ?? 0;
  };

  const handleUpdateTrayQty = (cartKey: string, delta: number) => {
    setTrayItems((prev) =>
      prev
        .map((entry) =>
          entry.cartKey === cartKey
            ? { ...entry, quantity: entry.quantity + delta }
            : entry
        )
        .filter((entry) => entry.quantity > 0)
    );
  };

  const handleInspectAR = (item: MenuItem) => {
    if (item.hasAR) {
      setDesktopActiveItem(item);
      setDesktopVariant(getDefaultVariant(item));
      setDesktopQty(1);
      setDesktopJustAdded(false);
    }

    if (window.innerWidth < 1024) {
      setMobileModalItem(item);
    }
  };

  const handleDesktopAdd = () => {
    addToTray(desktopActiveItem, desktopVariant, desktopQty);
    setDesktopJustAdded(true);
    window.setTimeout(() => setDesktopJustAdded(false), 1400);
  };

  const featuredArItems = useMemo(
    () => MENU_ITEMS.filter((entry) => entry.hasAR && entry.poster),
    []
  );

  const cycleDesktopDish = (direction: -1 | 1) => {
    if (featuredArItems.length === 0) return;
    const currentIndex = featuredArItems.findIndex((d) => d.id === desktopActiveItem.id);
    const baseIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (baseIndex + direction + featuredArItems.length) % featuredArItems.length;
    const next = featuredArItems[nextIndex];
    setDesktopActiveItem(next);
    setDesktopVariant(getDefaultVariant(next));
    setDesktopQty(1);
    setDesktopJustAdded(false);
  };

  const handleEnterMenu = () => {
    setShowMenuCover(false);
    try {
      window.sessionStorage.setItem('nb_menu_opened', '1');
    } catch {
      // Ignore storage errors in private mode
    }
  };

  const handleOpenMenuQR = () => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('dish');
    url.searchParams.delete('spread');
    if (tableNumber.trim()) {
      url.searchParams.set('table', tableNumber.trim());
    }
    setSpreadQrPayload({
      url: url.toString(),
      title: 'Namma Bengaluru Daba 3D Menu',
      subtitle: tableNumber.trim()
        ? `Table #${tableNumber.trim()} • Scan for 3D & AR`
        : 'Scan on Mobile for 3D & AR'
    });
  };

  const isAnyOverlayOpen =
    showMenuCover ||
    Boolean(mobileModalItem) ||
    isTrayOpen ||
    isSpreadOpen ||
    Boolean(qrModalItem || spreadQrPayload);

  useEffect(() => {
    if (!isAnyOverlayOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isAnyOverlayOpen]);

  return (
    <div className="relative min-h-screen bg-[#070709] text-[#F7F3EC]">
      <MenuCoverOverlay
        isVisible={showMenuCover}
        tableNumber={tableNumber}
        arDishCount={featuredArItems.length}
        totalDishCount={MENU_ITEMS.length}
        onEnterMenu={handleEnterMenu}
      />
      {/* Pure OLED Obsidian + Warm Amber Spatial Refraction Glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-[#D96B27]/16 blur-[130px]" />
        <div className="absolute left-[-10%] top-[34%] h-[30rem] w-[30rem] rounded-full bg-[#F59E0B]/10 blur-[145px]" />
        <div className="absolute -bottom-28 right-[18%] h-[26rem] w-[26rem] rounded-full bg-[#D96B27]/12 blur-[130px]" />
        <div className="noise-grain absolute inset-0 opacity-[0.035]" />
      </div>

      {/* Responsive Shell: Mobile single column | Desktop >=1024px Editorial 55/45 Split-Screen */}
      <div className="relative z-10 mx-auto flex max-w-[1600px] flex-col lg:flex-row">
        {/* LEFT (55% on Desktop >=1024px): Only mounted on desktop so mobile #ar-fallback isn't intercepted */}
        {isDesktopViewport && (
          <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[55%] lg:flex-col lg:justify-between lg:border-r lg:border-white/10 lg:bg-transparent lg:p-6">
          {/* Detached Top Gallery Frame + Floating Dish Switcher */}
          <div className="relative flex flex-1 flex-col overflow-hidden rounded-[32px] border border-white/15 bg-[#0A0A0D] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.92)]">
            <ModelViewerStage
              item={desktopActiveItem}
              onARUnsupported={() => setQrModalItem(desktopActiveItem)}
            />

            {/* Top-Right Quick Dish Carousel Switcher */}
            <div className="absolute right-4 top-4 z-20 flex items-center gap-1.5">
              <span className="liquid-glass-pill hidden items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-medium text-[#F7F3EC]/85 xl:inline-flex">
                <Sparkles className="h-3 w-3 text-[#D96B27]" />
                Chef&apos;s Studio
              </span>
              <button
                type="button"
                onClick={() => cycleDesktopDish(-1)}
                aria-label="Previous dish"
                className="liquid-glass-pill flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-[#F7F3EC] transition hover:border-white/30 active:scale-90"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => cycleDesktopDish(1)}
                aria-label="Next dish"
                className="liquid-glass-pill flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-[#F7F3EC] transition hover:border-white/30 active:scale-90"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Floating Liquid Glass Spec & Order Deck */}
          <div className="liquid-glass mt-4 rounded-[28px] border border-white/15 px-7 py-5 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={desktopActiveItem.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <DietaryBadge type={desktopActiveItem.diet} size="md" showLabel />
                      <span className="text-xs text-[#A8A29E]">•</span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#A8A29E]">
                        {desktopActiveItem.category}
                      </span>
                      {desktopActiveItem.realWorldDimensions && (
                        <>
                          <span className="text-xs text-[#A8A29E]">•</span>
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#A8A29E]">
                            <Ruler className="h-3.5 w-3.5 text-[#D96B27]" />
                            {desktopActiveItem.realWorldDimensions}
                          </span>
                        </>
                      )}
                    </div>

                    <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-[#F7F3EC] xl:text-3xl">
                      {desktopActiveItem.name}
                    </h2>
                    {desktopActiveItem.description && (
                      <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[#A8A29E] xl:text-sm">
                        {desktopActiveItem.description}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="text-2xl font-bold tabular-nums text-[#F7F3EC]">
                      {formatINR(desktopVariant.price)}
                    </span>
                    <p className="mt-0.5 text-xs text-[#A8A29E]">
                      {desktopVariant.label}
                    </p>
                  </div>
                </div>

                {desktopActiveItem.variants.length > 1 && (
                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-[#A8A29E]">Portion / Variant:</span>
                    {desktopActiveItem.variants.map((variant) => {
                      const active = desktopVariant.label === variant.label;
                      return (
                        <button
                          key={variant.label}
                          type="button"
                          onClick={() => setDesktopVariant(variant)}
                          className={`min-h-[38px] rounded-full border px-3.5 text-xs font-medium transition ${
                            active
                              ? 'border-[#D96B27] bg-[#D96B27]/20 text-[#F7F3EC]'
                              : 'liquid-glass-pill border-white/15 text-[#A8A29E] hover:border-white/25 hover:text-[#F7F3EC]'
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
                )}
              </motion.div>
            </AnimatePresence>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQrModalItem(desktopActiveItem)}
                className="liquid-glass-saffron inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border border-white/25 px-5 text-sm font-semibold text-[#F7F3EC] transition hover:brightness-110 active:scale-[0.99]"
              >
                <Box className="h-[18px] w-[18px]" />
                View on Your Table (AR)
              </button>

              <div className="liquid-glass-pill flex min-h-[48px] items-center rounded-2xl border border-white/15 px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => setDesktopQty((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[#A8A29E] hover:bg-white/5 hover:text-[#F7F3EC]"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-sm font-semibold tabular-nums text-[#F7F3EC]">
                  {desktopQty}
                </span>
                <button
                  type="button"
                  onClick={() => setDesktopQty((q) => q + 1)}
                  aria-label="Increase quantity"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[#A8A29E] hover:bg-white/5 hover:text-[#F7F3EC]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleDesktopAdd}
                className="liquid-glass-pill inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 px-5 text-sm font-semibold text-[#F7F3EC] transition hover:border-white/25 hover:brightness-110 active:scale-[0.99]"
              >
                {desktopJustAdded ? (
                  <>
                    <Check className="h-4 w-4 text-[#22C55E]" />
                    Added to Tray
                  </>
                ) : (
                  <span className="tabular-nums">
                    Add to Tray • {formatINR(desktopVariant.price * desktopQty)}
                  </span>
                )}
              </button>
            </div>
          </div>
        </aside>
        )}

        {/* RIGHT (45% on Desktop, 100% on Mobile): Menu Catalog */}
        <main className="mx-auto w-full max-w-lg overflow-x-clip lg:mx-0 lg:w-[45%] lg:max-w-none">
          <MenuCatalog
            items={filteredItems}
            selectedItemId={desktopActiveItem.id}
            vegOnly={vegOnly}
            onToggleVegOnly={() => setVegOnly((v) => !v)}
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            tableNumber={tableNumber}
            onOpenMenuQR={handleOpenMenuQR}
            onInspectAR={handleInspectAR}
            onAddVariant={(item, variant) => addToTray(item, variant, 1)}
            onDecrementVariant={handleDecrementVariant}
            getVariantQuantity={getVariantQuantity}
          />
        </main>
      </div>

      {/* Mobile Full-Screen 3D & AR Studio Sheet */}
      <DishARModal
        item={mobileModalItem}
        onClose={() => setMobileModalItem(null)}
        onAddToTray={addToTray}
        onFallbackDesktopQR={(fallbackItem) => setQrModalItem(fallbackItem)}
      />

      {/* Floating Table Tray Bar & Order Handoff Drawer */}
      <TableTrayDrawer
        items={trayItems}
        isOpen={isTrayOpen}
        tableNumber={tableNumber}
        onTableNumberChange={setTableNumber}
        onOpen={() => setIsTrayOpen(true)}
        onClose={() => setIsTrayOpen(false)}
        onUpdateQuantity={handleUpdateTrayQty}
        onClearTray={() => setTrayItems([])}
        onOpenTableSpread={() => {
          setIsTrayOpen(false);
          setIsSpreadOpen(true);
        }}
      />

      {/* Full Cart Multi-Dish 3D & AR Table Spread Modal */}
      <TableSpreadModal
        isOpen={isSpreadOpen}
        items={trayItems}
        onClose={() => setIsSpreadOpen(false)}
        onProceedToOrder={() => {
          setIsSpreadOpen(false);
          setIsTrayOpen(true);
        }}
        onUpdateQuantity={handleUpdateTrayQty}
        onQuickAddPairing={(item, variant) => addToTray(item, variant, 1)}
        onOpenSpreadQR={(url, title, subtitle) =>
          setSpreadQrPayload({ url, title, subtitle })
        }
      />

      {/* Desktop Smart AR QR Handoff Modal */}
      <DesktopQRModal
        item={qrModalItem}
        customUrl={spreadQrPayload?.url}
        customTitle={spreadQrPayload?.title}
        customSubtitle={spreadQrPayload?.subtitle}
        onClose={() => {
          setQrModalItem(null);
          setSpreadQrPayload(null);
        }}
      />
    </div>
  );
}
