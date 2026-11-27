import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Box, Search, X } from 'lucide-react';
import { MENU_CATEGORIES, RESTAURANT_CONFIG } from '../data/menu';
import type { MenuCategory } from '../types/menu';

export type CategoryFilter = 'All' | MenuCategory;

interface HeaderFiltersProps {
  vegOnly: boolean;
  onToggleVegOnly: () => void;
  activeCategory: CategoryFilter;
  onSelectCategory: (cat: CategoryFilter) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const ALL_CATEGORIES: CategoryFilter[] = ['All', ...MENU_CATEGORIES];

export function HeaderFilters({
  vegOnly,
  onToggleVegOnly,
  activeCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange
}: HeaderFiltersProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const toggleSearch = () => {
    if (isSearchOpen) {
      onSearchChange('');
      setIsSearchOpen(false);
    } else {
      setIsSearchOpen(true);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#12100E]/92 backdrop-blur-xl">
      {/* Row 1: Brand Wordmark + Search */}
      <div className="flex items-center justify-between gap-3 px-4 pb-1.5 pt-3 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#D96B27]" />
            <h1 className="truncate font-serif text-[17px] font-semibold tracking-tight text-[#F7F3EC] sm:text-lg">
              {RESTAURANT_CONFIG.brandName}
            </h1>
          </div>
          <p className="mt-0.5 truncate text-[11px] tracking-wide text-[#A8A29E]">
            3D &amp; 1:1 Table AR Menu
          </p>
        </div>

        {/* Search Icon (>= 44x44px touch target) */}
        <button
          type="button"
          onClick={toggleSearch}
          aria-label={isSearchOpen ? 'Close search' : 'Search dishes'}
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition active:scale-95 ${
            isSearchOpen || searchQuery
              ? 'border-[#D96B27]/60 bg-[#D96B27]/15 text-[#F7F3EC]'
              : 'border-white/10 bg-[#1C1917]/80 text-[#A8A29E] hover:border-white/20 hover:text-[#F7F3EC]'
          }`}
        >
          {isSearchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </button>
      </div>

      {/* Row 2: Zomato-style Pure Veg Sliding Switch + Subtle 3D/AR Note */}
      <div className="flex items-center justify-between gap-2 px-4 pb-2 sm:px-5">
        <button
          type="button"
          role="switch"
          aria-checked={vegOnly}
          aria-label="Veg Mode"
          onClick={onToggleVegOnly}
          className="inline-flex min-h-[44px] items-center gap-2.5 text-left active:scale-[0.98]"
        >
          <span className="text-xs font-semibold tracking-wide text-[#F7F3EC]">
            Veg Mode
          </span>
          <span
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition-colors duration-200 ${
              vegOnly
                ? 'border-[#22C55E] bg-[#22C55E]'
                : 'border-white/15 bg-[#1C1917]'
            }`}
          >
            <motion.span
              layout
              transition={{ type: 'spring', stiffness: 520, damping: 32 }}
              className={`flex h-5 w-5 items-center justify-center rounded-full bg-[#F7F3EC] shadow-sm ${
                vegOnly ? 'ml-auto' : 'mr-auto'
              }`}
            >
              <span
                className={`inline-flex h-3 w-3 items-center justify-center rounded-[2.5px] border ${
                  vegOnly ? 'border-[#16A34A]' : 'border-[#78716C]'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    vegOnly ? 'bg-[#16A34A]' : 'bg-[#78716C]'
                  }`}
                />
              </span>
            </motion.span>
          </span>
        </button>

        <AnimatePresence mode="wait">
          {vegOnly ? (
            <motion.span
              key="veg-on"
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              className="rounded-full border border-[#22C55E]/35 bg-[#22C55E]/10 px-2.5 py-0.5 text-[10px] font-medium text-[#86EFAC]"
            >
              Egg &amp; Non-Veg hidden
            </motion.span>
          ) : (
            <motion.span
              key="all-ar"
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              className="inline-flex items-center gap-1 text-[11px] text-[#A8A29E]"
            >
              <Box className="h-3 w-3 text-[#D96B27]" />
              Tap any dish for 3D / AR
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Expandable Live Search Bar */}
      {isSearchOpen && (
        <div className="border-t border-white/5 px-4 pb-3 pt-2 sm:px-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8A29E]" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search paratha, biryani, paneer, tandoori..."
              className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#1C1917] py-2 pl-10 pr-11 text-sm text-[#F7F3EC] placeholder-[#A8A29E]/70 outline-none transition focus:border-[#D96B27]/70"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search query"
                className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[#A8A29E] hover:text-[#F7F3EC]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Horizontal Scrollable Category Tabs */}
      <nav
        aria-label="Menu categories"
        className="no-scrollbar flex items-center gap-2 overflow-x-auto px-4 pb-3 pt-1 sm:px-5"
      >
        {ALL_CATEGORIES.map((category) => {
          const isActive = activeCategory === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => onSelectCategory(category)}
              className={`min-h-[44px] shrink-0 rounded-full border px-4 text-xs font-medium transition active:scale-95 ${
                isActive
                  ? 'border-[#D96B27] bg-[#D96B27] text-[#F7F3EC] shadow-saffron'
                  : 'border-white/10 bg-[#1C1917]/80 text-[#A8A29E] hover:border-white/20 hover:text-[#F7F3EC]'
              }`}
            >
              {category}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
