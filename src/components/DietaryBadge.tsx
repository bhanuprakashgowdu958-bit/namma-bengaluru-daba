import type { DietType } from '../types/menu';

interface DietaryBadgeProps {
  type: DietType;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

const DIET_STYLES: Record<
  DietType,
  { border: string; dot: string; label: string; aria: string }
> = {
  veg: {
    border: 'border-[#22C55E]',
    dot: 'bg-[#22C55E]',
    label: 'Veg',
    aria: 'Vegetarian'
  },
  egg: {
    border: 'border-[#F59E0B]',
    dot: 'bg-[#F59E0B]',
    label: 'Egg',
    aria: 'Contains Egg'
  },
  'non-veg': {
    border: 'border-[#EF4444]',
    dot: 'bg-[#EF4444]',
    label: 'Non-Veg',
    aria: 'Non-Vegetarian'
  }
};

/**
 * Authentic FSSAI-style Veg (green), Egg (amber), and Non-Veg (red-brown) square-dot badge.
 */
export function DietaryBadge({
  type,
  size = 'sm',
  showLabel = false
}: DietaryBadgeProps) {
  const style = DIET_STYLES[type];
  const boxSize = size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]';
  const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';

  return (
    <span
      className="inline-flex items-center gap-1.5"
      aria-label={style.aria}
      title={style.aria}
    >
      <span
        className={`inline-flex ${boxSize} shrink-0 items-center justify-center rounded-[4px] border-[1.5px] ${style.border} bg-[#12100E]/90`}
      >
        <span className={`${dotSize} rounded-full ${style.dot}`} />
      </span>
      {showLabel && (
        <span className="text-[11px] font-medium tracking-wide text-[#A8A29E]">
          {style.label}
        </span>
      )}
    </span>
  );
}
