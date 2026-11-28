import fs from 'node:fs/promises';
import path from 'node:path';

const GLB_MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK_TYPE = 0x4e4f534a; // "JSON"
const BIN_CHUNK_TYPE = 0x004e4942; // "BIN\0"
const MAX_PLATES = 8;

const templateCache = new Map();

function parseGlb(buffer) {
  if (buffer.length < 20) {
    throw new Error('GLB buffer too small');
  }
  const magic = buffer.readUInt32LE(0);
  const version = buffer.readUInt32LE(4);
  if (magic !== GLB_MAGIC || version !== 2) {
    throw new Error('Invalid glTF 2.0 binary');
  }

  let offset = 12;
  let gltf = null;
  let bin = Buffer.alloc(0);

  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > buffer.length) break;

    if (chunkType === JSON_CHUNK_TYPE) {
      gltf = JSON.parse(buffer.subarray(chunkStart, chunkEnd).toString('utf8'));
    } else if (chunkType === BIN_CHUNK_TYPE) {
      bin = buffer.subarray(chunkStart, chunkEnd);
    }

    offset = chunkEnd;
  }

  if (!gltf) {
    throw new Error('Missing JSON chunk in GLB');
  }

  return { gltf, bin };
}

async function loadModelBuffer(slug, hostHeader) {
  if (templateCache.has(slug)) {
    return templateCache.get(slug);
  }

  const localPath = path.join(process.cwd(), 'public', 'models', `${slug}.glb`);
  let buf = null;

  try {
    buf = await fs.readFile(localPath);
  } catch {
    if (hostHeader) {
      const protocol = hostHeader.startsWith('localhost') ? 'http' : 'https';
      const resp = await fetch(`${protocol}://${hostHeader}/models/${slug}.glb`);
      if (resp.ok) {
        buf = Buffer.from(await resp.arrayBuffer());
      }
    }
  }

  if (!buf) {
    throw new Error(`Model not found: ${slug}`);
  }

  const parsed = parseGlb(buf);
  templateCache.set(slug, parsed);
  return parsed;
}

function computeModelBounds(gltf) {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const acc of gltf.accessors ?? []) {
    if (acc.type === 'VEC3' && Array.isArray(acc.min) && Array.isArray(acc.max)) {
      minX = Math.min(minX, acc.min[0]);
      minY = Math.min(minY, acc.min[1]);
      minZ = Math.min(minZ, acc.min[2]);
      maxX = Math.max(maxX, acc.max[0]);
      maxY = Math.max(maxY, acc.max[1]);
      maxZ = Math.max(maxZ, acc.max[2]);
    }
  }

  if (!Number.isFinite(minX)) {
    return { cx: 0, minY: 0, cz: 0, footprintRadius: 0.12 };
  }

  return {
    cx: (minX + maxX) * 0.5,
    minY,
    cz: (minZ + maxZ) * 0.5,
    footprintRadius: Math.max(maxX - minX, maxZ - minZ) * 0.5 || 0.12
  };
}

function offsetTextureInfo(info, texBase) {
  if (!info || typeof info.index !== 'number') return info;
  return { ...info, index: info.index + texBase };
}

export function mergeGlbModels(parsedModels) {
  const merged = {
    asset: {
      version: '2.0',
      generator: 'NammaBengaluruDaba-TableSpreadAPI-v1'
    },
    scene: 0,
    scenes: [{ nodes: [] }],
    nodes: [],
    meshes: [],
    materials: [],
    samplers: [],
    images: [],
    textures: [],
    accessors: [],
    bufferViews: [],
    buffers: [{ byteLength: 0 }]
  };

  const binChunks = [];
  let binOffset = 0;

  const boundsList = parsedModels.map(({ gltf }) => computeModelBounds(gltf));
  const maxR = Math.max(...boundsList.map((b) => b.footprintRadius), 0.12);
  const spacing = maxR * 2 + 0.025;

  const count = parsedModels.length;
  const cols = count === 1 ? 1 : count <= 4 ? 2 : count <= 6 ? 3 : 4;
  const rows = Math.ceil(count / cols);

  parsedModels.forEach(({ gltf, bin }, idx) => {
    const bvBase = merged.bufferViews.length;
    const accBase = merged.accessors.length;
    const matBase = merged.materials.length;
    const smpBase = merged.samplers.length;
    const imgBase = merged.images.length;
    const texBase = merged.textures.length;
    const meshBase = merged.meshes.length;
    const nodeBase = merged.nodes.length;

    const paddedLen = (bin.length + 3) & ~3;
    const paddedBin =
      paddedLen === bin.length ? bin : Buffer.concat([bin, Buffer.alloc(paddedLen - bin.length)]);
    binChunks.push(paddedBin);

    for (const bv of gltf.bufferViews ?? []) {
      merged.bufferViews.push({
        ...bv,
        buffer: 0,
        byteOffset: (bv.byteOffset ?? 0) + binOffset
      });
    }

    for (const acc of gltf.accessors ?? []) {
      merged.accessors.push({
        ...acc,
        bufferView: typeof acc.bufferView === 'number' ? acc.bufferView + bvBase : undefined
      });
    }

    for (const smp of gltf.samplers ?? []) {
      merged.samplers.push({ ...smp });
    }

    for (const img of gltf.images ?? []) {
      merged.images.push({
        ...img,
        bufferView: typeof img.bufferView === 'number' ? img.bufferView + bvBase : undefined
      });
    }

    for (const tex of gltf.textures ?? []) {
      merged.textures.push({
        ...tex,
        sampler: typeof tex.sampler === 'number' ? tex.sampler + smpBase : undefined,
        source: typeof tex.source === 'number' ? tex.source + imgBase : undefined
      });
    }

    for (const mat of gltf.materials ?? []) {
      const nextMat = { ...mat };
      if (nextMat.pbrMetallicRoughness) {
        nextMat.pbrMetallicRoughness = {
          ...nextMat.pbrMetallicRoughness,
          baseColorTexture: offsetTextureInfo(
            nextMat.pbrMetallicRoughness.baseColorTexture,
            texBase
          ),
          metallicRoughnessTexture: offsetTextureInfo(
            nextMat.pbrMetallicRoughness.metallicRoughnessTexture,
            texBase
          )
        };
      }
      if (nextMat.emissiveTexture) {
        nextMat.emissiveTexture = offsetTextureInfo(nextMat.emissiveTexture, texBase);
      }
      if (nextMat.normalTexture) {
        nextMat.normalTexture = offsetTextureInfo(nextMat.normalTexture, texBase);
      }
      if (nextMat.occlusionTexture) {
        nextMat.occlusionTexture = offsetTextureInfo(nextMat.occlusionTexture, texBase);
      }
      merged.materials.push(nextMat);
    }

    for (const mesh of gltf.meshes ?? []) {
      merged.meshes.push({
        ...mesh,
        primitives: (mesh.primitives ?? []).map((prim) => {
          const attributes = {};
          for (const [k, v] of Object.entries(prim.attributes ?? {})) {
            attributes[k] = v + accBase;
          }
          return {
            ...prim,
            attributes,
            indices: typeof prim.indices === 'number' ? prim.indices + accBase : undefined,
            material: typeof prim.material === 'number' ? prim.material + matBase : undefined
          };
        })
      });
    }

    for (const node of gltf.nodes ?? []) {
      merged.nodes.push({
        ...node,
        mesh: typeof node.mesh === 'number' ? node.mesh + meshBase : undefined,
        children: Array.isArray(node.children)
          ? node.children.map((c) => c + nodeBase)
          : undefined
      });
    }

    const sceneNodes = gltf.scenes?.[gltf.scene ?? 0]?.nodes ?? [];
    const plateChildren = sceneNodes.map((n) => n + nodeBase);

    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const itemsInRow = row === rows - 1 ? count - row * cols : cols;
    const x = (col - (itemsInRow - 1) / 2) * spacing;
    const z = (row - (rows - 1) / 2) * spacing;
    const bounds = boundsList[idx];

    const plateNodeIdx = merged.nodes.length;
    merged.nodes.push({
      name: `Plate_${idx}`,
      translation: [x - bounds.cx, -bounds.minY, z - bounds.cz],
      children: plateChildren
    });
    merged.scenes[0].nodes.push(plateNodeIdx);

    binOffset += paddedLen;
  });

  if (merged.samplers.length === 0) delete merged.samplers;
  if (merged.images.length === 0) delete merged.images;
  if (merged.textures.length === 0) delete merged.textures;

  merged.buffers[0].byteLength = binOffset;

  const jsonRaw = Buffer.from(JSON.stringify(merged), 'utf8');
  const jsonPadLen = (jsonRaw.length + 3) & ~3;
  const jsonChunk =
    jsonPadLen === jsonRaw.length
      ? jsonRaw
      : Buffer.concat([jsonRaw, Buffer.alloc(jsonPadLen - jsonRaw.length, 0x20)]);

  const binChunk = Buffer.concat(binChunks);
  const totalLen = 12 + 8 + jsonChunk.length + 8 + binChunk.length;

  const out = Buffer.allocUnsafe(totalLen);
  out.writeUInt32LE(GLB_MAGIC, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(totalLen, 8);

  out.writeUInt32LE(jsonChunk.length, 12);
  out.writeUInt32LE(JSON_CHUNK_TYPE, 16);
  jsonChunk.copy(out, 20);

  const binHeaderOffset = 20 + jsonChunk.length;
  out.writeUInt32LE(binChunk.length, binHeaderOffset);
  out.writeUInt32LE(BIN_CHUNK_TYPE, binHeaderOffset + 4);
  binChunk.copy(out, binHeaderOffset + 8);

  return out;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const reqUrl = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
    let modelsParam = reqUrl.searchParams.get('models') || '';
    if (!modelsParam && reqUrl.pathname.startsWith('/api/spread/')) {
      modelsParam = reqUrl.pathname
        .slice('/api/spread/'.length)
        .replace(/\.glb$/i, '');
    }
    const rawSlugs = modelsParam
      .split(/[,]|--/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[a-z0-9-]+$/.test(s))
      .slice(0, MAX_PLATES);

    const slugs = rawSlugs.length > 0 ? rawSlugs : ['dal-tadka'];
    const parsedModels = await Promise.all(
      slugs.map((slug) => loadModelBuffer(slug, req.headers.host))
    );

    const glbBuffer = mergeGlbModels(parsedModels);

    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    res.setHeader('Content-Length', String(glbBuffer.length));
    res.statusCode = 200;
    res.end(glbBuffer);
  } catch (err) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to build spread GLB' }));
  }
}
