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
import { DietaryBadge } from './DietaryBadge';

export interface ModelViewerStageHandle {
  activateAR: () => Promise<boolean>;
  resetView: () => void;
}

interface ModelViewerStageProps {
  item: MenuItem;
  showMetadataPills?: boolean;
  className?: string;
  onARUnsupported?: () => void;
}

const DEFAULT_ORBIT = '0deg 60deg 105%';

/**
 * Shared 3D & WebAR Dish Studio Stage powered by @google/model-viewer.
 * Displays the high-contrast studio food photograph cleanly while keeping
 * 1:1 WebAR ("View on Your Table") ready; auto-reveals 360° 3D mesh when
 * `item.hasCustom3DScan` is enabled with a real Polycam/Luma scan.
 */
export const ModelViewerStage = forwardRef<ModelViewerStageHandle, ModelViewerStageProps>(
  function ModelViewerStage(
    { item, showMetadataPills = true, className = '', onARUnsupported },
    ref
  ) {
    const viewerRef = useRef<ModelViewerElement | null>(null);
    const [loadProgress, setLoadProgress] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [showGestureHint, setShowGestureHint] = useState(false);

    const hasAR = Boolean(item.hasAR && item.modelGlb);
    const hasInteractive3D = Boolean(hasAR && item.hasCustom3DScan);
    const modelGlbSrc = item.modelGlb ? `${item.modelGlb}?v=5` : undefined;
    const modelUsdzSrc = item.modelUsdz ? `${item.modelUsdz}?v=5` : undefined;

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
        if (el && el.canActivateAR) {
          await el.activateAR();
          return true;
        }
        onARUnsupported?.();
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
            ar-modes="webxr scene-viewer quick-look"
            ar-scale="fixed"
            ar-placement="floor"
            reveal={hasInteractive3D ? 'auto' : 'manual'}
            camera-controls
            auto-rotate
            auto-rotate-delay="1200"
            rotation-per-second="14deg"
            shadow-intensity="1.2"
            shadow-softness="0.85"
            exposure="1.0"
            environment-image="neutral"
            camera-orbit={DEFAULT_ORBIT}
            min-camera-orbit="auto 20deg auto"
            max-camera-orbit="auto 80deg auto"
            interaction-prompt="none"
            touch-action="pan-y"
            loading={hasInteractive3D ? 'eager' : 'lazy'}
            className="relative z-10 h-full w-full"
          >
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
                Drag to inspect dish
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
