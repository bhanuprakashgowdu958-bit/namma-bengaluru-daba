import { Box } from 'lucide-react';
import type { MenuItem, PriceVariant } from '../types/menu';
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

      {/* High-Speed Menu Feed (60fps optimized for 120+ items) */}
      <section className="px-4 pt-4 sm:px-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-widest text-[#A8A29E]">
            {activeCategory === 'All' ? 'Full Menu' : activeCategory}
            <span className="ml-2 tabular-nums text-[#F7F3EC]/70">({items.length})</span>
          </p>
          <span className="inline-flex items-center gap-1 text-[11px] text-[#A8A29E]">
            <Box className="h-3 w-3 text-[#D96B27]" />
            All dishes in 3D &amp; AR
          </span>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#1C1917]/60 p-8 text-center">
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
              className="mt-4 min-h-[44px] rounded-full border border-white/15 bg-white/5 px-5 text-xs font-medium text-[#F7F3EC] hover:bg-white/10"
            >
              Reset Filters
            </button>
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
