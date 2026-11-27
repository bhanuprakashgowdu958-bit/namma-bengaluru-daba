import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import type { CartItem } from '../types/menu';

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
  label: string;
}

function expandCartToPlates(items: CartItem[]): PlateSpec[] {
  const MAX_PLATES = 8;
  const totalQty = items.reduce((sum, entry) => sum + entry.quantity, 0);
  const plates: PlateSpec[] = [];

  if (totalQty <= MAX_PLATES) {
    for (const entry of items) {
      const url = entry.item.modelGlb
        ? `${entry.item.modelGlb}?v=5`
        : '/models/dal-tadka.glb?v=5';
      for (let i = 0; i < entry.quantity; i++) {
        plates.push({ url, label: entry.item.name });
      }
    }
    return plates;
  }

  for (const entry of items) {
    if (plates.length >= MAX_PLATES) break;
    const url = entry.item.modelGlb
      ? `${entry.item.modelGlb}?v=5`
      : '/models/dal-tadka.glb?v=5';
    plates.push({ url, label: entry.item.name });
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

  const templates = await Promise.all(plates.map((p) => loadDishTemplate(p.url)));
  const root = new THREE.Group();
  root.name = 'NammaBengaluruTableSpread';

  const prepared = templates.map((tpl) => {
    const clone = tpl.clone(true);
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
