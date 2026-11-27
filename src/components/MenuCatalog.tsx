import { useEffect, useMemo, useState } from 'react';
import { Box, Plus, Sparkles } from 'lucide-react';
import type { MenuItem, PriceVariant } from '../types/menu';
import { formatINR, getDefaultVariant } from '../utils/format';
import { DietaryBadge } from './DietaryBadge';
import { type CategoryFilter, HeaderFilters } from './HeaderFilters';
import { MenuCard } from './MenuCard';

interface MenuCatalogProps {
  items: MenuItem[];
  selectedItemId: string | null;
  vegOnly: boolean;
  onToggleVegOnly: () => void;
  activeCategory: CategoryFilter;
  onSelectCategory: (cat: CategoryFilter) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onInspectAR: (item: MenuItem) => void;
  onAddVariant: (item: MenuItem, variant: PriceVariant) => void;
  onDecrementVariant: (item: MenuItem, variant: PriceVariant) => void;
  getVariantQuantity: (itemId: string, variantLabel: PriceVariant['label']) => number;
}

const CATEGORY_HERO_IDS: Record<CategoryFilter, readonly string[]> = {
  All: ['nv-3', 'bf-2', 'bf-29', 'od-1', 'bf-9'],
  Breakfast: ['bf-2', 'bf-9', 'bf-11', 'bf-29', 'bf-15'],
  'Other Delights': ['od-11', 'od-1', 'od-9', 'od-12', 'od-13'],
  Chinese: ['ch-5', 'ch-20'],
  'Chinese Combos': ['cc-1'],
  'Kathi Rolls': ['kr-1', 'kr-6'],
  'Veg Main Course': ['vm-14', 'vm-4', 'vm-1'],
  'Non-Veg Main Course': ['nv-3', 'nv-1', 'nv-2', 'nv-12'],
  Breads: ['br-1']
};

export function MenuCatalog({
  items,
  selectedItemId,
  vegOnly,
  onToggleVegOnly,
  activeCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onInspectAR,
  onAddVariant,
  onDecrementVariant,
  getVariantQuantity
}: MenuCatalogProps) {
  const [heroIdx, setHeroIdx] = useState(0);

  useEffect(() => {
    setHeroIdx(0);
  }, [activeCategory, vegOnly]);

  const signatureHeroes = useMemo(() => {
    const preferredIds = CATEGORY_HERO_IDS[activeCategory] ?? [];
    const preferred = preferredIds
      .map((id) => items.find((entry) => entry.id === id))
      .filter(
        (entry): entry is MenuItem => Boolean(entry && entry.poster && entry.hasAR)
      );
    if (preferred.length > 0) return preferred;
    return items.filter((entry) => entry.hasAR && entry.poster).slice(0, 5);
  }, [items, activeCategory]);

  const activeHero = signatureHeroes[heroIdx % Math.max(1, signatureHeroes.length)];
  const showHeroSpotlight = !searchQuery.trim() && Boolean(activeHero);

  const groupedSections = useMemo(() => {
    if (activeCategory !== 'All' || searchQuery.trim()) {
      return null;
    }
    const groups = new Map<string, MenuItem[]>();
    for (const item of items) {
      const list = groups.get(item.category);
      if (list) list.push(item);
      else groups.set(item.category, [item]);
    }
    return Array.from(groups.entries());
  }, [items, activeCategory, searchQuery]);

  const arCount = useMemo(
    () => items.filter((entry) => entry.hasAR).length,
    [items]
  );

  return (
    <div className="flex flex-col pb-28 lg:pb-24">
      <HeaderFilters
        vegOnly={vegOnly}
        onToggleVegOnly={onToggleVegOnly}
        activeCategory={activeCategory}
        onSelectCategory={onSelectCategory}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
      />

      {/* Mobile Editorial Chef's AR Spotlight */}
      {showHeroSpotlight && activeHero && (
        <section className="px-3.5 pt-2.5 lg:hidden">
          <div
            onClick={() => onInspectAR(activeHero)}
            className="group relative cursor-pointer overflow-hidden rounded-[26px] border border-white/15 bg-[#161210] shadow-[0_24px_50px_-14px_rgba(0,0,0,0.85)]"
          >
            <div className="relative h-56 w-full overflow-hidden">
              <img
                src={activeHero.poster}
                alt={activeHero.name}
                className="h-full w-full object-cover object-center transition duration-700 group-hover:scale-105"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#120F0D] via-[#120F0D]/40 to-black/25"
              />

              {/* Top Floating Liquid Glass Signature Badge */}
              <div className="absolute left-3.5 right-3.5 top-3.5 flex items-center justify-between gap-2">
                <span className="liquid-glass-pill inline-flex items-center gap-1.5 rounded-full border border-white/25 px-3 py-1 text-[11px] font-semibold text-[#F7F3EC]">
                  <Sparkles className="h-3 w-3 text-[#D96B27]" />
                  Chef&apos;s 1:1 Table AR
                </span>
                <span className="liquid-glass-pill rounded-full border border-white/20 px-2.5 py-1 text-[11px] font-bold tabular-nums text-[#F7F3EC]">
                  {formatINR(getDefaultVariant(activeHero).price)}
                </span>
              </div>

              {/* Bottom Editorial Dish Overlay */}
              <div className="absolute inset-x-3.5 bottom-3.5 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <DietaryBadge type={activeHero.diet} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#F4A26E]">
                      {activeHero.category}
                    </span>
                  </div>
                  <h2 className="mt-1 truncate font-serif text-xl font-semibold tracking-tight text-[#F7F3EC]">
                    {activeHero.name}
                  </h2>
                  {activeHero.description && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-[#D6D0C8]">
                      {activeHero.description}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddVariant(activeHero, getDefaultVariant(activeHero));
                  }}
                  aria-label={`Add ${activeHero.name}`}
                  className="liquid-glass-saffron flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/30 text-[#F7F3EC] transition hover:brightness-110 active:scale-90"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Spotlight Dish Switcher Strip */}
            {signatureHeroes.length > 0 && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-t border-white/10 bg-[#14110F]/90 px-3 py-2.5 backdrop-blur-xl"
              >
                {signatureHeroes.map((dish, idx) => {
                  const selected = dish.id === activeHero.id;
                  return (
                    <button
                      key={dish.id}
                      type="button"
                      onClick={() => setHeroIdx(idx)}
                      className={`inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition ${
                        selected
                          ? 'border-[#D96B27]/80 bg-[#D96B27]/20 text-[#F7F3EC]'
                          : 'border-white/10 bg-white/[0.03] text-[#A8A29E] hover:text-[#F7F3EC]'
                      }`}
                    >
                      <Box className="h-2.5 w-2.5 text-[#D96B27]" />
                      {dish.name}
                    </button>
                  );
                })}
                {signatureHeroes.length === 1 && (
                  <span className="ml-auto shrink-0 pl-2 text-[10px] font-medium text-[#A8A29E]">
                    Tap banner for 3D &amp; AR
                  </span>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* High-Speed Menu Feed (60fps optimized for 130+ items) */}
      <section className="px-3.5 pt-4 sm:px-5">
        <div className="mb-3 flex items-center justify-between px-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A8A29E]">
            {activeCategory === 'All' ? 'Curated Menu' : activeCategory}
            <span className="ml-2 tabular-nums text-[#F7F3EC]/70">({items.length})</span>
          </p>
          <span className="inline-flex items-center gap-1 text-[11px] text-[#A8A29E]">
            <Box className="h-3 w-3 text-[#D96B27]" />
            {arCount} {arCount === 1 ? 'dish' : 'dishes'} in 3D &amp; AR
          </span>
        </div>

        {items.length === 0 ? (
          <div className="liquid-glass-card rounded-3xl border border-white/12 p-8 text-center">
            <p className="font-serif text-lg text-[#F7F3EC]">No matching dishes found</p>
            <p className="mt-1 text-xs text-[#A8A29E]">
              Try clearing your filters or searching another dish.
            </p>
            <button
              type="button"
              onClick={() => {
                onSelectCategory('All');
                onSearchChange('');
                if (vegOnly) onToggleVegOnly();
              }}
              className="liquid-glass-pill mt-4 min-h-[44px] rounded-full border border-white/15 px-5 text-xs font-medium text-[#F7F3EC] hover:brightness-110"
            >
              Reset Filters
            </button>
          </div>
        ) : groupedSections ? (
          <div className="space-y-7">
            {groupedSections.map(([categoryName, categoryItems], idx) => (
              <div key={categoryName}>
                <div className="mb-2.5 flex items-center gap-3 px-0.5">
                  <span className="font-mono text-[11px] font-semibold text-[#D96B27]">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <h2 className="font-serif text-lg font-semibold tracking-tight text-[#F7F3EC]">
                    {categoryName}
                  </h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
                  <span className="text-[11px] tabular-nums text-[#A8A29E]">
                    {categoryItems.length}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {categoryItems.map((item) => (
                    <MenuCard
                      key={item.id}
                      item={item}
                      isSelectedOnDesktop={selectedItemId === item.id}
                      getVariantQuantity={getVariantQuantity}
                      onAddVariant={onAddVariant}
                      onDecrementVariant={onDecrementVariant}
                      onInspectAR={onInspectAR}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((item) => (
              <MenuCard
                key={item.id}
                item={item}
                isSelectedOnDesktop={selectedItemId === item.id}
                getVariantQuantity={getVariantQuantity}
                onAddVariant={onAddVariant}
                onDecrementVariant={onDecrementVariant}
                onInspectAR={onInspectAR}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
