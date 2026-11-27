/**
 * Detects whether the current viewport / device is desktop (>= 1024px) or mobile/tablet
 * capable of native WebAR (iOS AR Quick Look / Android Scene Viewer / WebXR).
 */
export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' &&
      typeof navigator.maxTouchPoints === 'number' &&
      navigator.maxTouchPoints > 1)
  );
}

export function isMobileARCapableDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return isAndroidDevice() || isIOSDevice();
}

/**
 * Builds a direct Google Scene Viewer intent URL for Android devices as a resilient
 * fallback when `<model-viewer>` WebXR/mode selection reports `canActivateAR === false`
 * (e.g. async WebXR check still pending, blocked session state, or custom Chromium UA).
 */
export function buildSceneViewerIntentUrl(glbPath: string, title?: string): string {
  const originUrl = new URL(glbPath, window.location.href);
  const fallbackUrl = new URL(window.location.href);
  fallbackUrl.hash = 'ar-fallback';

  const params = new URLSearchParams({
    mode: 'ar_preferred',
    disable_occlusion: 'true',
    resizable: 'false'
  });
  if (title) {
    params.set('title', title);
  }

  return (
    `intent://arvr.google.com/scene-viewer/1.2?${params.toString()}&file=${encodeURIComponent(originUrl.toString())}` +
    `#Intent;scheme=https;package=com.google.android.googlequicksearchbox;` +
    `action=android.intent.action.VIEW;` +
    `S.browser_fallback_url=${encodeURIComponent(fallbackUrl.toString())};end;`
  );
}

export function getDishDeepLinkUrl(dishId: string): string {
  if (typeof window === 'undefined') return `?dish=${encodeURIComponent(dishId)}`;
  const url = new URL(window.location.href);
  url.searchParams.set('dish', dishId);
  return url.toString();
}
