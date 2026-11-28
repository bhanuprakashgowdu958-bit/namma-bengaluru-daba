import { useState } from 'react';
import { Box, Minus, Plus } from 'lucide-react';
import type { MenuItem, PriceVariant } from '../types/menu';
import { formatINR } from '../utils/format';
import { DietaryBadge } from './DietaryBadge';

interface MenuCardProps {
  item: MenuItem;
  isSelectedOnDesktop: boolean;
  variantLayout?: 'grid' | 'row';
  getVariantQuantity: (itemId: string, variantLabel: PriceVariant['label']) => number;
  onAddVariant: (item: MenuItem, variant: PriceVariant) => void;
  onDecrementVariant: (item: MenuItem, variant: PriceVariant) => void;
  onInspectAR: (item: MenuItem) => void;
}

/**
 * Dual-layout restaurant dish card:
 * - 'grid': Canva-style 2-column vertical photo card with edge-to-edge dish imagery, AR badge, and quick '+'
 * - 'row': Streamlined single-column ledger card for classic dishes without studio photos
 */
export function MenuCard({
  item,
  isSelectedOnDesktop,
  variantLayout = 'row',
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

  if (variantLayout === 'grid' && hasStudioPhoto) {
    return (
      <article
        onClick={() => {
          if (isAR) onInspectAR(item);
        }}
        className={`liquid-glass-card group relative flex cursor-pointer flex-col overflow-hidden rounded-[22px] border transition-colors duration-200 ${
          isSelectedOnDesktop
            ? 'border-[#D96B27]/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_0_0_1px_rgba(217,107,39,0.35),0_18px_40px_-10px_rgba(217,107,39,0.28)]'
            : 'border-white/12 hover:border-white/25'
        }`}
      >
        {/* Full-bleed Top Photo Stage */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#181512]">
          <img
            src={item.poster}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#12100E] via-transparent to-black/35"
          />

          <div className="absolute inset-x-2.5 top-2.5 flex items-center justify-between gap-1.5">
            <span className="inline-flex rounded-lg bg-[#0A0A0D]/80 p-1">
              <DietaryBadge type={item.diet} />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-[#0A0A0D]/80 px-2 py-0.5 text-[9.5px] font-semibold tracking-wide text-[#F7F3EC]">
              <Box className="h-2.5 w-2.5 text-[#D96B27]" />
              1:1 AR
            </span>
          </div>
        </div>

        {/* Clean Canva-Style Bottom Details + Quick Add */}
        <div className="flex flex-1 flex-col justify-between gap-2 p-3">
          <div>
            <h2 className="line-clamp-2 font-serif text-[14.5px] font-semibold leading-snug tracking-tight text-[#F7F3EC]">
              {item.name}
            </h2>
            {item.description && (
              <p className="mt-1 line-clamp-1 text-[11px] text-[#A8A29E]">
                {item.description}
              </p>
            )}
          </div>

          {item.variants.length > 1 && (
            <div
              className="flex flex-wrap items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {item.variants.map((variant) => {
                const active = selectedVariant.label === variant.label;
                return (
                  <button
                    key={variant.label}
                    type="button"
                    onClick={() => setSelectedVariant(variant)}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                      active
                        ? 'border-[#D96B27] bg-[#D96B27]/20 text-[#F7F3EC]'
                        : 'border-white/10 bg-black/30 text-[#A8A29E] hover:text-[#F7F3EC]'
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

          <div
            className="flex items-center justify-between gap-2 pt-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[15px] font-bold tabular-nums text-[#F7F3EC]">
              {formatINR(selectedVariant.price)}
            </span>

            {qty === 0 ? (
              <button
                type="button"
                onClick={() => onAddVariant(item, selectedVariant)}
                aria-label={`Add ${item.name}`}
                className="liquid-glass-saffron flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-[#F7F3EC] transition hover:brightness-110 active:scale-90"
              >
                <Plus className="h-4 w-4" />
              </button>
            ) : (
              <div className="liquid-glass-saffron inline-flex h-9 items-center gap-0.5 rounded-full border border-white/25 px-1 text-xs font-semibold text-[#F7F3EC]">
                <button
                  type="button"
                  onClick={() => onDecrementVariant(item, selectedVariant)}
                  aria-label={`Remove one ${item.name} (${selectedVariant.label})`}
                  className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/20"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="min-w-[16px] text-center tabular-nums">{qty}</span>
                <button
                  type="button"
                  onClick={() => onAddVariant(item, selectedVariant)}
                  aria-label={`Add one more ${item.name} (${selectedVariant.label})`}
                  className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/20"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      onClick={() => onInspectAR(item)}
      className={`liquid-glass-card group relative flex cursor-pointer items-center gap-3.5 rounded-[22px] border p-3.5 transition-colors duration-200 ${
        isSelectedOnDesktop
          ? 'border-[#D96B27]/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_0_0_1px_rgba(217,107,39,0.35),0_18px_40px_-10px_rgba(217,107,39,0.28)]'
          : 'border-white/12 hover:border-white/25'
      }`}
    >
      {/* Framed Studio Portrait for AR Hero Dishes */}
      {hasStudioPhoto && (
        <div className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-[#1B1714] shadow-[0_8px_20px_-6px_rgba(0,0,0,0.7)] ring-1 ring-inset ring-white/10">
          <img
            src={item.poster}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-white/5"
          />
          <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-[#0A0A0D]/80 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#F7F3EC] absolute bottom-1.5 left-1.5">
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
              <span className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-[#A8A29E]">
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

          <h2 className="mt-1 font-serif text-[16.5px] font-semibold leading-snug tracking-tight text-[#F7F3EC]">
            {item.name}
          </h2>

          {item.description && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[#A8A29E]">
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
                className="liquid-glass-pill inline-flex min-h-[44px] items-center gap-1 rounded-full border border-white/15 px-3 text-xs font-medium text-[#F7F3EC] transition hover:border-[#D96B27]/65 active:scale-95"
              >
                <Box className="h-3.5 w-3.5 text-[#D96B27]" />
                <span>3D</span>
              </button>
            )}

            {qty === 0 ? (
              <button
                type="button"
                onClick={() => onAddVariant(item, selectedVariant)}
                className="liquid-glass-pill inline-flex min-h-[44px] min-w-[76px] items-center justify-center gap-1 rounded-full border border-[#D96B27]/75 bg-[#D96B27]/20 px-3.5 text-xs font-semibold text-[#F7F3EC] transition hover:bg-[#D96B27] active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            ) : (
              <div className="liquid-glass-saffron inline-flex min-h-[44px] items-center gap-1 rounded-full border border-white/25 px-1.5 text-xs font-semibold text-[#F7F3EC]">
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
