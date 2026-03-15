import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, perspCamera, orthoCamera, activeCamera, renderer, controls;
let ambientLight, hemiLight, customLight;
const clock = new THREE.Clock();
let mixer = null;
let currentAction = null;
let animationSpeed = 1.0;
let cameraMode = 'perspective';
let modelBoundingSphere = null;

const DEFAULT_CAM_POS = new THREE.Vector3(0, 1, 3);
const DEFAULT_CAM_TARGET = new THREE.Vector3(0, 1, 0);

export function initScene(canvas) {
  scene = new THREE.Scene();

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  updateRendererSize();

  // Cameras
  const aspect = canvas.clientWidth / canvas.clientHeight;
  perspCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
  perspCamera.position.copy(DEFAULT_CAM_POS);

  const frustum = 3;
  orthoCamera = new THREE.OrthographicCamera(
    -frustum * aspect, frustum * aspect, frustum, -frustum, 0.1, 1000
  );
  orthoCamera.position.copy(DEFAULT_CAM_POS);

  activeCamera = perspCamera;

  // Controls
  controls = new OrbitControls(activeCamera, canvas);
  controls.target.copy(DEFAULT_CAM_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.update();

  // Lights
  ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  // ResizeObserver reacts to both window resize AND layout changes (panel show/hide)
  const resizeObserver = new ResizeObserver(() => {
    updateRendererSize();
    updateCameraAspect();
  });
  resizeObserver.observe(canvas.parentElement);

  animate();
  return { scene, renderer };
}

function updateRendererSize() {
  const container = renderer.domElement.parentElement;
  if (!container) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h);
}

function updateCameraAspect() {
  const container = renderer.domElement.parentElement;
  if (!container) return;
  const aspect = container.clientWidth / container.clientHeight;

  perspCamera.aspect = aspect;
  perspCamera.updateProjectionMatrix();

  const frustum = orthoCamera.top;
  orthoCamera.left = -frustum * aspect;
  orthoCamera.right = frustum * aspect;
  orthoCamera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta * animationSpeed);
  controls.update();
  renderer.render(scene, activeCamera);
}

export function getScene() { return scene; }
export function getRenderer() { return renderer; }
export function getActiveCamera() { return activeCamera; }
export function getControls() { return controls; }
export function getCameraMode() { return cameraMode; }
export function getBoundingSphere() { return modelBoundingSphere; }
export function getMixer() { return mixer; }

// Returns current camera azimuth in degrees relative to model center
export function getCameraAzimuth() {
  if (!modelBoundingSphere) return 0;
  const { center } = modelBoundingSphere;
  const dx = activeCamera.position.x - center.x;
  const dz = activeCamera.position.z - center.z;
  // atan2 gives angle from +Z axis, negate X to match our convention
  const rad = Math.atan2(-dx, dz);
  let deg = THREE.MathUtils.radToDeg(rad);
  if (deg < 0) deg += 360;
  return deg;
}

export function addToScene(obj) { scene.add(obj); }
export function removeFromScene(obj) { scene.remove(obj); }

export function setModelBoundingSphere(sphere) {
  modelBoundingSphere = sphere;
}

export function switchCamera(mode) {
  cameraMode = mode;
  const oldCam = activeCamera;
  activeCamera = mode === 'perspective' ? perspCamera : orthoCamera;

  activeCamera.position.copy(oldCam.position);
  controls.object = activeCamera;

  if (mode === 'orthographic') {
    setOrthoFrustum(1.05);
  }

  updateCameraAspect();
  controls.update();
}

// Set ortho frustum to fit the model with given padding multiplier
function setOrthoFrustum(padding) {
  if (!modelBoundingSphere) return;
  const s = modelBoundingSphere.radius * padding;
  const aspect = renderer.domElement.clientWidth / renderer.domElement.clientHeight;
  orthoCamera.left = -s * aspect;
  orthoCamera.right = s * aspect;
  orthoCamera.top = s;
  orthoCamera.bottom = -s;
  orthoCamera.near = 0.01;
  orthoCamera.far = modelBoundingSphere.radius * 20;
  orthoCamera.updateProjectionMatrix();
}

// Fit model to frame — keeps current viewing angle, adjusts zoom/distance
export function fitToFrame() {
  if (!modelBoundingSphere) return;
  const { center, radius } = modelBoundingSphere;
  controls.target.copy(center);

  const dir = activeCamera.position.clone().sub(center).normalize();
  if (dir.lengthSq() < 0.001) dir.set(0, 0, 1);

  if (cameraMode === 'perspective') {
    const fov = perspCamera.fov * (Math.PI / 180);
    const dist = radius / Math.sin(fov / 2) * 1.1;
    activeCamera.position.copy(center).add(dir.multiplyScalar(dist));
  } else {
    setOrthoFrustum(1.05);
    activeCamera.position.copy(center).add(dir.multiplyScalar(radius * 4));
  }

  controls.update();
}

// Reset — return to front view + fit
export function resetCamera() {
  if (!modelBoundingSphere) {
    activeCamera.position.copy(DEFAULT_CAM_POS);
    controls.target.copy(DEFAULT_CAM_TARGET);
    controls.update();
    return;
  }

  const { center, radius } = modelBoundingSphere;
  controls.target.copy(center);

  if (cameraMode === 'perspective') {
    const fov = perspCamera.fov * (Math.PI / 180);
    const dist = radius / Math.sin(fov / 2) * 1.1;
    activeCamera.position.set(center.x, center.y, center.z + dist);
  } else {
    setOrthoFrustum(1.05);
    activeCamera.position.set(center.x, center.y, center.z + radius * 4);
  }

  controls.update();
}

export function setCameraAngle(angleDeg) {
  if (!modelBoundingSphere) return;
  const { center, radius } = modelBoundingSphere;
  const dist = radius * 3;

  if (angleDeg === 'top') {
    activeCamera.position.set(center.x, center.y + dist, center.z + 0.01);
  } else {
    const rad = THREE.MathUtils.degToRad(Number(angleDeg));
    activeCamera.position.set(
      center.x - dist * Math.sin(rad),
      center.y,
      center.z + dist * Math.cos(rad)
    );
  }

  controls.target.copy(center);
  if (cameraMode === 'orthographic') setOrthoFrustum(1.05);
  controls.update();
}

// Lighting
export function toggleCustomLight(enabled) {
  if (enabled && !customLight) {
    customLight = new THREE.DirectionalLight(0xffffff, 1);
    customLight.position.set(5, 10, 5);
    scene.add(customLight);
  } else if (!enabled && customLight) {
    scene.remove(customLight);
    customLight.dispose();
    customLight = null;
  }
}

export function setLightIntensity(val) {
  if (customLight) customLight.intensity = val;
}

export function setLightPosition(x, y, z) {
  if (customLight) customLight.position.set(x, y, z);
}

// Animation
export function setupMixer(object) {
  if (mixer) mixer.stopAllAction();
  mixer = new THREE.AnimationMixer(object);
  currentAction = null;
  animationSpeed = 1.0;
}

export function playAnimation(clip) {
  if (!mixer) return;
  if (currentAction) {
    currentAction.stop();
  }
  currentAction = mixer.clipAction(clip);
  currentAction.play();
}

export function togglePlayPause() {
  if (!currentAction) return;
  currentAction.paused = !currentAction.paused;
  return !currentAction.paused; // returns true if now playing
}

export function setAnimSpeed(speed) {
  animationSpeed = speed;
}

export function isPlaying() {
  return currentAction && !currentAction.paused;
}

// === MATERIAL FIXES ===

function forEachMaterial(model, fn) {
  model.traverse(child => {
    if (!child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach(mat => fn(mat, child));
  });
}

export function fixForceOpaque(model) {
  forEachMaterial(model, mat => {
    mat.transparent = false;
    mat.alphaTest = 0;
    mat.depthWrite = true;
    if (mat.opacity !== undefined) mat.opacity = 1;
    mat.needsUpdate = true;
  });
}

export function fixAlphaClip(model) {
  forEachMaterial(model, mat => {
    mat.transparent = false;
    mat.alphaTest = 0.5;
    mat.depthWrite = true;
    mat.needsUpdate = true;
  });
}

export function fixSingleSided(model) {
  forEachMaterial(model, mat => {
    mat.side = THREE.FrontSide;
    mat.needsUpdate = true;
  });
}

export function fixDoubleSided(model) {
  forEachMaterial(model, mat => {
    mat.side = THREE.DoubleSide;
    mat.needsUpdate = true;
  });
}

export function fixFlipNormals(model) {
  model.traverse(child => {
    if (!child.geometry) return;
    const normal = child.geometry.getAttribute('normal');
    if (!normal) return;
    for (let i = 0; i < normal.count; i++) {
      normal.setXYZ(i, -normal.getX(i), -normal.getY(i), -normal.getZ(i));
    }
    normal.needsUpdate = true;
  });
}

export function fixRecalcNormals(model) {
  model.traverse(child => {
    if (!child.geometry) return;
    child.geometry.computeVertexNormals();
  });
}

export function disposeMixer() {
  if (mixer) {
    mixer.stopAllAction();
    mixer = null;
  }
  currentAction = null;
}
