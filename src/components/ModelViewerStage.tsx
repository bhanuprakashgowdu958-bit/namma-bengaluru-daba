import '@google/model-viewer';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Box, Move3d, RotateCcw, Sparkles } from 'lucide-react';
import type { MenuItem } from '../types/menu';
import type { ModelViewerElement } from '../types/model-viewer';
import {
  buildSceneViewerIntentUrl,
  checkWebXRSupported,
  isAndroidDevice,
  isIOSDevice,
  isSceneViewerCandidate
} from '../utils/device';
import { startAnchoredTableAR } from '../utils/webxrTableAR';
import { DietaryBadge } from './DietaryBadge';

export interface ModelViewerStageHandle {
  activateAR: () => Promise<boolean>;
  resetView: () => void;
}

interface ModelViewerStageProps {
  item: MenuItem;
  showMetadataPills?: boolean;
  className?: string;
  onARUnsupported?: (reason?: string) => void;
  onARFailed?: (reason: string) => void;
}

const DEFAULT_ORBIT = '0deg 44deg 72%';

/**
 * Shared 3D & WebAR Dish Studio Stage powered by @google/model-viewer.
 * Displays the high-contrast studio food photograph cleanly while keeping
 * 1:1 WebAR ("View on Your Table") ready; auto-reveals 360° 3D mesh when
 * `item.hasCustom3DScan` is enabled with a real Polycam/Luma scan.
 */
export const ModelViewerStage = forwardRef<ModelViewerStageHandle, ModelViewerStageProps>(
  function ModelViewerStage(
    { item, showMetadataPills = true, className = '', onARUnsupported, onARFailed },
    ref
  ) {
    const viewerRef = useRef<ModelViewerElement | null>(null);
    const onARFailedRef = useRef(onARFailed);
    onARFailedRef.current = onARFailed;

    const [loadProgress, setLoadProgress] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [showGestureHint, setShowGestureHint] = useState(false);
    const [showHotspotCard, setShowHotspotCard] = useState(false);
    const [isWebXRSupported, setIsWebXRSupported] = useState(false);
    const [isPresentingAR, setIsPresentingAR] = useState(false);

    useEffect(() => {
      let active = true;
      checkWebXRSupported().then((supported) => {
        if (active) setIsWebXRSupported(supported);
      });
      return () => {
        active = false;
      };
    }, []);

    const hasAR = Boolean(item.hasAR && item.modelGlb);
    const hasInteractive3D = Boolean(hasAR && item.hasCustom3DScan);
    const modelGlbSrc = item.modelGlb ? `${item.modelGlb}?v=10` : undefined;
    const modelUsdzSrc = item.modelUsdz ? `${item.modelUsdz}?v=10` : undefined;

    useEffect(() => {
      setShowHotspotCard(false);
    }, [item.id]);

    useEffect(() => {
      setLoadProgress(0);
      setIsLoaded(false);
      setHasError(false);
      setShowGestureHint(hasInteractive3D);

      if (!hasInteractive3D) return;
      const timer = window.setTimeout(() => {
        setShowGestureHint(false);
      }, 2000);

      return () => window.clearTimeout(timer);
    }, [item.id, hasInteractive3D]);

    useEffect(() => {
      const handleFallbackHash = (event?: HashChangeEvent) => {
        const hashFromUrl = event?.newURL ? new URL(event.newURL).hash : window.location.hash;
        if (
          hashFromUrl === '#model-viewer-no-ar-fallback' ||
          hashFromUrl === '#ar-fallback' ||
          window.location.hash === '#model-viewer-no-ar-fallback' ||
          window.location.hash === '#ar-fallback'
        ) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          onARFailedRef.current?.(
            'Google Scene Viewer could not launch on this device. Make sure Google App & Google Play Services for AR are installed and updated in Chrome.'
          );
        }
      };

      handleFallbackHash();
      window.addEventListener('hashchange', handleFallbackHash);

      const el = viewerRef.current;
      const handleArStatus = (event: Event) => {
        const customEvent = event as CustomEvent<{ status?: string }>;
        const status = customEvent.detail?.status;
        setIsPresentingAR(status === 'session-started');
        if (status === 'failed') {
          onARFailedRef.current?.(
            'AR session could not start on this device. Open this menu on Safari (iOS) or Chrome (Android) for live table AR.'
          );
        }
      };

      el?.addEventListener('ar-status', handleArStatus);
      return () => {
        window.removeEventListener('hashchange', handleFallbackHash);
        el?.removeEventListener('ar-status', handleArStatus);
      };
    }, [item.id]);

    useEffect(() => {
      const el = viewerRef.current;
      if (!el || !hasInteractive3D) return;

      const handleProgress = (event: Event) => {
        const customEvent = event as CustomEvent<{ totalProgress: number }>;
        if (typeof customEvent.detail?.totalProgress === 'number') {
          setLoadProgress(Math.round(customEvent.detail.totalProgress * 100));
        }
      };

      const handleLoad = () => {
        setLoadProgress(100);
        setIsLoaded(true);
        setHasError(false);
      };

      const handleError = () => {
        setHasError(true);
        setIsLoaded(true);
      };

      el.addEventListener('progress', handleProgress);
      el.addEventListener('load', handleLoad);
      el.addEventListener('error', handleError);

      return () => {
        el.removeEventListener('progress', handleProgress);
        el.removeEventListener('load', handleLoad);
        el.removeEventListener('error', handleError);
      };
    }, [item.id, hasInteractive3D]);

    const resetView = () => {
      const el = viewerRef.current;
      if (!el) return;
      el.resetTurntableRotation();
      el.cameraOrbit = DEFAULT_ORBIT;
      el.jumpCameraToGoal();
    };

    useImperativeHandle(ref, () => ({
      activateAR: async () => {
        const el = viewerRef.current;
        if (!el || !modelGlbSrc) {
          onARUnsupported?.('AR preview is still initializing. Please try again.');
          return false;
        }

        // AR requires a real mobile device — desktop browsers cannot handle
        // Scene Viewer intent:// URLs or AR Quick Look even if model-viewer
        // reports canActivateAR (UA detection quirks, responsive mode, etc.)
        if (!isAndroidDevice() && !isIOSDevice()) {
          onARUnsupported?.(
            'AR requires a mobile phone. Scan the QR code on your phone to place this dish on your table.'
          );
          return false;
        }

        // Prefer hardware-anchored Three.js WebXR on Android Chrome when supported, else Scene Viewer
        if (isAndroidDevice()) {
          if (isWebXRSupported) {
            try {
              await startAnchoredTableAR({
                glbUrl: modelGlbSrc,
                title: item.name,
                onError: (msg) => onARFailedRef.current?.(msg)
              });
              return true;
            } catch {
              // Fall back to model-viewer / Scene Viewer below
            }
          }
          if (el.canActivateAR) {
            try {
              await el.activateAR();
              return true;
            } catch {
              // Fall back to Scene Viewer below
            }
          }
          if (isSceneViewerCandidate()) {
            try {
              const intentUrl = buildSceneViewerIntentUrl(modelGlbSrc, item.name);
              const anchor = document.createElement('a');
              anchor.setAttribute('href', intentUrl);
              anchor.style.display = 'none';
              document.body.appendChild(anchor);
              anchor.click();
              window.setTimeout(() => anchor.remove(), 100);
              return true;
            } catch {
              onARUnsupported?.(
                'Could not launch AR. Make sure Google Play Services for AR is installed and updated.'
              );
              return false;
            }
          }
          onARUnsupported?.(
            'Open this menu in Google Chrome on Android with Google Play Services for AR to place dishes on your table.'
          );
          return false;
        }

        // ── iOS: Use model-viewer's activateAR for USDZ auto-generation ──
        // Wait briefly for async $selectARMode() if Quick Look hasn't resolved yet
        if (el.canActivateAR) {
          try {
            await el.activateAR();
            return true;
          } catch {
            // Fall through
          }
        }

        for (let attempt = 0; attempt < 6; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 50));
          if (el.canActivateAR) {
            try {
              await el.activateAR();
              return true;
            } catch {
              break;
            }
          }
        }

        onARUnsupported?.(
          'AR Quick Look could not start. Try opening in Safari to place on your table.'
        );
        return false;
      },
      resetView
    }));

    const radius = 15;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (loadProgress / 100) * circumference;

    return (
      <div
        className={`relative flex h-full w-full items-center justify-center overflow-hidden studio-spotlight select-none ${className}`}
        style={{ perspective: 1400 }}
        onPointerDown={() => setShowGestureHint(false)}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(217,107,39,0.10),transparent_58%)]"
        />

        <AnimatePresence mode="popLayout">
          <motion.div
            key={item.id}
            initial={{ opacity: 0.7, scale: 1.05, clipPath: 'circle(8% at 50% 50%)' }}
            animate={{ opacity: 1, scale: 1, clipPath: 'circle(145% at 50% 50%)' }}
            exit={{ opacity: 0, scale: 0.97, clipPath: 'circle(0% at 50% 50%)' }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 h-full w-full overflow-hidden"
          >
            {/* Expanding Saffron Spotlight Iris Ring */}
            <motion.div
              aria-hidden="true"
              initial={{ scale: 0.18, opacity: 0.85 }}
              animate={{ scale: 2.1, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute inset-0 z-20 m-auto h-56 w-56 rounded-full border-2 border-[#F4A26E]/65 shadow-[0_0_48px_rgba(217,107,39,0.55)]"
            />

            {hasInteractive3D && hasAR ? (
              <model-viewer
                ref={viewerRef}
                src={modelGlbSrc}
                ios-src={modelUsdzSrc}
                poster={item.poster}
                alt={`${item.name} studio dish preview`}
                ar
                ar-modes="scene-viewer webxr quick-look"
                ar-scale="fixed"
                ar-placement="floor"
                reveal="auto"
                camera-controls
                shadow-intensity="1.2"
                shadow-softness="0.85"
                exposure="1.0"
                environment-image="neutral"
                camera-orbit={DEFAULT_ORBIT}
                field-of-view="24deg"
                min-camera-orbit="auto 16deg 55%"
                max-camera-orbit="auto 80deg 115%"
                interaction-prompt="none"
                touch-action="pan-y"
                loading="eager"
                className="relative z-10 h-full w-full"
              >
                {item.poster && (
                  <div
                    slot="poster"
                    className="relative h-full w-full overflow-hidden bg-[#08080A]"
                  >
                    <img
                      src={item.poster}
                      alt={item.name}
                      className="h-full w-full object-cover object-center"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/65"
                    />
                  </div>
                )}
                <span slot="ar-button" className="hidden" aria-hidden="true" />
              </model-viewer>
            ) : hasAR && item.poster ? (
              <div className="relative z-10 h-full w-full overflow-hidden bg-[#08080A]">
                <img
                  src={item.poster}
                  alt={item.name}
                  loading="eager"
                  decoding="sync"
                  className="h-full w-full object-cover object-center"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/65"
                />
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>

        {/* Full-size AR model-viewer outside Iris animation so WebXR DOMOverlay is never clipped */}
        {hasAR && !hasInteractive3D && (
          <div
            className={`absolute inset-0 overflow-hidden transition-opacity ${
              isPresentingAR ? 'pointer-events-auto z-30 opacity-100' : 'pointer-events-none z-0 opacity-0'
            }`}
            aria-hidden={!isPresentingAR}
          >
            <model-viewer
              key={`ar-engine-${item.id}`}
              ref={viewerRef}
              src={modelGlbSrc}
              ios-src={modelUsdzSrc}
              alt={`${item.name} AR engine`}
              ar
              ar-modes="webxr scene-viewer quick-look"
              ar-scale="fixed"
              ar-placement="floor"
              shadow-intensity="1.2"
              shadow-softness="0.85"
              environment-image="neutral"
              reveal="manual"
              loading="eager"
              className="h-full w-full"
            >
              <span slot="ar-button" className="hidden" aria-hidden="true" />
            </model-viewer>
          </div>
        )}

        {/* Minimalist Spatial AR Viewfinder Corner Brackets */}
        {hasAR && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-3.5 z-10">
            <span className="absolute left-0 top-0 h-4 w-4 rounded-tl-lg border-l border-t border-white/25" />
            <span className="absolute right-0 top-0 h-4 w-4 rounded-tr-lg border-r border-t border-white/25" />
            <span className="absolute bottom-0 left-0 h-4 w-4 rounded-bl-lg border-b border-l border-white/25" />
            <span className="absolute bottom-0 right-0 h-4 w-4 rounded-br-lg border-b border-r border-white/25" />
          </div>
        )}

        {/* Interactive Culinary Sensory Hotspot (QReal / 8th Wall spatial pattern) */}
        {hasAR && item.description && !hasInteractive3D && (
          <div className="absolute right-5 top-1/2 z-20 -translate-y-1/2">
            <button
              type="button"
              onClick={() => setShowHotspotCard((prev) => !prev)}
              aria-label="Inspect culinary details"
              className="group relative flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-black/55 backdrop-blur-md transition hover:scale-110 active:scale-95"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D96B27]/45" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-[#D96B27] shadow-[0_0_10px_#D96B27]" />
            </button>

            <AnimatePresence>
              {showHotspotCard && (
                <motion.div
                  initial={{ opacity: 0, x: 8, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 8, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="liquid-glass absolute right-12 top-1/2 w-56 -translate-y-1/2 rounded-2xl border border-white/20 p-3 text-left"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#F4A26E]">
                    Kitchen Notes • {item.realWorldDimensions ?? '1:1 Scale'}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#F7F3EC]/90">
                    {item.description}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {!hasAR && (
          <div className="relative z-10 flex flex-col items-center px-8 text-center">
            <div className="liquid-glass-card flex h-24 w-24 items-center justify-center rounded-3xl border border-white/15">
              <Box className="h-9 w-9 text-[#D96B27]/85" />
            </div>
            <p className="mt-5 font-serif text-2xl font-semibold text-[#F7F3EC]">
              {item.name}
            </p>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-[#A8A29E]">
              Freshly prepared to order in our Bengaluru kitchen. Select any dish marked{' '}
              <span className="font-semibold text-[#F4A26E]">3D / AR</span> to inspect it or place it on your table.
            </p>
          </div>
        )}

        {/* Saffron Progress Ring (only when streaming a real 360° 3D scan) */}
        <AnimatePresence>
          {hasInteractive3D && !isLoaded && !hasError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="liquid-glass-pill pointer-events-none absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5"
            >
              <svg className="h-5 w-5 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                <circle
                  cx="18"
                  cy="18"
                  r={radius}
                  fill="none"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r={radius}
                  fill="none"
                  stroke="#D96B27"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>
              <span className="text-[11px] font-medium tabular-nums text-[#F7F3EC]/90">
                Loading 3D {loadProgress > 0 ? `${loadProgress}%` : ''}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Top-Left Glass Pills (PPT Entrance) */}
        {showMetadataPills && (
          <motion.div
            key={`pills-${item.id}`}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2 pr-14"
          >
            <span className="liquid-glass-pill inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-[#F7F3EC]">
              <DietaryBadge type={item.diet} showLabel />
            </span>
            {hasAR && (
              <span className="liquid-glass-pill inline-flex items-center gap-1.5 rounded-full border border-[#D96B27]/40 px-3 py-1.5 text-xs font-medium text-[#F4A26E]">
                <Sparkles className="h-3 w-3 text-[#D96B27]" />
                1:1 • {item.realWorldDimensions ?? 'True Scale'}
              </span>
            )}
          </motion.div>
        )}

        {/* Reset View Button (only if an item uses a custom Polycam/Luma 3D scan) */}
        {showMetadataPills && hasInteractive3D && (
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
            <button
              type="button"
              onClick={resetView}
              className="liquid-glass-pill inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-white/20 px-3.5 text-xs font-medium text-[#F7F3EC]/95 transition hover:border-white/30 active:scale-95"
            >
              <RotateCcw className="h-3.5 w-3.5 text-[#D96B27]" />
              Reset View
            </button>
          </div>
        )}

        {/* Auto-dismissing 360° Gesture Hint (only for interactive 360° 3D scans) */}
        <AnimatePresence>
          {hasInteractive3D && showGestureHint && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.25 }}
              className="liquid-glass-pill pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-medium text-[#F7F3EC]/90"
            >
              <span className="inline-flex items-center gap-1.5">
                <Move3d className="h-3.5 w-3.5 text-[#D96B27]" />
                Drag to inspect dish
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
