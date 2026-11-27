/**
 * Detects whether the current viewport / device is desktop (>= 1024px) or mobile/tablet
 * capable of native WebAR (iOS AR Quick Look / Android Scene Viewer / WebXR).
 */
export function isMobileARCapableDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isTouchMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  const isIPadOS =
    navigator.platform === 'MacIntel' && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
  return isTouchMobile || isIPadOS;
}

export function getDishDeepLinkUrl(dishId: string): string {
  if (typeof window === 'undefined') return `?dish=${encodeURIComponent(dishId)}`;
  const url = new URL(window.location.href);
  url.searchParams.set('dish', dishId);
  return url.toString();
}
