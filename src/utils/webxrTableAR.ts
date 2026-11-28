import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface AnchoredARSessionHandle {
  stop: () => Promise<void>;
}

export interface StartAnchoredTableAROptions {
  glbUrl: string;
  title: string;
  onStatusChange?: (status: 'scanning' | 'ready' | 'placed' | 'ended') => void;
  onError?: (message: string) => void;
}

const loader = new GLTFLoader();

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(
      size * 0.5,
      size * 0.5,
      size * 0.12,
      size * 0.5,
      size * 0.5,
      size * 0.5
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.52)');
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.24)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createReticleMesh(): THREE.Group {
  const group = new THREE.Group();

  const outerGeo = new THREE.RingGeometry(0.09, 0.115, 48);
  outerGeo.rotateX(-Math.PI / 2);
  const outerMat = new THREE.MeshBasicMaterial({
    color: 0xf4a26e,
    transparent: true,
    opacity: 0.92,
    depthWrite: false
  });
  group.add(new THREE.Mesh(outerGeo, outerMat));

  const innerGeo = new THREE.CircleGeometry(0.018, 24);
  innerGeo.rotateX(-Math.PI / 2);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0xd96b27,
    transparent: true,
    opacity: 0.95,
    depthWrite: false
  });
  group.add(new THREE.Mesh(innerGeo, innerMat));

  group.visible = false;
  return group;
}

function buildOverlayElement(
  title: string,
  callbacks: {
    onPlaceOrMove: () => void;
    onRotate: (deltaRad: number) => void;
    onExit: () => void;
  }
) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;pointer-events:none;display:flex;flex-direction:column;justify-content:space-between;padding:max(16px,env(safe-area-inset-top)) 16px max(22px,env(safe-area-inset-bottom)) 16px;font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#F7F3EC;';

  const topRow = document.createElement('div');
  topRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;';

  const titlePill = document.createElement('div');
  titlePill.style.cssText =
    'pointer-events:auto;background:rgba(14,14,17,0.78);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.2);border-radius:999px;padding:8px 14px;font-size:12px;font-weight:600;max-width:74%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
  titlePill.textContent = `${title} • 1:1 Table AR`;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Exit AR');
  closeBtn.style.cssText =
    'pointer-events:auto;width:44px;height:44px;border-radius:999px;border:1px solid rgba(255,255,255,0.25);background:rgba(14,14,17,0.82);color:#F7F3EC;font-size:16px;font-weight:600;display:flex;align-items:center;justify-content:center;cursor:pointer;';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.onExit();
  });

  topRow.appendChild(titlePill);
  topRow.appendChild(closeBtn);

  const bottomPanel = document.createElement('div');
  bottomPanel.style.cssText =
    'display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:420px;margin:0 auto;';

  const hintPill = document.createElement('div');
  hintPill.style.cssText =
    'background:rgba(14,14,17,0.82);backdrop-filter:blur(16px);border:1px solid rgba(217,107,39,0.45);border-radius:999px;padding:8px 16px;font-size:12px;font-weight:500;color:#F7F3EC;text-align:center;';
  hintPill.textContent = 'Move phone slowly over your table…';

  const controlsRow = document.createElement('div');
  controlsRow.style.cssText =
    'pointer-events:auto;display:flex;align-items:center;justify-content:center;gap:8px;width:100%;';

  const rotateLeftBtn = document.createElement('button');
  rotateLeftBtn.type = 'button';
  rotateLeftBtn.textContent = '↺';
  rotateLeftBtn.setAttribute('aria-label', 'Rotate left');
  rotateLeftBtn.style.cssText =
    'display:none;width:46px;height:46px;border-radius:16px;border:1px solid rgba(255,255,255,0.22);background:rgba(14,14,17,0.82);color:#F7F3EC;font-size:18px;cursor:pointer;';
  rotateLeftBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.onRotate(-Math.PI / 8);
  });

  const actionBtn = document.createElement('button');
  actionBtn.type = 'button';
  actionBtn.textContent = 'Scanning Table…';
  actionBtn.disabled = true;
  actionBtn.style.cssText =
    'flex:1;min-height:48px;border-radius:16px;border:1px solid rgba(255,255,255,0.28);background:linear-gradient(135deg,#F28038,#D9621C);color:#F7F3EC;font-size:14px;font-weight:600;padding:0 18px;cursor:pointer;opacity:0.55;box-shadow:0 12px 28px -6px rgba(217,107,39,0.55);';
  actionBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.onPlaceOrMove();
  });

  const rotateRightBtn = document.createElement('button');
  rotateRightBtn.type = 'button';
  rotateRightBtn.textContent = '↻';
  rotateRightBtn.setAttribute('aria-label', 'Rotate right');
  rotateRightBtn.style.cssText =
    'display:none;width:46px;height:46px;border-radius:16px;border:1px solid rgba(255,255,255,0.22);background:rgba(14,14,17,0.82);color:#F7F3EC;font-size:18px;cursor:pointer;';
  rotateRightBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.onRotate(Math.PI / 8);
  });

  controlsRow.appendChild(rotateLeftBtn);
  controlsRow.appendChild(actionBtn);
  controlsRow.appendChild(rotateRightBtn);

  bottomPanel.appendChild(hintPill);
  bottomPanel.appendChild(controlsRow);
  overlay.appendChild(topRow);
  overlay.appendChild(bottomPanel);

  return {
    overlay,
    setUIState: (state: 'scanning' | 'ready' | 'placed') => {
      if (state === 'scanning') {
        hintPill.textContent = 'Move phone slowly over your table…';
        actionBtn.textContent = 'Scanning Table…';
        actionBtn.disabled = true;
        actionBtn.style.opacity = '0.55';
        actionBtn.style.background = 'linear-gradient(135deg,#F28038,#D9621C)';
        rotateLeftBtn.style.display = 'none';
        rotateRightBtn.style.display = 'none';
      } else if (state === 'ready') {
        hintPill.textContent = 'Table detected — tap Place Dish to lock on table';
        actionBtn.textContent = 'Place on Table';
        actionBtn.disabled = false;
        actionBtn.style.opacity = '1';
        actionBtn.style.background = 'linear-gradient(135deg,#F28038,#D9621C)';
        rotateLeftBtn.style.display = 'none';
        rotateRightBtn.style.display = 'none';
      } else {
        hintPill.textContent = 'Locked on table (1:1 scale) • Walk around to inspect';
        actionBtn.textContent = 'Move Dish';
        actionBtn.disabled = false;
        actionBtn.style.opacity = '1';
        actionBtn.style.background = 'rgba(14,14,17,0.86)';
        rotateLeftBtn.style.display = 'inline-flex';
        rotateLeftBtn.style.alignItems = 'center';
        rotateLeftBtn.style.justifyContent = 'center';
        rotateRightBtn.style.display = 'inline-flex';
        rotateRightBtn.style.alignItems = 'center';
        rotateRightBtn.style.justifyContent = 'center';
      }
    }
  };
}

/**
 * Launches a hardware-anchored WebXR table AR session directly in Android Chrome.
 * Uses continuous horizontal-surface hit-testing for the reticle and `XRHitTestResult.createAnchor()`
 * on placement so dishes stay firmly locked to the physical table without floating or drifting.
 */
export async function startAnchoredTableAR(
  options: StartAnchoredTableAROptions
): Promise<AnchoredARSessionHandle> {
  const { glbUrl, title, onStatusChange, onError } = options;

  const xrSystem = (
    navigator as Navigator & {
      xr?: {
        requestSession: (mode: string, init: Record<string, unknown>) => Promise<XRSession>;
      };
    }
  ).xr;

  if (!xrSystem) {
    throw new Error('WebXR is not available on this browser.');
  }

  let session: XRSession | null = null;
  let hitTestSource: XRHitTestSource | null = null;
  let placedAnchor: XRAnchor | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let overlayHandle: ReturnType<typeof buildOverlayElement> | null = null;
  let ended = false;

  let isPlaced = false;
  let pendingPlace = false;
  let hasReticlePose = false;
  let userYaw = 0;

  const smoothedReticlePos = new THREE.Vector3();
  let reticleInitialized = false;

  const cleanup = async () => {
    if (ended) return;
    ended = true;
    try {
      hitTestSource?.cancel();
    } catch {
      // Ignore cancel errors
    }
    hitTestSource = null;

    try {
      placedAnchor?.delete?.();
    } catch {
      // Ignore anchor cleanup errors
    }
    placedAnchor = null;

    if (session) {
      try {
        await session.end();
      } catch {
        // Ignore already-ended session
      }
      session = null;
    }

    if (overlayHandle?.overlay.parentNode) {
      overlayHandle.overlay.parentNode.removeChild(overlayHandle.overlay);
    }

    if (renderer) {
      renderer.setAnimationLoop(null);
      renderer.dispose();
      renderer = null;
    }

    onStatusChange?.('ended');
  };

  try {
    // Load the GLB and build overlay synchronously/early
    const gltfPromise = new Promise<THREE.Group>((resolve, reject) => {
      loader.load(
        glbUrl,
        (gltf) => resolve(gltf.scene),
        undefined,
        (err) => reject(err)
      );
    });

    overlayHandle = buildOverlayElement(title, {
      onPlaceOrMove: () => {
        if (isPlaced) {
          // Unlock & return to scanning reticle so user can reposition cleanly
          try {
            placedAnchor?.delete?.();
          } catch {
            // Ignore
          }
          placedAnchor = null;
          isPlaced = false;
          pendingPlace = false;
          dishRoot.visible = false;
          reticleInitialized = false;
          overlayHandle?.setUIState(hasReticlePose ? 'ready' : 'scanning');
          onStatusChange?.(hasReticlePose ? 'ready' : 'scanning');
        } else if (hasReticlePose) {
          pendingPlace = true;
        }
      },
      onRotate: (deltaRad) => {
        userYaw += deltaRad;
        dishContent.rotation.y = userYaw;
      },
      onExit: () => {
        void cleanup();
      }
    });

    document.body.appendChild(overlayHandle.overlay);
    overlayHandle.setUIState('scanning');
    onStatusChange?.('scanning');

    session = await xrSystem.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['anchors', 'local-floor', 'dom-overlay'],
      domOverlay: { root: overlayHandle.overlay }
    });

    session.addEventListener('end', () => {
      void cleanup();
    });

    // Tapping anywhere on the table while scanning places the dish if ready
    session.addEventListener('select', () => {
      if (!isPlaced && hasReticlePose) {
        pendingPlace = true;
      }
    });

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.xr.enabled = true;
    await renderer.xr.setSession(session);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    // Balanced overhead + warm ambient lighting for appetizing food colors
    const hemiLight = new THREE.HemisphereLight(0xfff8ee, 0x3b3028, 1.35);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff1de, 1.15);
    dirLight.position.set(0.6, 1.8, 0.9);
    scene.add(dirLight);

    const reticle = createReticleMesh();
    scene.add(reticle);

    const dishRoot = new THREE.Group();
    dishRoot.visible = false;
    scene.add(dishRoot);

    const dishContent = new THREE.Group();
    dishRoot.add(dishContent);

    let modelReady = false;
    void gltfPromise
      .then((loadedModel) => {
        if (ended) return;
        const box = new THREE.Box3().setFromObject(loadedModel);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);

        loadedModel.position.x -= center.x;
        loadedModel.position.z -= center.z;
        loadedModel.position.y -= box.min.y;
        dishContent.add(loadedModel);

        // Add grounded contact shadow disc cleanly beneath plates (no z-fighting)
        const shadowSpan = Math.max(size.x, size.z, 0.24) * 1.2;
        const shadowGeo = new THREE.PlaneGeometry(shadowSpan, shadowSpan);
        shadowGeo.rotateX(-Math.PI / 2);
        const shadowMat = new THREE.MeshBasicMaterial({
          map: createContactShadowTexture(),
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: 1
        });
        const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        shadowMesh.position.y = -0.0005;
        shadowMesh.renderOrder = -1;
        dishContent.add(shadowMesh);
        modelReady = true;
      })
      .catch(() => {
        onError?.('Could not load 3D dish model for Table AR.');
        void cleanup();
      });

    let referenceSpace: XRReferenceSpace;
    try {
      referenceSpace = await session.requestReferenceSpace('local-floor');
    } catch {
      referenceSpace = await session.requestReferenceSpace('local');
    }

    const viewerSpace = await session.requestReferenceSpace('viewer');
    hitTestSource = (await session.requestHitTestSource?.({ space: viewerSpace })) ?? null;

    const tempMatrix = new THREE.Matrix4();
    const tempPos = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    const anchorPos = new THREE.Vector3();
    const anchorQuat = new THREE.Quaternion();
    const anchorScale = new THREE.Vector3();

    let creatingAnchor = false;

    renderer.setAnimationLoop((_time, frame: XRFrame | undefined) => {
      if (!frame || ended || !renderer) return;

      // 1. Update locked dish directly from hardware XRAnchor when placed
      if (isPlaced && placedAnchor) {
        const anchorPose = frame.getPose(placedAnchor.anchorSpace, referenceSpace);
        if (anchorPose) {
          tempMatrix.fromArray(anchorPose.transform.matrix);
          tempMatrix.decompose(anchorPos, anchorQuat, anchorScale);
          dishRoot.position.copy(anchorPos);
          // Keep plates strictly level horizontally (ignore tiny tilt jitter from anchor)
          dishRoot.quaternion.set(0, 0, 0, 1);
          dishRoot.visible = true;
        }
      }

      // 2. While scanning, run horizontal table hit-testing for reticle
      if (!isPlaced && hitTestSource) {
        const results = frame.getHitTestResults(hitTestSource);
        let horizontalHit: XRHitTestResult | null = null;
        let horizontalPose: XRPose | null = null;

        for (const res of results) {
          const pose = res.getPose(referenceSpace);
          if (!pose) continue;
          // Upward-facing surface normal check (pose matrix[5] > 0.78 => flat table/floor)
          if (pose.transform.matrix[5] > 0.78) {
            horizontalHit = res;
            horizontalPose = pose;
            break;
          }
        }

        if (horizontalHit && horizontalPose) {
          tempMatrix.fromArray(horizontalPose.transform.matrix);
          tempPos.setFromMatrixPosition(tempMatrix);

          if (!reticleInitialized) {
            smoothedReticlePos.copy(tempPos);
            reticleInitialized = true;
          } else {
            // Smooth high-frequency sensor noise on reticle
            smoothedReticlePos.lerp(tempPos, 0.35);
          }

          reticle.position.copy(smoothedReticlePos);
          reticle.visible = true;

          if (!hasReticlePose) {
            hasReticlePose = true;
            overlayHandle?.setUIState('ready');
            onStatusChange?.('ready');
          }

          if (pendingPlace && !creatingAnchor && modelReady) {
            pendingPlace = false;
            creatingAnchor = true;

            // Face dishes gently toward camera at placement time
            const xrCam = renderer.xr.getCamera();
            camPos.setFromMatrixPosition(xrCam.matrixWorld);
            userYaw = Math.atan2(
              camPos.x - smoothedReticlePos.x,
              camPos.z - smoothedReticlePos.z
            );
            dishContent.rotation.y = userYaw;

            dishRoot.position.copy(smoothedReticlePos);
            dishRoot.quaternion.set(0, 0, 0, 1);
            dishRoot.visible = true;
            reticle.visible = false;
            isPlaced = true;
            overlayHandle?.setUIState('placed');
            onStatusChange?.('placed');

            if (typeof horizontalHit.createAnchor === 'function') {
              horizontalHit
                .createAnchor()
                .then((anchor) => {
                  if (ended || !isPlaced) {
                    anchor.delete?.();
                  } else {
                    placedAnchor = anchor;
                  }
                })
                .catch(() => {
                  // Fallback: static smoothedReticlePos in referenceSpace
                })
                .finally(() => {
                  creatingAnchor = false;
                });
            } else {
              creatingAnchor = false;
            }
          }
        } else {
          reticle.visible = false;
          if (hasReticlePose) {
            hasReticlePose = false;
            overlayHandle?.setUIState('scanning');
            onStatusChange?.('scanning');
          }
        }
      }

      renderer.render(scene, camera);
    });

    return { stop: cleanup };
  } catch (err) {
    await cleanup();
    const message =
      err instanceof Error ? err.message : 'Could not start anchored WebXR table AR.';
    onError?.(message);
    throw err;
  }
}
