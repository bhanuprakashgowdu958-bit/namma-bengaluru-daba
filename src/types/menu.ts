export type DietType = 'veg' | 'egg' | 'non-veg';

export type MenuCategory =
  | 'Breakfast'
  | 'Other Delights'
  | 'Chinese'
  | 'Chinese Combos'
  | 'Kathi Rolls'
  | 'Veg Main Course'
  | 'Non-Veg Main Course'
  | 'Breads';

export interface PriceVariant {
  label: 'Regular' | 'Half' | 'Full' | 'Veg' | 'Chicken';
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  diet: DietType;
  variants: PriceVariant[];
  hasAR?: boolean; // Enable 3D/AR viewer for high-margin hero dishes
  /**
   * Set to true once you replace the placeholder model with a real Polycam/Luma 3D food scan
   * so the 360° 3D mesh auto-reveals instead of the studio food photograph.
   */
  hasCustom3DScan?: boolean;
  modelGlb?: string; // Android / Web 3D model URL
  modelUsdz?: string; // iOS AR Quick Look URL
  poster?: string; // Fast-loading 2D studio photo
  description?: string;
  /** Optional real-world footprint hint (e.g. "26 cm plate") for 1:1 AR calibration */
  realWorldDimensions?: string;
}

export interface CartItem {
  cartKey: string;
  item: MenuItem;
  variant: PriceVariant;
  quantity: number;
}
