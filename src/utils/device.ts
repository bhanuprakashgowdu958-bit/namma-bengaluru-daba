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

export function isFirefoxAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return isAndroidDevice() && /Firefox/i.test(navigator.userAgent || '');
}

export function isInAppWebView(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /\bwv\b/i.test(ua) ||
    /FBAN|FBAV|Instagram|WhatsApp|Snapchat|Line|MicroMessenger|Twitter/i.test(ua) ||
    (isAndroidDevice() && /Version\/\d+\.\d+/i.test(ua) && !/Chrome\/\d+/i.test(ua))
  );
}

export function isSceneViewerCandidate(): boolean {
  return isAndroidDevice() && !isFirefoxAndroid() && !isInAppWebView();
}

export async function checkWebXRSupported(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const xr = (navigator as Navigator & {
    xr?: { isSessionSupported?: (mode: string) => Promise<boolean> };
  }).xr;
  if (!xr || typeof xr.isSessionSupported !== 'function') return false;
  try {
    return await xr.isSessionSupported('immersive-ar');
  } catch {
    return false;
  }
}

export function isMobileARCapableDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return isAndroidDevice() || isIOSDevice();
}

/**
 * Builds a direct Google Scene Viewer intent URL for Android devices.
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

/**
 * Builds an Android intent URL to re-open the current page in Google Chrome
 * when the guest opened the menu inside an in-app browser (WhatsApp, Instagram, etc.).
 */
export function buildOpenInChromeIntentUrl(): string {
  if (typeof window === 'undefined') return '#';
  const target = window.location.href.replace(/^https?:\/\//i, '');
  const scheme = window.location.protocol === 'http:' ? 'http' : 'https';
  return `intent://${target}#Intent;scheme=${scheme};package=com.android.chrome;action=android.intent.action.VIEW;end;`;
}

export function getDishDeepLinkUrl(dishId: string): string {
  if (typeof window === 'undefined') return `?dish=${encodeURIComponent(dishId)}`;
  const url = new URL(window.location.href);
  url.searchParams.set('dish', dishId);
  return url.toString();
}
