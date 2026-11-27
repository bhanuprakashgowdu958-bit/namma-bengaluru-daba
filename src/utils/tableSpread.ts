import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import type { CartItem } from '../types/menu';
import { getVersionedModelUrl } from './device';

export interface TableSpreadResult {
  glbUrl: string;
  usdzUrl?: string;
  plateCount: number;
  estimatedWidthCm: number;
  cleanup: () => void;
}

const loader = new GLTFLoader();
const templateCache = new Map<string, Promise<THREE.Group>>();

function loadDishTemplate(url: string): Promise<THREE.Group> {
  const cached = templateCache.get(url);
  if (cached) return cached;

  const promise = new Promise<THREE.Group>((resolve, reject) => {
    loader.load(
      url,
      (gltf) => resolve(gltf.scene),
      undefined,
      (err) => {
        templateCache.delete(url);
        reject(err);
      }
    );
  });

  templateCache.set(url, promise);
  return promise;
}

interface PlateSpec {
  url: string;
  poster?: string;
  label: string;
}

const posterTextureCache = new Map<string, Promise<THREE.Texture | null>>();

function loadPosterPlateTexture(posterUrl: string): Promise<THREE.Texture | null> {
  const cached = posterTextureCache.get(posterUrl);
  if (cached) return cached;

  const promise = new Promise<THREE.Texture | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        // Crop cleanly into the dish plate composition so the studio photo fills the stoneware plate
        const cropFraction = 0.84;
        const sw = img.naturalWidth * cropFraction;
        const sh = img.naturalHeight * cropFraction;
        const sx = (img.naturalWidth - sw) * 0.5;
        const sy = (img.naturalHeight - sh) * 0.54;

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = false;
        tex.needsUpdate = true;
        resolve(tex);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = posterUrl;
  });

  posterTextureCache.set(posterUrl, promise);
  return promise;
}

function expandCartToPlates(items: CartItem[]): PlateSpec[] {
  const MAX_PLATES = 8;
  const totalQty = items.reduce((sum, entry) => sum + entry.quantity, 0);
  const plates: PlateSpec[] = [];

  const toPlate = (entry: CartItem): PlateSpec => {
    const rawUrl = entry.item.modelGlb || '/models/dal-tadka.glb';
    const glbSlug = rawUrl.replace(/^\/models\//, '').replace(/\.glb$/, '');
    const posterSlug = entry.item.poster?.replace(/^\/posters\//, '').replace(/\.jpg$/, '');
    const needsFallbackTexture = Boolean(entry.item.poster && glbSlug !== posterSlug);
    return {
      url: getVersionedModelUrl(rawUrl),
      poster: needsFallbackTexture ? entry.item.poster : undefined,
      label: entry.item.name
    };
  };

  if (totalQty <= MAX_PLATES) {
    for (const entry of items) {
      const spec = toPlate(entry);
      for (let i = 0; i < entry.quantity; i++) {
        plates.push(spec);
      }
    }
    return plates;
  }

  for (const entry of items) {
    if (plates.length >= MAX_PLATES) break;
    plates.push(toPlate(entry));
  }
  return plates;
}

/**
 * Builds a shareable URL encoding the current Table Tray items for Desktop -> Mobile QR handoff.
 */
export function getSpreadDeepLinkUrl(items: CartItem[]): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.delete('dish');
  const encoded = items
    .map((e) => `${e.item.id}:${e.variant.label}:${e.quantity}`)
    .join(',');
  url.searchParams.set('spread', encoded);
  return url.toString();
}

/**
 * Loads all dishes in the customer's Table Tray, arranges them snugly at true 1:1
 * relative physical scale, and exports a combined GLB (+ USDZ for iOS).
 */
export async function buildTableSpreadModels(
  items: CartItem[]
): Promise<TableSpreadResult> {
  const plates = expandCartToPlates(items);
  if (plates.length === 0) {
    throw new Error('Table tray is empty');
  }

  const [templates, posterTextures] = await Promise.all([
    Promise.all(plates.map((p) => loadDishTemplate(p.url))),
    Promise.all(plates.map((p) => (p.poster ? loadPosterPlateTexture(p.poster) : Promise.resolve(null))))
  ]);
  const root = new THREE.Group();
  root.name = 'NammaBengaluruTableSpread';

  const prepared = templates.map((tpl, idx) => {
    const clone = tpl.clone(true);
    const posterTex = posterTextures[idx];

    if (posterTex) {
      clone.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const mat = child.material as THREE.MeshStandardMaterial | undefined;
        if (child.name === 'FoodMound' || mat?.name === 'FoodSurface') {
          const geom = child.geometry.clone();
          geom.computeBoundingBox();
          const gBox = geom.boundingBox;
          const pos = geom.attributes.position;
          const uv = geom.attributes.uv;
          if (pos && uv && gBox) {
            const radius =
              Math.max(
                Math.abs(gBox.max.x),
                Math.abs(gBox.min.x),
                Math.abs(gBox.max.z),
                Math.abs(gBox.min.z)
              ) || 0.107;
            for (let i = 0; i < pos.count; i++) {
              const x = pos.getX(i);
              const z = pos.getZ(i);
              uv.setXY(i, (x / radius) * 0.5 + 0.5, (z / radius) * 0.5 + 0.5);
            }
            uv.needsUpdate = true;
          }
          child.geometry = geom;

          if (mat) {
            const nextMat = mat.clone();
            nextMat.map = posterTex;
            nextMat.needsUpdate = true;
            child.material = nextMat;
          }
        }
      });
    }

    const box = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    clone.position.x -= center.x;
    clone.position.z -= center.z;
    clone.position.y -= box.min.y;

    const wrapper = new THREE.Group();
    wrapper.add(clone);
    const footprintRadius = Math.max(size.x, size.z) * 0.5 || 0.12;
    return { wrapper, footprintRadius };
  });

  // Cozy restaurant spread spacing (~2.5cm rim-to-rim gap)
  const maxR = Math.max(...prepared.map((p) => p.footprintRadius), 0.12);
  const spacing = maxR * 2 + 0.025;

  const count = prepared.length;
  const cols = count === 1 ? 1 : count <= 4 ? 2 : count <= 6 ? 3 : 4;
  const rows = Math.ceil(count / cols);

  prepared.forEach(({ wrapper }, idx) => {
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const itemsInRow = row === rows - 1 ? count - row * cols : cols;

    const x = (col - (itemsInRow - 1) / 2) * spacing;
    const z = (row - (rows - 1) / 2) * spacing;

    wrapper.position.set(x, 0, z);
    root.add(wrapper);
  });

  const totalBox = new THREE.Box3().setFromObject(root);
  const totalSize = new THREE.Vector3();
  totalBox.getSize(totalSize);
  const estimatedWidthCm = Math.round(totalSize.x * 100);

  const gltfExporter = new GLTFExporter();
  const glbBuffer = (await gltfExporter.parseAsync(root, {
    binary: true
  })) as ArrayBuffer;
  const glbBlob = new Blob([glbBuffer], { type: 'model/gltf-binary' });
  const glbUrl = URL.createObjectURL(glbBlob);

  let usdzUrl: string | undefined;
  try {
    const usdzExporter = new USDZExporter();
    const usdzBytes = await usdzExporter.parseAsync(root);
    const usdzBlob = new Blob([new Uint8Array(usdzBytes)], {
      type: 'model/vnd.usdz+zip'
    });
    usdzUrl = URL.createObjectURL(usdzBlob);
  } catch {
    usdzUrl = undefined;
  }

  const cleanup = () => {
    URL.revokeObjectURL(glbUrl);
    if (usdzUrl) URL.revokeObjectURL(usdzUrl);
  };

  return {
    glbUrl,
    usdzUrl,
    plateCount: count,
    estimatedWidthCm,
    cleanup
  };
}
