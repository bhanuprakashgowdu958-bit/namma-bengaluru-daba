import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface AnchoredARSessionHandle {
  stop: () => Promise<void>;
}

export interface StartAnchoredTableAROptions {
  glbUrl: string;
  title: string;
  onStatusChange?: (status: 'scanning' | 'ready' | 'placed' | 'ended') => void;
  onError?: (message: string) => void;
}

type XRFrameWithAnchor = XRFrame & {
  createAnchor?: (pose: XRRigidTransform, space: XRSpace) => Promise<XRAnchor>;
};

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
      size * 0.08,
      size * 0.5,
      size * 0.5,
      size * 0.5
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.44)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.18)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createReticleMesh(): { group: THREE.Group; pulseRing: THREE.Mesh } {
  const group = new THREE.Group();

  const outerGeo = new THREE.RingGeometry(0.085, 0.108, 48);
  outerGeo.rotateX(-Math.PI / 2);
  const outerMat = new THREE.MeshBasicMaterial({
    color: 0xf4a26e,
    transparent: true,
    opacity: 0.92,
    depthWrite: false
  });
  const pulseRing = new THREE.Mesh(outerGeo, outerMat);
  group.add(pulseRing);

  const innerGeo = new THREE.CircleGeometry(0.014, 32);
  innerGeo.rotateX(-Math.PI / 2);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    depthWrite: false
  });
  group.add(new THREE.Mesh(innerGeo, innerMat));

  group.visible = false;
  return { group, pulseRing };
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
    'position:fixed;inset:0;z-index:9999;pointer-events:auto;touch-action:pan-y;display:flex;flex-direction:column;justify-content:space-between;padding:max(16px,env(safe-area-inset-top)) 16px max(22px,env(safe-area-inset-bottom)) 16px;font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#F7F3EC;';

  const blockXRSelect = (el: HTMLElement) => {
    el.addEventListener('beforexrselect', (e) => {
      e.preventDefault();
    });
  };
  blockXRSelect(overlay);

  // Horizontal swipe anywhere on camera feed spins the locked dish smoothly in place
  let dragStartX: number | null = null;
  let lastDragX = 0;
  overlay.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement)?.closest('button')) return;
    dragStartX = e.clientX;
    lastDragX = e.clientX;
  });
  overlay.addEventListener('pointermove', (e) => {
    if (dragStartX === null) return;
    const dx = e.clientX - lastDragX;
    lastDragX = e.clientX;
    if (Math.abs(dx) > 0.5) {
      callbacks.onRotate(dx * 0.0085);
    }
  });
  const endDrag = () => {
    dragStartX = null;
  };
  overlay.addEventListener('pointerup', endDrag);
  overlay.addEventListener('pointercancel', endDrag);

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
  hintPill.textContent = 'Move phone gently over your table or flat surface…';

  const controlsRow = document.createElement('div');
  controlsRow.style.cssText =
    'pointer-events:auto;display:none;align-items:center;justify-content:center;gap:10px;';

  const rotateLeftBtn = document.createElement('button');
  rotateLeftBtn.type = 'button';
  rotateLeftBtn.textContent = '↺';
  rotateLeftBtn.setAttribute('aria-label', 'Rotate dish left');
  rotateLeftBtn.style.cssText =
    'width:44px;height:44px;border-radius:999px;border:1px solid rgba(255,255,255,0.22);background:rgba(14,14,17,0.82);backdrop-filter:blur(14px);color:#F7F3EC;font-size:18px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;';
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
        hintPill.textContent = customHint ?? 'Move phone gently over your table or flat surface…';
        controlsRow.style.display = 'none';
      } else {
        hintPill.textContent =
          customHint ?? 'Locked on surface (1:1 scale) • Walk around or swipe to spin';
        controlsRow.style.display = 'flex';
      }
    }
  };
}

/**
 * Launches a Google-Animals-style WebXR Table AR session for Android Chrome.
 * Waits for a verified flat surface (`plane` or multi-frame stable `point` consensus) instead of
 * floating in mid-air, anchors directly to the physical surface via hardware `XRAnchor`
 * (`hit.createAnchor()` + `frame.createAnchor()` fallback), and grounds dishes with PBR studio
 * reflections, directional cast shadows, contact AO shadow, and a 4 mm anti-jitter deadband.
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
  let planeCenterSource: XRHitTestSource | null = null;
  let planeDownSource: XRHitTestSource | null = null;
  let pointCenterSource: XRHitTestSource | null = null;
  let pointDownSource: XRHitTestSource | null = null;
  let placedAnchor: XRAnchor | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let envRenderTarget: THREE.WebGLRenderTarget | null = null;
  let overlayHandle: ReturnType<typeof buildOverlayElement> | null = null;
  let ended = false;

  let isPlaced = false;
  let lockedByPlane = false;
  let upgradeWindowStart = 0;
  let anchorStabilized = false;
  let creatingAnchor = false;
  let userYaw = 0;

  const cancelPointSources = () => {
    try {
      pointCenterSource?.cancel();
    } catch {
      // Ignore
    }
    pointCenterSource = null;
    try {
      pointDownSource?.cancel();
    } catch {
      // Ignore
    }
    pointDownSource = null;
  };

  const cancelAllHitTestSources = () => {
    try {
      planeCenterSource?.cancel();
    } catch {
      // Ignore
    }
    planeCenterSource = null;
    try {
      planeDownSource?.cancel();
    } catch {
      // Ignore
    }
    planeDownSource = null;
    cancelPointSources();
  };

  const cleanup = async () => {
    if (ended) return;
    ended = true;

    cancelAllHitTestSources();

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

    if (envRenderTarget) {
      envRenderTarget.dispose();
      envRenderTarget = null;
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.xr.enabled = true;

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

    // Neutral studio IBL so ceramic plates & food glazes catch natural highlights
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      envRenderTarget = pmrem.fromScene(roomEnv, 0.04);
      scene.environment = envRenderTarget.texture;
      roomEnv.dispose();
      pmrem.dispose();
    } catch {
      // Fallback to direct lights below
    }

    const hemiLight = new THREE.HemisphereLight(0xfff9f0, 0x3b3028, 1.15);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff3e2, 1.35);
    dirLight.position.set(0.55, 1.75, 0.85);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.2;
    dirLight.shadow.camera.far = 4.5;
    dirLight.shadow.camera.left = -0.85;
    dirLight.shadow.camera.right = 0.85;
    dirLight.shadow.camera.top = 0.85;
    dirLight.shadow.camera.bottom = -0.85;
    dirLight.shadow.bias = -0.0004;
    scene.add(dirLight);
    scene.add(dirLight.target);

    const { group: reticle, pulseRing } = createReticleMesh();
    scene.add(reticle);

    const dishRoot = new THREE.Group();
    dishRoot.visible = false;
    scene.add(dishRoot);

    // Keep shadow light aimed right at the anchored dish position
    dirLight.target = dishRoot;

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
        loadedModel.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
        dishContent.add(loadedModel);

        // Grounded real directional shadow catcher + soft ambient occlusion disc directly on surface
        const shadowSpan = Math.max(size.x, size.z, 0.26) * 1.35;

        const catcherGeo = new THREE.PlaneGeometry(shadowSpan * 1.4, shadowSpan * 1.4);
        catcherGeo.rotateX(-Math.PI / 2);
        const catcherMat = new THREE.ShadowMaterial({ opacity: 0.42 });
        const catcherMesh = new THREE.Mesh(catcherGeo, catcherMat);
        catcherMesh.position.y = 0;
        catcherMesh.receiveShadow = true;
        dishContent.add(catcherMesh);

        const aoGeo = new THREE.PlaneGeometry(shadowSpan, shadowSpan);
        aoGeo.rotateX(-Math.PI / 2);
        const aoMat = new THREE.MeshBasicMaterial({
          map: createContactShadowTexture(),
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: 1
        });
        const aoMesh = new THREE.Mesh(aoGeo, aoMat);
        aoMesh.position.y = -0.0005;
        aoMesh.renderOrder = -1;
        dishContent.add(aoMesh);

        modelReady = true;
      })
      .catch(() => {
        onError?.('Could not load 3D dish model for Table AR.');
        void cleanup();
      });

    const viewerSpace = await session.requestReferenceSpace('viewer');

    const requestHitSource = async (
      entityType: 'plane' | 'point',
      ray?: XRRay
    ): Promise<XRHitTestSource | null> => {
      try {
        const initWithEntity: Record<string, unknown> = {
          space: viewerSpace,
          entityTypes: [entityType]
        };
        if (ray) initWithEntity.offsetRay = ray;
        const src = await (
          session as XRSession & {
            requestHitTestSource?: (init: Record<string, unknown>) => Promise<XRHitTestSource>;
          }
        ).requestHitTestSource?.(initWithEntity);
        if (src) return src;
      } catch {
        if (entityType === 'point') return null;
      }

      if (entityType === 'plane') {
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
      }
      return null;
    };

    const downwardRay =
      typeof XRRay === 'function' && typeof DOMPoint === 'function'
        ? new XRRay(new DOMPoint(0, 0, 0), { x: 0, y: -0.37, z: -0.929 })
        : undefined;

    planeCenterSource = await requestHitSource('plane');
    if (downwardRay) {
      planeDownSource = await requestHitSource('plane', downwardRay);
    }
    pointCenterSource = await requestHitSource('point');
    if (downwardRay) {
      pointDownSource = await requestHitSource('point', downwardRay);
    }

    const tempMatrix = new THREE.Matrix4();
    const camPos = new THREE.Vector3();
    const anchorPos = new THREE.Vector3();
    const anchorQuat = new THREE.Quaternion();
    const anchorScale = new THREE.Vector3();

    let firstFrameTime: number | null = null;
    let yawInitialized = false;
    let placedAtTime = 0;
    let needsAnchorRetry = false;

    const planeCandidateWindow: THREE.Vector3[] = [];
    const pointCandidateWindow: THREE.Vector3[] = [];
    const lastReticlePos = new THREE.Vector3();
    let hasReticlePos = false;

    const pickHit = (
      source: XRHitTestSource | null,
      frame: XRFrame,
      requireUpwardNormal: boolean
    ): { hit: XRHitTestResult; pos: THREE.Vector3 } | null => {
      if (!source) return null;
      const results = frame.getHitTestResults(source);
      for (const res of results) {
        const pose = res.getPose(referenceSpace);
        if (!pose) continue;

        tempMatrix.fromArray(pose.transform.matrix);
        const pos = new THREE.Vector3().setFromMatrixPosition(tempMatrix);
        const dist = pos.distanceTo(camPos);
        if (dist < 0.18 || dist > 3.2) continue;

        if (requireUpwardNormal) {
          // Strict upward-facing flat plane (normal dot +Y > 0.72)
          if (pose.transform.matrix[5] > 0.72) {
            return { hit: res, pos };
          }
        } else if (pose.transform.matrix[5] > 0.6 || pos.y < camPos.y - 0.06) {
          return { hit: res, pos };
        }
      }
      return null;
    };

    const queryPlaneHit = (frame: XRFrame) =>
      pickHit(planeCenterSource, frame, true) ?? pickHit(planeDownSource, frame, true);

    const queryPointHit = (frame: XRFrame) =>
      pickHit(pointCenterSource, frame, false) ?? pickHit(pointDownSource, frame, false);

    // Must be called synchronously inside XRFrame callback!
    const createAnchorInFrame = (
      frame: XRFrame,
      targetPos: THREE.Vector3,
      hitResult: XRHitTestResult | null,
      cancelOnSuccess: boolean
    ) => {
      if (creatingAnchor) return;
      const frameWithAnchor = frame as XRFrameWithAnchor;

      let anchorPromise: Promise<XRAnchor> | undefined;
      if (hitResult && typeof hitResult.createAnchor === 'function') {
        try {
          anchorPromise = hitResult.createAnchor();
        } catch {
          anchorPromise = undefined;
        }
      }
      if (
        !anchorPromise &&
        typeof frameWithAnchor.createAnchor === 'function' &&
        typeof XRRigidTransform === 'function'
      ) {
        try {
          const transform = new XRRigidTransform({
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z,
            w: 1
          });
          anchorPromise = frameWithAnchor.createAnchor(transform, referenceSpace);
        } catch {
          anchorPromise = undefined;
        }
      }

      if (!anchorPromise) {
        needsAnchorRetry = typeof frameWithAnchor.createAnchor === 'function';
        return;
      }

      creatingAnchor = true;
      needsAnchorRetry = false;
      anchorPromise
        .then((anchor) => {
          if (ended || !isPlaced) {
            anchor.delete?.();
          } else {
            placedAnchor?.delete?.();
            placedAnchor = anchor;
            anchorStabilized = false;
            if (cancelOnSuccess) {
              cancelAllHitTestSources();
            }
          }
        })
        .catch(() => {
          // If hitResult.createAnchor() rejected (common on raw 'point' hits), schedule synchronous
          // frame.createAnchor() retry on the next XRFrame.
          needsAnchorRetry = true;
        })
        .finally(() => {
          creatingAnchor = false;
        });
    };

    const lockAtPosition = (
      frame: XRFrame,
      targetPos: THREE.Vector3,
      hitResult: XRHitTestResult | null,
      isRealPlane: boolean,
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
      dirLight.position.set(targetPos.x + 0.55, targetPos.y + 1.75, targetPos.z + 0.85);

      reticle.visible = false;
      isPlaced = true;
      lockedByPlane = isRealPlane;
      placedAtTime = nowMs;
      upgradeWindowStart = nowMs;
      anchorStabilized = false;

      // Subtle Google-Animals-style landing drop-settle
      dishContent.scale.setScalar(0.84);
      dishContent.position.y = 0.022;

      overlayHandle?.setUIState('placed');
      onStatusChange?.('placed');

      if (isRealPlane) {
        cancelPointSources();
        createAnchorInFrame(frame, targetPos, hitResult, true);
      } else {
        cancelPointSources();
        createAnchorInFrame(frame, targetPos, null, false);
      }
    };

    const averagePoints = (pts: THREE.Vector3[]): THREE.Vector3 => {
      const sum = new THREE.Vector3();
      for (const p of pts) sum.add(p);
      return sum.divideScalar(pts.length);
    };

    const isClusterStable = (pts: THREE.Vector3[], maxVerticalSpread: number, maxLateralSpread: number) => {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
      }
      return (
        maxY - minY <= maxVerticalSpread &&
        Math.hypot(maxX - minX, maxZ - minZ) <= maxLateralSpread
      );
    };

    renderer.setAnimationLoop((time, frame: XRFrame | undefined) => {
      if (!frame || ended || !renderer) return;
      if (firstFrameTime === null) firstFrameTime = time;

      const viewerPose = frame.getViewerPose(referenceSpace);
      if (viewerPose) {
        const m = viewerPose.transform.matrix;
        camPos.set(m[12], m[13], m[14]);
      } else {
        const xrCam = renderer.xr.getCamera();
        camPos.setFromMatrixPosition(xrCam.matrixWorld);
      }

      // 1. LOCKED MODE: Update hardware XRAnchor with 4 mm anti-jitter deadband & strict gravity lock
      if (isPlaced) {
        // Silky 220ms landing settle ease-out
        const sincePlaced = time - placedAtTime;
        if (sincePlaced < 240) {
          const t = Math.min(1, sincePlaced / 240);
          const eased = 1 - Math.pow(1 - t, 3);
          dishContent.scale.setScalar(0.84 + 0.16 * eased);
          dishContent.position.y = 0.022 * (1 - eased);
        } else {
          dishContent.scale.setScalar(1);
          dishContent.position.y = 0;
        }

        // If placed via point-consensus, silently upgrade Y + anchor once if real ARCore plane locks near it
        if (!lockedByPlane && planeCenterSource && !creatingAnchor) {
          if (time - upgradeWindowStart > 3000) {
            lockedByPlane = true;
            cancelAllHitTestSources();
          } else {
            const planeHit = queryPlaneHit(frame);
            if (planeHit) {
              const lateral = Math.hypot(
                planeHit.pos.x - dishRoot.position.x,
                planeHit.pos.z - dishRoot.position.z
              );
              const vertDiff = Math.abs(planeHit.pos.y - dishRoot.position.y);
              if (lateral < 0.35 && vertDiff < 0.14) {
                lockedByPlane = true;
                dishRoot.position.y = planeHit.pos.y;
                const refinedPos = dishRoot.position.clone();
                createAnchorInFrame(frame, refinedPos, null, true);
              }
            }
          }
        }

        if (needsAnchorRetry && !placedAnchor && !creatingAnchor) {
          createAnchorInFrame(frame, dishRoot.position.clone(), null, lockedByPlane);
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
                dishRoot.position.lerp(anchorPos, 0.38);
              } else if (drift >= 0.004) {
                dishRoot.position.lerp(anchorPos, 0.16);
              }
              // < 4 mm sub-millimeter tracking micro-jitter ignored completely
            }
          }
        }

        dirLight.position.set(
          dishRoot.position.x + 0.55,
          dishRoot.position.y + 1.75,
          dishRoot.position.z + 0.85
        );
        dishRoot.quaternion.set(0, 0, 0, 1);
        dishRoot.visible = modelReady;
        reticle.visible = false;

        renderer.render(scene, camera);
        return;
      }

      // 2. SCANNING MODE: Wait for genuine flat plane or stable surface consensus (never float mid-air!)
      const planeHit = queryPlaneHit(frame);
      const pointHit = planeHit ? null : queryPointHit(frame);

      const activeHit = planeHit ?? pointHit;
      if (activeHit) {
        if (!hasReticlePos) {
          lastReticlePos.copy(activeHit.pos);
          hasReticlePos = true;
        } else {
          lastReticlePos.lerp(activeHit.pos, 0.35);
        }

        reticle.position.copy(lastReticlePos);
        const pulse = 1 + 0.06 * Math.sin(time * 0.006);
        pulseRing.scale.set(pulse, 1, pulse);
        reticle.visible = true;

        if (!modelReady) {
          overlayHandle?.setUIState('scanning', 'Flat surface detected — preparing 1:1 dish…');
        }
      } else {
        reticle.visible = false;
      }

      if (!modelReady) {
        renderer.render(scene, camera);
        return;
      }

      const elapsedMs = time - (firstFrameTime ?? time);

      // Path A: Verified ARCore horizontal plane (2 stable consecutive frames)
      if (planeHit) {
        planeCandidateWindow.push(planeHit.pos);
        if (planeCandidateWindow.length > 3) planeCandidateWindow.shift();

        if (
          planeCandidateWindow.length >= 2 &&
          isClusterStable(planeCandidateWindow, 0.02, 0.08)
        ) {
          const avgPlanePos = averagePoints(planeCandidateWindow);
          lockAtPosition(frame, avgPlanePos, planeHit.hit, true, time);
          renderer.render(scene, camera);
          return;
        }
      } else {
        planeCandidateWindow.length = 0;
      }

      // Path B: Stable textured-surface point consensus (6 consistent frames after >= 450ms SLAM warmup)
      if (pointHit && elapsedMs >= 450) {
        pointCandidateWindow.push(pointHit.pos);
        if (pointCandidateWindow.length > 6) pointCandidateWindow.shift();

        if (
          pointCandidateWindow.length >= 6 &&
          isClusterStable(pointCandidateWindow, 0.018, 0.09)
        ) {
          const avgPointPos = averagePoints(pointCandidateWindow);
          lockAtPosition(frame, avgPointPos, pointHit.hit, false, time);
          renderer.render(scene, camera);
          return;
        }
      }

      if (elapsedMs > 4000 && !hasReticlePos) {
        overlayHandle?.setUIState(
          'scanning',
          'Aim at a well-lit flat table or floor and move phone slowly side-to-side'
        );
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
