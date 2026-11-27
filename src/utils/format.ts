import type { CartItem, MenuItem, PriceVariant } from '../types/menu';
import { RESTAURANT_CONFIG } from '../data/menu';

/**
 * Formats an integer amount in Indian Rupees with standard Indian comma grouping.
 */
export function formatINR(amount: number): string {
  return `${RESTAURANT_CONFIG.currency}${amount.toLocaleString('en-IN')}`;
}

export function getDefaultVariant(item: MenuItem): PriceVariant {
  return item.variants[0];
}

export function buildCartKey(itemId: string, variantLabel: PriceVariant['label']): string {
  return `${itemId}__${variantLabel}`;
}

export function getVariantSummary(item: MenuItem): string {
  if (item.variants.length <= 1) return '';
  return item.variants.map((v) => `${v.label} ${formatINR(v.price)}`).join(' • ');
}

export function buildWhatsAppOrderUrl(params: {
  items: CartItem[];
  tableNumber: string;
  cookingNotes: string;
  totalAmount: number;
}): string {
  const { items, tableNumber, cookingNotes, totalAmount } = params;
  const lines: string[] = [
    `*${RESTAURANT_CONFIG.brandName}*`,
    tableNumber.trim() ? `Table: *#${tableNumber.trim()}*` : 'Table: *Walk-in / Dine-in*',
    '------------------------',
    '*Order Details:*'
  ];

  items.forEach((entry, index) => {
    const lineTotal = entry.variant.price * entry.quantity;
    const variantSuffix =
      entry.item.variants.length > 1 || entry.variant.label !== 'Regular'
        ? ` (${entry.variant.label})`
        : '';
    lines.push(
      `${index + 1}. ${entry.quantity}x *${entry.item.name}*${variantSuffix} — ${formatINR(lineTotal)}`
    );
  });

  if (cookingNotes.trim()) {
    lines.push('------------------------');
    lines.push(`*Kitchen Note:* ${cookingNotes.trim()}`);
  }

  lines.push('------------------------');
  lines.push(`*Total Estimate: ${formatINR(totalAmount)}*`);
  lines.push('_Sent from Namma Bengaluru Daba 3D AR Menu_');

  const encoded = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/${RESTAURANT_CONFIG.whatsappNumber}?text=${encoded}`;
}
