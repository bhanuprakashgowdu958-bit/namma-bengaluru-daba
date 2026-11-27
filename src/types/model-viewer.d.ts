import type React from 'react';

export interface ModelViewerElement extends HTMLElement {
  src?: string;
  'ios-src'?: string;
  poster?: string;
  alt?: string;
  ar?: boolean;
  'ar-modes'?: string;
  'ar-scale'?: 'auto' | 'fixed';
  'ar-placement'?: 'floor' | 'wall';
  'camera-controls'?: boolean;
  'auto-rotate'?: boolean;
  'shadow-intensity'?: string | number;
  'environment-image'?: string;
  'camera-orbit'?: string;
  cameraOrbit?: string;
  'field-of-view'?: string;
  fieldOfView?: string;
  'touch-action'?: string;
  loading?: 'auto' | 'lazy' | 'eager';
  readonly canActivateAR: boolean;
  readonly loaded: boolean;
  readonly model?: {
    materials?: Array<{
      name: string;
      pbrMetallicRoughness: {
        setBaseColorFactor: (rgba: [number, number, number, number]) => void;
      };
    }>;
  };
  activateAR: () => Promise<void>;
  resetTurntableRotation: () => void;
  jumpCameraToGoal: () => void;
}

interface ModelViewerAttributes
  extends React.DetailedHTMLProps<React.HTMLAttributes<ModelViewerElement>, ModelViewerElement> {
  src?: string;
  'ios-src'?: string;
  poster?: string;
  alt?: string;
  ar?: boolean | string;
  'ar-modes'?: string;
  'ar-scale'?: 'auto' | 'fixed';
  'ar-placement'?: 'floor' | 'wall';
  'camera-controls'?: boolean | string;
  'auto-rotate'?: boolean | string;
  'auto-rotate-delay'?: number | string;
  'rotation-per-second'?: string;
  'shadow-intensity'?: string | number;
  'shadow-softness'?: string | number;
  exposure?: string | number;
  'environment-image'?: string;
  'camera-orbit'?: string;
  'min-camera-orbit'?: string;
  'max-camera-orbit'?: string;
  'field-of-view'?: string;
  'interaction-prompt'?: 'auto' | 'none';
  'touch-action'?: string;
  loading?: 'auto' | 'lazy' | 'eager';
  reveal?: 'auto' | 'manual';
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': ModelViewerAttributes;
    }
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': ModelViewerAttributes;
    }
  }
}
