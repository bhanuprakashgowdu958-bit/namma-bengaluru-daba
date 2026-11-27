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
  getVersionedModelUrl,
  isAndroidDevice,
  isIOSDevice
} from '../utils/device';
import { DietaryBadge } from './DietaryBadge';

export interface ModelViewerStageHandle {
  activateAR: () => Promise<boolean>;
  reveal3D: () => void;
  resetView: () => void;
}

interface ModelViewerStageProps {
  item: MenuItem;
  showMetadataPills?: boolean;
  touchAction?: 'none' | 'pan-y';
  className?: string;
  onARUnsupported?: (reason?: string) => void;
  onARFailed?: (reason: string) => void;
}

const DEFAULT_ORBIT = '0deg 46deg 102%';

/**
 * Shared 3D & WebAR Dish Studio Stage powered by @google/model-viewer.
 * Renders each dish on matte dark stoneware matching the menu photograph with
 * full 360° interactive spin, auto-rotate showcase, and 1:1 WebAR tabletop placement.
 */
export const ModelViewerStage = forwardRef<ModelViewerStageHandle, ModelViewerStageProps>(
  function ModelViewerStage(
    {
      item,
      showMetadataPills = true,
      touchAction = 'pan-y',
      className = '',
      onARUnsupported,
      onARFailed
    },
    ref
  ) {
    const viewerRef = useRef<ModelViewerElement | null>(null);
    const onARFailedRef = useRef(onARFailed);
    onARFailedRef.current = onARFailed;

    const [loadProgress, setLoadProgress] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [showGestureHint, setShowGestureHint] = useState(false);
    const [arTrackingNote, setArTrackingNote] = useState<string | null>(null);

    const hasAR = Boolean(item.hasAR && item.modelGlb);
    const hasInteractive3D = hasAR;
    const modelGlbSrc = item.modelGlb ? getVersionedModelUrl(item.modelGlb) : undefined;
    // Omit missing static /models/*.usdz paths so @google/model-viewer auto-exports USDZ on iOS via prepareUSDZ()
    const modelUsdzSrc =
      item.modelUsdz && !item.modelUsdz.startsWith('/models/')
        ? getVersionedModelUrl(item.modelUsdz)
        : undefined;

    useEffect(() => {
      setLoadProgress(0);
      setIsLoaded(false);
      setHasError(false);
      setArTrackingNote(null);
      setShowGestureHint(hasInteractive3D);

      if (!hasInteractive3D) return;
      const timer = window.setTimeout(() => {
        setShowGestureHint(false);
      }, 2800);

      return () => window.clearTimeout(timer);
    }, [item.id, hasInteractive3D]);

    useEffect(() => {
      const handleFallbackHash = () => {
        if (
          window.location.hash === '#model-viewer-no-ar-fallback' ||
          window.location.hash === '#ar-fallback'
        ) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          viewerRef.current?.dismissPoster?.();
          onARFailedRef.current?.(
            'Scene Viewer could not load this dish model. Make sure Google Play Services for AR is updated and point at a flat, well-lit table.'
          );
        }
      };

      handleFallbackHash();
      window.addEventListener('hashchange', handleFallbackHash);

      const el = viewerRef.current;
      const handleArStatus = (event: Event) => {
        const customEvent = event as CustomEvent<{ status?: string }>;
        const status = customEvent.detail?.status;
        if (status === 'failed') {
          setArTrackingNote(null);
          el?.dismissPoster?.();
          onARFailedRef.current?.(
            'AR session could not start on this device. Interactive 360° 3D view is active above.'
          );
        } else if (status === 'session-started') {
          setArTrackingNote('Slowly aim at a flat, well-lit dining table to lock in place');
        } else if (status === 'object-placed') {
          setArTrackingNote('Surface locked • Drag to move, twist 2 fingers to rotate 360°');
        } else if (status === 'not-presenting') {
          setArTrackingNote(null);
        }
      };

      const handleArTracking = (event: Event) => {
        const customEvent = event as CustomEvent<{ status?: string }>;
        if (customEvent.detail?.status === 'not-tracking') {
          setArTrackingNote('Keep camera over a flat, textured table (avoid keyboards/glass)');
        }
      };

      el?.addEventListener('ar-status', handleArStatus);
      el?.addEventListener('ar-tracking', handleArTracking);
      return () => {
        window.removeEventListener('hashchange', handleFallbackHash);
        el?.removeEventListener('ar-status', handleArStatus);
        el?.removeEventListener('ar-tracking', handleArTracking);
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

    const reveal3D = () => {
      viewerRef.current?.dismissPoster?.();
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
          reveal3D();
          onARUnsupported?.(
            'AR requires a mobile phone. Scan the QR code on your phone, or drag above to inspect in 3D.'
          );
          return false;
        }

        // ── ANDROID: Always launch Scene Viewer directly ──
        // Bypass model-viewer's el.activateAR() entirely on Android because:
        // 1) $selectARMode() is async and may not have resolved (canActivateAR = false)
        // 2) model-viewer's $openSceneViewer uses an internal $arAnchor that may
        //    silently fail or expire the user-gesture token
        // Scene Viewer downloads the GLB independently, so no local model load needed.
        if (isAndroidDevice()) {
          try {
            const intentUrl = buildSceneViewerIntentUrl(modelGlbSrc, item.name);
            const anchor = document.createElement('a');
            anchor.setAttribute('href', intentUrl);
            anchor.style.display = 'none';
            document.body.appendChild(anchor);
            anchor.click();
            // Clean up after a tick
            window.setTimeout(() => anchor.remove(), 100);
            return true;
          } catch {
            reveal3D();
            onARUnsupported?.(
              'Could not launch AR. Make sure Google Play Services for AR is installed and updated.'
            );
            return false;
          }
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

        reveal3D();
        onARUnsupported?.(
          'AR Quick Look could not start. Try opening in Safari, or drag above to inspect in 3D.'
        );
        return false;
      },
      reveal3D,
      resetView
    }));

    const radius = 15;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (loadProgress / 100) * circumference;

    return (
      <div
        className={`relative flex h-full w-full items-center justify-center overflow-hidden studio-spotlight select-none ${className}`}
        onPointerDown={() => setShowGestureHint(false)}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(217,107,39,0.10),transparent_58%)]"
        />

        {hasAR ? (
          <model-viewer
            key={item.id}
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
            auto-rotate
            auto-rotate-delay="500"
            rotation-per-second="18deg"
            shadow-intensity="1.2"
            shadow-softness="0.85"
            exposure="1.05"
            environment-image="neutral"
            camera-orbit={DEFAULT_ORBIT}
            min-camera-orbit="auto 14deg auto"
            max-camera-orbit="auto 84deg auto"
            interaction-prompt="none"
            touch-action={touchAction}
            loading="eager"
            className="relative z-10 h-full w-full"
          >
            {arTrackingNote && (
              <div className="pointer-events-none absolute left-1/2 top-16 z-30 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-[#12100E]/85 px-3.5 py-1.5 text-[11px] font-medium text-[#F7F3EC] backdrop-blur-xl">
                {arTrackingNote}
              </div>
            )}
            {/* Full-bleed Studio Food Photograph Poster Slot (zero side gaps) */}
            {item.poster && (
              <div
                slot="poster"
                className="relative h-full w-full overflow-hidden bg-[#12100E]"
              >
                <img
                  src={item.poster}
                  alt={item.name}
                  className="h-full w-full object-cover object-center"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#12100E]/50 via-transparent to-[#12100E]/55"
                />
              </div>
            )}
            <span slot="ar-button" className="hidden" aria-hidden="true" />
          </model-viewer>
        ) : (
          <div className="relative z-10 flex flex-col items-center px-8 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-white/10 bg-[#1C1917]/80 shadow-glass">
              <Box className="h-9 w-9 text-[#D96B27]/80" />
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
              className="pointer-events-none absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-[#1C1917]/85 px-3 py-1.5 backdrop-blur-xl"
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

        {/* Floating Top-Left Glass Pills */}
        {showMetadataPills && (
          <div className="pointer-events-none absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2 pr-14">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#1C1917]/80 px-3 py-1.5 text-xs font-medium text-[#F7F3EC] backdrop-blur-xl">
              <DietaryBadge type={item.diet} showLabel />
            </span>
            {hasAR && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D96B27]/35 bg-[#1C1917]/80 px-3 py-1.5 text-xs font-medium text-[#F4A26E] backdrop-blur-xl">
                <Sparkles className="h-3 w-3 text-[#D96B27]" />
                1:1 • {item.realWorldDimensions ?? 'True Scale'}
              </span>
            )}
          </div>
        )}

        {/* Reset View Button (for interactive 360° 3D scans) */}
        {showMetadataPills && hasInteractive3D && (
          <button
            type="button"
            onClick={resetView}
            className="absolute bottom-4 left-4 z-20 inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/10 bg-[#1C1917]/85 px-3.5 text-xs font-medium text-[#F7F3EC]/95 backdrop-blur-xl transition hover:border-white/20 hover:bg-[#1C1917] active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#D96B27]" />
            Reset View
          </button>
        )}

        {/* Auto-dismissing 360° Gesture Hint (only for interactive 360° 3D scans) */}
        <AnimatePresence>
          {hasInteractive3D && showGestureHint && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.25 }}
              className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-[#1C1917]/85 px-3.5 py-1.5 text-xs font-medium text-[#F7F3EC]/90 backdrop-blur-xl shadow-glass"
            >
              <span className="inline-flex items-center gap-1.5">
                <Move3d className="h-3.5 w-3.5 text-[#D96B27]" />
                Drag 360° to inspect dish
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
