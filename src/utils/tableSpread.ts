import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import type { CartItem } from '../types/menu';

export interface TableSpreadResult {
  /** 3D White Bistro Table + dishes for screen preview */
  glbUrl: string;
  /** Dishes only (no table slab) for placing onto the customer's real physical table in AR */
  arGlbUrl: string;
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

        // Crisp inner-plate crop so food fills the sculpted artisan stoneware plate cleanly against a white table
        const cropFraction = 0.78;
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

  if (totalQty <= MAX_PLATES) {
    for (const entry of items) {
      const url = entry.item.modelGlb
        ? `${entry.item.modelGlb}?v=10`
        : '/models/dal-tadka.glb?v=10';
      for (let i = 0; i < entry.quantity; i++) {
        plates.push({ url, poster: entry.item.poster, label: entry.item.name });
      }
    }
    return plates;
  }

  for (const entry of items) {
    if (plates.length >= MAX_PLATES) break;
    const url = entry.item.modelGlb
      ? `${entry.item.modelGlb}?v=10`
      : '/models/dal-tadka.glb?v=10';
    plates.push({ url, poster: entry.item.poster, label: entry.item.name });
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

function createWhiteMarbleTableTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const radial = ctx.createRadialGradient(
      size * 0.48,
      size * 0.45,
      size * 0.05,
      size * 0.5,
      size * 0.5,
      size * 0.52
    );
    radial.addColorStop(0, '#FFFFFF');
    radial.addColorStop(0.65, '#F6F4EF');
    radial.addColorStop(1, '#ECE7DF');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, size, size);

    // Subtle fine marble mineral veins
    ctx.strokeStyle = 'rgba(176, 168, 158, 0.14)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      let x = (i * 73) % size;
      let y = 0;
      ctx.moveTo(x, y);
      for (let step = 0; step < 8; step++) {
        x += Math.sin(step * 1.3 + i) * 36;
        y += size / 8;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Loads all dishes in the customer's Table Tray, arranges them snugly at true 1:1
 * relative physical scale, and exports:
 * - `glbUrl`: dishes resting cleanly on a bright 3D White Restaurant Table for screen preview
 * - `arGlbUrl` + `usdzUrl`: dishes alone (without white table) for native tabletop AR
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
  const totalCenter = new THREE.Vector3();
  totalBox.getSize(totalSize);
  totalBox.getCenter(totalCenter);
  const estimatedWidthCm = Math.round(totalSize.x * 100);

  const gltfExporter = new GLTFExporter();

  // Export clean AR model (plates only, no white table) first
  const arGlbBuffer = (await gltfExporter.parseAsync(root, {
    binary: true
  })) as ArrayBuffer;
  const arGlbBlob = new Blob([arGlbBuffer], { type: 'model/gltf-binary' });
  const arGlbUrl = URL.createObjectURL(arGlbBlob);

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

  // Now wrap the scene onto a bright 3D White Marble Bistro Table for screen preview
  const previewRoot = new THREE.Group();
  previewRoot.name = 'NammaBengaluruWhiteTablePreview';
  previewRoot.add(root);

  const spreadSpan = Math.max(totalSize.x, totalSize.z);
  const tableRadius = Math.max(0.27, spreadSpan * 0.5 + 0.14);
  const tableThickness = 0.022;

  const tableTopGeo = new THREE.CylinderGeometry(tableRadius, tableRadius * 0.985, tableThickness, 72);
  const marbleTex = createWhiteMarbleTableTexture();
  const tableMat = new THREE.MeshStandardMaterial({
    name: 'WhiteBistroTable',
    map: marbleTex,
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0.02
  });
  const tableMesh = new THREE.Mesh(tableTopGeo, tableMat);
  tableMesh.position.set(totalCenter.x, -tableThickness * 0.5 - 0.0005, totalCenter.z);
  tableMesh.name = 'WhiteDiningTable';
  previewRoot.add(tableMesh);

  // Subtle warm champagne-steel table edge trim
  const trimGeo = new THREE.TorusGeometry(tableRadius * 0.998, 0.0022, 10, 72);
  trimGeo.rotateX(Math.PI / 2);
  const trimMat = new THREE.MeshStandardMaterial({
    name: 'WhiteTableTrim',
    color: 0xd8d2c9,
    roughness: 0.35,
    metalness: 0.25
  });
  const trimMesh = new THREE.Mesh(trimGeo, trimMat);
  trimMesh.position.set(totalCenter.x, -0.001, totalCenter.z);
  previewRoot.add(trimMesh);

  const previewGlbBuffer = (await gltfExporter.parseAsync(previewRoot, {
    binary: true
  })) as ArrayBuffer;
  const previewGlbBlob = new Blob([previewGlbBuffer], { type: 'model/gltf-binary' });
  const glbUrl = URL.createObjectURL(previewGlbBlob);

  const cleanup = () => {
    URL.revokeObjectURL(glbUrl);
    URL.revokeObjectURL(arGlbUrl);
    if (usdzUrl) URL.revokeObjectURL(usdzUrl);
  };

  return {
    glbUrl,
    arGlbUrl,
    usdzUrl,
    plateCount: count,
    estimatedWidthCm,
    cleanup
  };
}
