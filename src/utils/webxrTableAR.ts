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
  hintPill.textContent = 'Detecting flat surface…';

  const controlsRow = document.createElement('div');
  controlsRow.style.cssText =
    'pointer-events:auto;display:none;align-items:center;justify-content:center;gap:10px;';
  blockXRSelect(controlsRow);

  const rotateLeftBtn = document.createElement('button');
  rotateLeftBtn.type = 'button';
  rotateLeftBtn.textContent = '↺';
  rotateLeftBtn.setAttribute('aria-label', 'Rotate dish left');
  rotateLeftBtn.style.cssText =
    'width:44px;height:44px;border-radius:999px;border:1px solid rgba(255,255,255,0.22);background:rgba(14,14,17,0.82);backdrop-filter:blur(14px);color:#F7F3EC;font-size:18px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;';
  blockXRSelect(rotateLeftBtn);
  rotateLeftBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.onRotate(-Math.PI / 8);
  });

  const rotateRightBtn = document.createElement('button');
  rotateRightBtn.type = 'button';
  rotateRightBtn.textContent = '↻';
  rotateRightBtn.setAttribute('aria-label', 'Rotate dish right');
  rotateRightBtn.style.cssText =
    'width:44px;height:44px;border-radius:999px;border:1px solid rgba(255,255,255,0.22);background:rgba(14,14,17,0.82);backdrop-filter:blur(14px);color:#F7F3EC;font-size:18px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;';
  blockXRSelect(rotateRightBtn);
  rotateRightBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.onRotate(Math.PI / 8);
  });

  controlsRow.appendChild(rotateLeftBtn);
  controlsRow.appendChild(rotateRightBtn);

  bottomPanel.appendChild(hintPill);
  bottomPanel.appendChild(controlsRow);
  overlay.appendChild(topRow);
  overlay.appendChild(bottomPanel);

  return {
    overlay,
    setUIState: (state: 'scanning' | 'placed', customHint?: string) => {
      if (state === 'scanning') {
        hintPill.textContent = customHint ?? 'Detecting flat surface…';
        controlsRow.style.display = 'none';
      } else {
        hintPill.textContent = customHint ?? 'Locked on surface (1:1 scale) • Walk around freely';
        controlsRow.style.display = 'flex';
      }
    }
  };
}

/**
 * Launches an automatically hardware-anchored WebXR Table AR session for Android Chrome.
 * Detects flat surfaces via `plane` + `point` hit-testing and downward fallback rays, then
 * automatically locks the dish onto the surface with an `XRAnchor` + micro-jitter deadband and
 * gravity alignment so it stays planted cleanly without a Move Dish unlock loop.
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

  let isPlaced = false;
  let needsSurfaceAnchorUpgrade = false;
  let fallbackPlacedAt = 0;
  let anchorStabilized = false;
  let userYaw = 0;

  const cancelHitTestSources = () => {
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
  };

  const cleanup = async () => {
    if (ended) return;
    ended = true;

    cancelHitTestSources();

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
        // Fallback when entityTypes isn't accepted
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

    if (typeof XRRay === 'function' && typeof DOMPoint === 'function') {
      const downwardRay = new XRRay(new DOMPoint(0, 0, 0), {
        x: 0,
        y: -0.35,
        z: -0.936
      });
      angledHitTestSource = await requestHitSource(downwardRay);
    }

    const tempMatrix = new THREE.Matrix4();
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
    ): { hit: XRHitTestResult; pos: THREE.Vector3 } | null => {
      let fallbackPoint: { hit: XRHitTestResult; pos: THREE.Vector3 } | null = null;

      for (const res of results) {
        const pose = res.getPose(referenceSpace);
        if (!pose) continue;

        tempMatrix.fromArray(pose.transform.matrix);
        const pos = new THREE.Vector3().setFromMatrixPosition(tempMatrix);
        const dist = pos.distanceTo(cameraPosition);
        if (dist < 0.18 || dist > 3.2) continue;

        if (pose.transform.matrix[5] > 0.55) {
          return { hit: res, pos };
        }

        if (!fallbackPoint && pos.y < cameraPosition.y - 0.04) {
          fallbackPoint = { hit: res, pos };
        }
      }

      return fallbackPoint;
    };

    const queryBestSurfaceHit = (frame: XRFrame) => {
      if (centerHitTestSource) {
        const centerHit = pickFlatSurfaceHit(frame.getHitTestResults(centerHitTestSource), camPos);
        if (centerHit) return centerHit;
      }
      if (angledHitTestSource) {
        return pickFlatSurfaceHit(frame.getHitTestResults(angledHitTestSource), camPos);
      }
      return null;
    };

    const attachAnchorFromHit = (hitToAnchor: XRHitTestResult) => {
      if (typeof hitToAnchor.createAnchor !== 'function' || creatingAnchor) {
        cancelHitTestSources();
        return;
      }
      creatingAnchor = true;
      hitToAnchor
        .createAnchor()
        .then((anchor) => {
          if (ended || !isPlaced) {
            anchor.delete?.();
          } else {
            placedAnchor?.delete?.();
            placedAnchor = anchor;
            anchorStabilized = false;
          }
          cancelHitTestSources();
        })
        .catch(() => {
          cancelHitTestSources();
        })
        .finally(() => {
          creatingAnchor = false;
        });
    };

    const lockAtPosition = (
      targetPos: THREE.Vector3,
      hitToAnchor: XRHitTestResult | null,
      nowMs: number
    ) => {
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
      anchorStabilized = false;

      overlayHandle?.setUIState('placed');
      onStatusChange?.('placed');

      if (hitToAnchor) {
        needsSurfaceAnchorUpgrade = false;
        attachAnchorFromHit(hitToAnchor);
      } else {
        needsSurfaceAnchorUpgrade = true;
        fallbackPlacedAt = nowMs;
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

      // 1. LOCKED MODE: Dish is automatically locked; track XRAnchor with zero micro-jitter
      if (isPlaced) {
        // If placed via initial 650ms fallback, silently upgrade height & XRAnchor once on first real hit
        if (needsSurfaceAnchorUpgrade && !placedAnchor && !creatingAnchor) {
          if (time - fallbackPlacedAt > 2500) {
            needsSurfaceAnchorUpgrade = false;
            cancelHitTestSources();
          } else {
            const upgradeHit = queryBestSurfaceHit(frame);
            if (upgradeHit) {
              needsSurfaceAnchorUpgrade = false;
              dishRoot.position.y = upgradeHit.pos.y;
              attachAnchorFromHit(upgradeHit.hit);
            }
          }
        }

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
                dishRoot.position.lerp(anchorPos, 0.45);
              } else if (drift >= 0.003) {
                dishRoot.position.lerp(anchorPos, 0.2);
              }
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

      // 2. INITIAL AUTO-LOCK: Query flat surface hits and lock automatically once ready
      const bestHit = queryBestSurfaceHit(frame);

      if (bestHit) {
        reticle.position.copy(bestHit.pos);
        reticle.visible = !modelReady;

        if (modelReady) {
          lockAtPosition(bestHit.pos, bestHit.hit, time);
        } else {
          overlayHandle?.setUIState('scanning', 'Surface found — locking 1:1 dish…');
        }
      } else {
        const elapsedMs = time - (firstFrameTime ?? time);
        if (modelReady && elapsedMs >= 650) {
          // Automatic placement fallback so AR always displays & locks immediately
          const horizLen = Math.hypot(camDir.x, camDir.z) || 1;
          const fallbackPos = new THREE.Vector3(
            camPos.x + (camDir.x / horizLen) * 0.65,
            camPos.y - 0.4,
            camPos.z + (camDir.z / horizLen) * 0.65
          );
          lockAtPosition(fallbackPos, null, time);
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
