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
      size * 0.1,
      size * 0.5,
      size * 0.5,
      size * 0.5
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.58)');
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.26)');
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

  const outerGeo = new THREE.RingGeometry(0.085, 0.11, 48);
  outerGeo.rotateX(-Math.PI / 2);
  const outerMat = new THREE.MeshBasicMaterial({
    color: 0xf4a26e,
    transparent: true,
    opacity: 0.92,
    depthWrite: false
  });
  group.add(new THREE.Mesh(outerGeo, outerMat));

  const innerGeo = new THREE.CircleGeometry(0.016, 32);
  innerGeo.rotateX(-Math.PI / 2);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
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

  const blockXRSelect = (el: HTMLElement) => {
    el.addEventListener('beforexrselect', (e) => {
      e.preventDefault();
    });
  };

  const topRow = document.createElement('div');
  topRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;';

  const titlePill = document.createElement('div');
  titlePill.style.cssText =
    'pointer-events:auto;background:rgba(14,14,17,0.78);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.2);border-radius:999px;padding:8px 14px;font-size:12px;font-weight:600;max-width:74%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
  titlePill.textContent = `${title} • 1:1 Table AR`;
  blockXRSelect(titlePill);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Exit AR');
  closeBtn.style.cssText =
    'pointer-events:auto;width:44px;height:44px;border-radius:999px;border:1px solid rgba(255,255,255,0.25);background:rgba(14,14,17,0.82);color:#F7F3EC;font-size:16px;font-weight:600;display:flex;align-items:center;justify-content:center;cursor:pointer;';
  blockXRSelect(closeBtn);
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
  hintPill.textContent = 'Point at any flat surface…';

  const controlsRow = document.createElement('div');
  controlsRow.style.cssText =
    'pointer-events:auto;display:flex;align-items:center;justify-content:center;gap:8px;width:100%;';
  blockXRSelect(controlsRow);

  const rotateLeftBtn = document.createElement('button');
  rotateLeftBtn.type = 'button';
  rotateLeftBtn.textContent = '↺';
  rotateLeftBtn.setAttribute('aria-label', 'Rotate left');
  rotateLeftBtn.style.cssText =
    'display:none;width:46px;height:46px;border-radius:16px;border:1px solid rgba(255,255,255,0.22);background:rgba(14,14,17,0.82);color:#F7F3EC;font-size:18px;cursor:pointer;';
  blockXRSelect(rotateLeftBtn);
  rotateLeftBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.onRotate(-Math.PI / 8);
  });

  const actionBtn = document.createElement('button');
  actionBtn.type = 'button';
  actionBtn.textContent = 'Detecting Surface…';
  actionBtn.disabled = true;
  actionBtn.style.cssText =
    'flex:1;min-height:48px;border-radius:16px;border:1px solid rgba(255,255,255,0.28);background:linear-gradient(135deg,#F28038,#D9621C);color:#F7F3EC;font-size:14px;font-weight:600;padding:0 18px;cursor:pointer;opacity:0.7;box-shadow:0 12px 28px -6px rgba(217,107,39,0.55);';
  blockXRSelect(actionBtn);
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
  blockXRSelect(rotateRightBtn);
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
    setUIState: (state: 'scanning' | 'ready' | 'placed', customHint?: string) => {
      if (state === 'scanning') {
        hintPill.textContent = customHint ?? 'Point at any flat surface…';
        actionBtn.textContent = 'Place on Surface';
        actionBtn.disabled = false;
        actionBtn.style.opacity = '0.9';
        actionBtn.style.background = 'linear-gradient(135deg,#F28038,#D9621C)';
        rotateLeftBtn.style.display = 'none';
        rotateRightBtn.style.display = 'none';
      } else if (state === 'ready') {
        hintPill.textContent = customHint ?? 'Aim at any flat spot — tap to lock dish';
        actionBtn.textContent = 'Lock on Surface';
        actionBtn.disabled = false;
        actionBtn.style.opacity = '1';
        actionBtn.style.background = 'linear-gradient(135deg,#F28038,#D9621C)';
        rotateLeftBtn.style.display = 'inline-flex';
        rotateLeftBtn.style.alignItems = 'center';
        rotateLeftBtn.style.justifyContent = 'center';
        rotateRightBtn.style.display = 'inline-flex';
        rotateRightBtn.style.alignItems = 'center';
        rotateRightBtn.style.justifyContent = 'center';
      } else {
        hintPill.textContent = customHint ?? 'Locked on surface (1:1 scale) • Walk around freely';
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
 * Launches a hardware-anchored WebXR Table AR session for Android Chrome.
 * Uses multi-entity (`plane` + `point`) hit-testing and downward fallback rays so any flat surface
 * (wooden tables, patterned cloths, desks, countertops) displays the dish promptly, then locks the
 * dish with a hardware `XRAnchor` + micro-jitter deadband and gravity alignment for 100% stability.
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
  let centerHitTestSource: XRHitTestSource | null = null;
  let angledHitTestSource: XRHitTestSource | null = null;
  let placedAnchor: XRAnchor | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let overlayHandle: ReturnType<typeof buildOverlayElement> | null = null;
  let ended = false;

  // State machine:
  // - On session start (`autoPlacePending = true`), automatically places & hardware-locks the dish
  //   on the first detected flat surface so the user immediately sees it on their table/surface.
  // - Tapping "Move Dish" unlocks (`isPlaced = false`, `autoPlacePending = false`) and glides the
  //   live dish + reticle across flat surfaces until user taps "Lock on Surface" or taps screen.
  let isPlaced = false;
  let autoPlacePending = true;
  let pendingManualPlace = false;
  let hasSurfacePose = false;
  let anchorStabilized = false;
  let userYaw = 0;

  const smoothedSurfacePos = new THREE.Vector3();
  let surfaceInitialized = false;

  const cleanup = async () => {
    if (ended) return;
    ended = true;

    try {
      centerHitTestSource?.cancel();
    } catch {
      // Ignore
    }
    centerHitTestSource = null;

    try {
      angledHitTestSource?.cancel();
    } catch {
      // Ignore
    }
    angledHitTestSource = null;

    try {
      placedAnchor?.delete?.();
    } catch {
      // Ignore
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
          // Unlock anchor so user can glide the dish smoothly onto another spot/surface
          try {
            placedAnchor?.delete?.();
          } catch {
            // Ignore
          }
          placedAnchor = null;
          isPlaced = false;
          autoPlacePending = false;
          pendingManualPlace = false;
          anchorStabilized = false;
          surfaceInitialized = false;
          overlayHandle?.setUIState(hasSurfacePose ? 'ready' : 'scanning');
          onStatusChange?.(hasSurfacePose ? 'ready' : 'scanning');
        } else {
          pendingManualPlace = true;
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

    // Tapping anywhere on the AR camera feed while in Move/Aim mode locks the dish onto that surface
    session.addEventListener('select', () => {
      if (!isPlaced) {
        pendingManualPlace = true;
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

    // Bind Three.js WebXRManager to 'local-floor' with safe fallback to 'local' so camera & poses match 100%
    try {
      renderer.xr.setReferenceSpaceType('local-floor');
      await renderer.xr.setSession(session);
    } catch {
      renderer.xr.setReferenceSpaceType('local');
      await renderer.xr.setSession(session);
    }

    const referenceSpace = renderer.xr.getReferenceSpace();
    if (!referenceSpace) {
      throw new Error('Could not acquire WebXR reference space.');
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    // Warm, balanced restaurant lighting for appetizing food colors
    const hemiLight = new THREE.HemisphereLight(0xfff8ee, 0x3b3028, 1.4);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff1de, 1.2);
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

        // Grounded soft contact shadow directly under plate base (eliminates floating illusion)
        const shadowSpan = Math.max(size.x, size.z, 0.24) * 1.25;
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

    const viewerSpace = await session.requestReferenceSpace('viewer');

    // Request BOTH 'plane' AND 'point' hit-tests so textured cloths, sheets, smooth tables,
    // marble counters, and desks all respond immediately without waiting for slow plane merging.
    const requestHitSource = async (
      ray?: XRRay
    ): Promise<XRHitTestSource | null> => {
      try {
        const initWithEntities: Record<string, unknown> = {
          space: viewerSpace,
          entityTypes: ['plane', 'point']
        };
        if (ray) initWithEntities.offsetRay = ray;
        const src = await (
          session as XRSession & {
            requestHitTestSource?: (init: Record<string, unknown>) => Promise<XRHitTestSource>;
          }
        ).requestHitTestSource?.(initWithEntities);
        if (src) return src;
      } catch {
        // Browser may not support entityTypes; fall back to standard requestHitTestSource
      }

      try {
        const basicInit: Record<string, unknown> = { space: viewerSpace };
        if (ray) basicInit.offsetRay = ray;
        return (
          (await (
            session as XRSession & {
              requestHitTestSource?: (init: Record<string, unknown>) => Promise<XRHitTestSource>;
            }
          ).requestHitTestSource?.(basicInit)) ?? null
        );
      } catch {
        return null;
      }
    };

    centerHitTestSource = await requestHitSource();

    // Downward ~20-degree probe ray catches tabletop surfaces even when user holds phone comfortably upright
    if (typeof XRRay === 'function' && typeof DOMPoint === 'function') {
      const downwardRay = new XRRay(new DOMPoint(0, 0, 0), {
        x: 0,
        y: -0.35,
        z: -0.936
      });
      angledHitTestSource = await requestHitSource(downwardRay);
    }

    const tempMatrix = new THREE.Matrix4();
    const tempPos = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    const anchorPos = new THREE.Vector3();
    const anchorQuat = new THREE.Quaternion();
    const anchorScale = new THREE.Vector3();

    let creatingAnchor = false;
    let firstFrameTime: number | null = null;
    let yawInitialized = false;

    const pickFlatSurfaceHit = (
      results: readonly XRHitTestResult[],
      cameraPosition: THREE.Vector3
    ): { hit: XRHitTestResult; pos: THREE.Vector3; isPlaneLike: boolean } | null => {
      let fallbackPoint: { hit: XRHitTestResult; pos: THREE.Vector3; isPlaneLike: boolean } | null =
        null;

      for (const res of results) {
        const pose = res.getPose(referenceSpace);
        if (!pose) continue;

        tempMatrix.fromArray(pose.transform.matrix);
        const pos = new THREE.Vector3().setFromMatrixPosition(tempMatrix);
        const dist = pos.distanceTo(cameraPosition);
        if (dist < 0.18 || dist > 3.2) continue;

        // matrix[5] is local +Y surface normal along world +Y (gravity up)
        if (pose.transform.matrix[5] > 0.55) {
          return { hit: res, pos, isPlaneLike: true };
        }

        // For sparse 'point' hits whose pose orientation isn't gravity-aligned,
        // accept hits that clearly lie below the camera (table/desk/floor/bedsheet).
        if (!fallbackPoint && pos.y < cameraPosition.y - 0.04) {
          fallbackPoint = { hit: res, pos, isPlaneLike: false };
        }
      }

      return fallbackPoint;
    };

    const lockAtPosition = (targetPos: THREE.Vector3, hitToAnchor: XRHitTestResult | null) => {
      if (!yawInitialized) {
        userYaw = Math.atan2(camPos.x - targetPos.x, camPos.z - targetPos.z);
        dishContent.rotation.y = userYaw;
        yawInitialized = true;
      }

      dishRoot.position.copy(targetPos);
      dishRoot.quaternion.set(0, 0, 0, 1);
      dishRoot.visible = true;
      reticle.visible = false;
      isPlaced = true;
      autoPlacePending = false;
      pendingManualPlace = false;
      anchorStabilized = false;

      overlayHandle?.setUIState('placed');
      onStatusChange?.('placed');

      if (hitToAnchor && typeof hitToAnchor.createAnchor === 'function' && !creatingAnchor) {
        creatingAnchor = true;
        hitToAnchor
          .createAnchor()
          .then((anchor) => {
            if (ended || !isPlaced) {
              anchor.delete?.();
            } else {
              placedAnchor = anchor;
            }
          })
          .catch(() => {
            // Static local-floor/local world coordinate fallback still remains level & anchored
          })
          .finally(() => {
            creatingAnchor = false;
          });
      }
    };

    renderer.setAnimationLoop((time, frame: XRFrame | undefined) => {
      if (!frame || ended || !renderer) return;
      if (firstFrameTime === null) firstFrameTime = time;

      const viewerPose = frame.getViewerPose(referenceSpace);
      if (viewerPose) {
        const m = viewerPose.transform.matrix;
        camPos.set(m[12], m[13], m[14]);
        camDir.set(-m[8], -m[9], -m[10]).normalize();
      } else {
        const xrCam = renderer.xr.getCamera();
        camPos.setFromMatrixPosition(xrCam.matrixWorld);
        xrCam.getWorldDirection(camDir);
      }

      // 1. LOCKED MODE: Update dish from hardware XRAnchor with micro-jitter deadband & strict level lock
      if (isPlaced) {
        if (placedAnchor) {
          const anchorPose = frame.getPose(placedAnchor.anchorSpace, referenceSpace);
          if (anchorPose) {
            tempMatrix.fromArray(anchorPose.transform.matrix);
            tempMatrix.decompose(anchorPos, anchorQuat, anchorScale);

            if (!anchorStabilized) {
              dishRoot.position.copy(anchorPos);
              anchorStabilized = true;
            } else {
              const drift = dishRoot.position.distanceTo(anchorPos);
              if (drift >= 0.06) {
                // Large SLAM relocalization correction: converge smoothly without popping
                dishRoot.position.lerp(anchorPos, 0.45);
              } else if (drift >= 0.003) {
                // Subtle SLAM refinement: smooth blend
                dishRoot.position.lerp(anchorPos, 0.2);
              }
              // < 3mm sub-millimeter tracking noise: ignore completely for 100% frozen stability
            }
          }
        }
        // Strictly gravity-leveled plates at all times (zero tilt jitter)
        dishRoot.quaternion.set(0, 0, 0, 1);
        dishRoot.visible = modelReady;
        reticle.visible = false;

        renderer.render(scene, camera);
        return;
      }

      // 2. SCANNING / AIMING MODE: Query center hit-test, then downward-angled probe
      let bestHit: { hit: XRHitTestResult; pos: THREE.Vector3; isPlaneLike: boolean } | null = null;

      if (centerHitTestSource) {
        const centerResults = frame.getHitTestResults(centerHitTestSource);
        bestHit = pickFlatSurfaceHit(centerResults, camPos);
      }

      if (!bestHit && angledHitTestSource) {
        const angledResults = frame.getHitTestResults(angledHitTestSource);
        bestHit = pickFlatSurfaceHit(angledResults, camPos);
      }

      if (bestHit) {
        tempPos.copy(bestHit.pos);

        if (!surfaceInitialized) {
          smoothedSurfacePos.copy(tempPos);
          surfaceInitialized = true;
        } else {
          const jump = smoothedSurfacePos.distanceTo(tempPos);
          smoothedSurfacePos.lerp(tempPos, jump > 0.25 ? 0.5 : 0.28);
        }

        reticle.position.copy(smoothedSurfacePos);
        reticle.visible = true;

        if (!hasSurfacePose) {
          hasSurfacePose = true;
        }

        if (modelReady) {
          if (autoPlacePending || pendingManualPlace) {
            lockAtPosition(smoothedSurfacePos, bestHit.hit);
          } else {
            // In "Move Dish" aiming mode: glide the actual dish smoothly on the flat surface
            if (!yawInitialized) {
              userYaw = Math.atan2(
                camPos.x - smoothedSurfacePos.x,
                camPos.z - smoothedSurfacePos.z
              );
              dishContent.rotation.y = userYaw;
              yawInitialized = true;
            }
            dishRoot.position.copy(smoothedSurfacePos);
            dishRoot.quaternion.set(0, 0, 0, 1);
            dishRoot.visible = true;
            overlayHandle?.setUIState('ready');
            onStatusChange?.('ready');
          }
        } else {
          overlayHandle?.setUIState('scanning', 'Surface found — loading 1:1 dish model…');
        }
      } else {
        // Fallback when user taps Place manually (or on dark/featureless surfaces) so it NEVER stalls
        const elapsedMs = time - (firstFrameTime ?? time);
        if (pendingManualPlace && modelReady) {
          const horizLen = Math.hypot(camDir.x, camDir.z) || 1;
          const fallbackPos = new THREE.Vector3(
            camPos.x + (camDir.x / horizLen) * 0.65,
            camPos.y - 0.42,
            camPos.z + (camDir.z / horizLen) * 0.65
          );
          lockAtPosition(fallbackPos, null);
        } else if (surfaceInitialized && modelReady) {
          // Keep dish steady at last known flat surface instead of flickering
          dishRoot.visible = true;
        } else if (elapsedMs > 1200 && !hasSurfacePose) {
          overlayHandle?.setUIState(
            'scanning',
            'Tap "Place on Surface" anytime or point at flat surface'
          );
        } else {
          reticle.visible = false;
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
