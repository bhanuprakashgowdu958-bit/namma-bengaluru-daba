import { useState } from 'react';
import { Box, Minus, Plus } from 'lucide-react';
import type { MenuItem, PriceVariant } from '../types/menu';
import { formatINR } from '../utils/format';
import { DietaryBadge } from './DietaryBadge';

interface MenuCardProps {
  item: MenuItem;
  isSelectedOnDesktop: boolean;
  getVariantQuantity: (itemId: string, variantLabel: PriceVariant['label']) => number;
  onAddVariant: (item: MenuItem, variant: PriceVariant) => void;
  onDecrementVariant: (item: MenuItem, variant: PriceVariant) => void;
  onInspectAR: (item: MenuItem) => void;
}

/**
 * High-speed menu card supporting instant inline Half/Full & Veg/Chicken variant switching,
 * >=44px touch targets, and 3D/AR studio launch for hero dishes.
 */
export function MenuCard({
  item,
  isSelectedOnDesktop,
  getVariantQuantity,
  onAddVariant,
  onDecrementVariant,
  onInspectAR
}: MenuCardProps) {
  const [selectedVariant, setSelectedVariant] = useState<PriceVariant>(
    item.variants[0]
  );

  const qty = getVariantQuantity(item.id, selectedVariant.label);
  const isAR = Boolean(item.hasAR);
  const hasStudioPhoto = Boolean(item.poster && isAR);

  return (
    <article
      onClick={() => {
        if (isAR) onInspectAR(item);
      }}
      className={`group relative flex items-center gap-3.5 rounded-2xl border p-3.5 backdrop-blur-xl transition ${
        isAR ? 'cursor-pointer' : ''
      } ${
        isSelectedOnDesktop
          ? 'border-[#D96B27]/85 bg-[#1C1917] shadow-[0_0_0_1px_rgba(217,107,39,0.28)]'
          : 'border-white/10 bg-[#1C1917]/80 hover:border-white/20 hover:bg-[#1C1917]'
      }`}
    >
      {/* Fast-loading 2D studio poster thumbnail for AR Hero items */}
      {hasStudioPhoto && (
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#241F1B]">
          <img
            src={item.poster}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full border border-white/15 bg-[#12100E]/88 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#F7F3EC] backdrop-blur-md">
            <Box className="h-2.5 w-2.5 text-[#D96B27]" />
            3D / AR
          </span>
        </div>
      )}

      {/* Dish Info, Inline Variant Switcher & Add Stepper */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <DietaryBadge type={item.diet} />
              <span className="truncate text-[11px] font-medium text-[#A8A29E]">
                {item.category}
              </span>
            </div>

            {isAR && !hasStudioPhoto && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#D96B27]/45 bg-[#D96B27]/15 px-2.5 py-0.5 text-[10px] font-semibold text-[#F4A26E]">
                <Box className="h-2.5 w-2.5" />
                3D / AR
              </span>
            )}
          </div>

          <h2 className="mt-1 font-serif text-[16px] font-semibold leading-snug tracking-tight text-[#F7F3EC]">
            {item.name}
          </h2>

          {item.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-[#A8A29E]">
              {item.description}
            </p>
          )}
        </div>

        {/* Inline Variant Switcher (Half/Full, Veg/Chicken) */}
        {item.variants.length > 1 && (
          <div
            className="flex flex-wrap items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {item.variants.map((variant) => {
              const active = selectedVariant.label === variant.label;
              const vQty = getVariantQuantity(item.id, variant.label);
              return (
                <button
                  key={variant.label}
                  type="button"
                  onClick={() => setSelectedVariant(variant)}
                  className={`inline-flex min-h-[36px] items-center gap-1 rounded-full border px-3 text-xs font-medium transition active:scale-95 ${
                    active
                      ? 'border-[#D96B27] bg-[#D96B27]/20 text-[#F7F3EC]'
                      : 'border-white/10 bg-[#12100E]/60 text-[#A8A29E] hover:border-white/20 hover:text-[#F7F3EC]'
                  }`}
                >
                  <span>{variant.label}</span>
                  <span className="tabular-nums text-[#F4A26E]">
                    {formatINR(variant.price)}
                  </span>
                  {vQty > 0 && (
                    <span className="ml-0.5 rounded-full bg-[#D96B27] px-1.5 text-[10px] font-bold tabular-nums text-[#F7F3EC]">
                      {vQty}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Bottom Price + >=44px Touch Target Add / Stepper */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold tabular-nums text-[#F7F3EC]">
            {formatINR(selectedVariant.price)}
          </span>

          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {isAR && (
              <button
                type="button"
                onClick={() => onInspectAR(item)}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-medium text-[#F7F3EC] transition hover:border-[#D96B27]/60 hover:bg-[#D96B27]/15 active:scale-95"
              >
                <Box className="h-3.5 w-3.5 text-[#D96B27]" />
                <span>3D</span>
              </button>
            )}

            {qty === 0 ? (
              <button
                type="button"
                onClick={() => onAddVariant(item, selectedVariant)}
                className="inline-flex min-h-[44px] min-w-[76px] items-center justify-center gap-1 rounded-full border border-[#D96B27]/70 bg-[#D96B27]/15 px-3.5 text-xs font-semibold text-[#F7F3EC] transition hover:bg-[#D96B27] active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            ) : (
              <div className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-[#D96B27] bg-[#D96B27] px-1.5 text-xs font-semibold text-[#F7F3EC]">
                <button
                  type="button"
                  onClick={() => onDecrementVariant(item, selectedVariant)}
                  aria-label={`Remove one ${item.name} (${selectedVariant.label})`}
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/20 active:scale-90"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[18px] text-center tabular-nums">{qty}</span>
                <button
                  type="button"
                  onClick={() => onAddVariant(item, selectedVariant)}
                  aria-label={`Add one more ${item.name} (${selectedVariant.label})`}
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/20 active:scale-90"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
