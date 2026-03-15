import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { addToScene, removeFromScene, setupMixer, playAnimation, disposeMixer, setModelBoundingSphere, fitToFrame } from './scene.js';

let currentModel = null;
let currentAnimations = [];
let zipBlobUrls = []; // track blob URLs for cleanup

const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();

export function getCurrentModel() { return currentModel; }
export function getAnimations() { return currentAnimations; }

export async function loadModelFromFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const url = URL.createObjectURL(file);

  try {
    let object, animations;

    if (ext === 'glb' || ext === 'gltf') {
      const gltf = await new Promise((resolve, reject) => {
        gltfLoader.load(url, resolve, undefined, reject);
      });
      object = gltf.scene;
      animations = gltf.animations || [];
    } else if (ext === 'fbx') {
      object = await new Promise((resolve, reject) => {
        fbxLoader.load(url, resolve, undefined, reject);
      });
      animations = object.animations || [];
    } else {
      throw new Error('Unsupported format: ' + ext);
    }

    // Clear previous
    clearModel();

    // Normalize model
    normalizeModel(object);

    // Add to scene
    addToScene(object);
    currentModel = object;
    currentAnimations = animations;

    // Setup animation mixer
    if (animations.length > 0) {
      setupMixer(object);
      playAnimation(animations[0]);
    }

    fitToFrame();

    return { object, animations };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Load a model from extracted ZIP contents.
 * @param {Object} fileMap - Map of lowercase filename -> { blob, url }
 * @param {string} modelFileName - The model file name found in the ZIP
 */
export async function loadModelFromZip(fileMap, modelFileName) {
  const ext = modelFileName.split('.').pop().toLowerCase();
  const modelEntry = fileMap[modelFileName.toLowerCase()];
  if (!modelEntry) throw new Error('Model file not found in ZIP');

  try {
    let object, animations;

    if (ext === 'glb' || ext === 'gltf') {
      // For GLTF/GLB, create a custom manager that resolves relative paths to blob URLs
      const manager = createZipLoadingManager(fileMap);
      const loader = new GLTFLoader(manager);
      const gltf = await new Promise((resolve, reject) => {
        loader.load(modelEntry.url, resolve, undefined, reject);
      });
      object = gltf.scene;
      animations = gltf.animations || [];
    } else if (ext === 'fbx') {
      const manager = createZipLoadingManager(fileMap);
      const loader = new FBXLoader(manager);
      object = await new Promise((resolve, reject) => {
        loader.load(modelEntry.url, resolve, undefined, reject);
      });
      animations = object.animations || [];
    } else {
      throw new Error('Unsupported format: ' + ext);
    }

    // Clear previous
    clearModel();

    // Normalize model
    normalizeModel(object);

    // Add to scene
    addToScene(object);
    currentModel = object;
    currentAnimations = animations;

    // Setup animation mixer
    if (animations.length > 0) {
      setupMixer(object);
      playAnimation(animations[0]);
    }

    fitToFrame();

    return { object, animations };
  } catch (err) {
    revokeZipUrls();
    throw err;
  }
}

/**
 * Creates a THREE.LoadingManager that resolves texture filenames to blob URLs from the ZIP.
 */
function createZipLoadingManager(fileMap) {
  const manager = new THREE.LoadingManager();

  manager.setURLModifier((url) => {
    // url might be a full blob URL with a filename appended, or a relative path
    // Extract just the filename part
    let filename;
    try {
      // Handle blob: URLs where Three.js appends the texture path
      const urlObj = new URL(url);
      filename = urlObj.pathname.split('/').pop();
    } catch {
      // Not a valid URL, treat as path
      filename = url.split('/').pop().split('\\').pop();
    }

    const key = filename.toLowerCase();
    if (fileMap[key] && fileMap[key].url) {
      return fileMap[key].url;
    }

    // Try without query strings
    const cleanKey = key.split('?')[0];
    if (fileMap[cleanKey] && fileMap[cleanKey].url) {
      return fileMap[cleanKey].url;
    }

    return url;
  });

  return manager;
}

/**
 * Extract a ZIP file and return { fileMap, modelFileName }
 * fileMap: lowercaseFilename -> { blob, url }
 */
export async function extractZipFile(zipFile) {
  const arrayBuffer = await zipFile.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const modelExtensions = ['fbx', 'glb', 'gltf'];
  const fileMap = {};
  let modelFileName = null;

  const entries = [];
  zip.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir) entries.push({ relativePath, zipEntry });
  });

  // Process all files
  for (const { relativePath, zipEntry } of entries) {
    const fileName = relativePath.split('/').pop();
    if (!fileName) continue;

    const ext = fileName.split('.').pop().toLowerCase();

    // Determine MIME type
    let mimeType = 'application/octet-stream';
    if (['png'].includes(ext)) mimeType = 'image/png';
    else if (['jpg', 'jpeg'].includes(ext)) mimeType = 'image/jpeg';
    else if (['webp'].includes(ext)) mimeType = 'image/webp';
    else if (['tga'].includes(ext)) mimeType = 'image/x-tga';
    else if (['bmp'].includes(ext)) mimeType = 'image/bmp';
    else if (['gif'].includes(ext)) mimeType = 'image/gif';
    else if (['glb'].includes(ext)) mimeType = 'model/gltf-binary';
    else if (['gltf'].includes(ext)) mimeType = 'model/gltf+json';
    else if (['bin'].includes(ext)) mimeType = 'application/octet-stream';

    const data = await zipEntry.async('arraybuffer');
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);

    fileMap[fileName.toLowerCase()] = { blob, url };
    zipBlobUrls.push(url);

    // Check if this is a model file
    if (modelExtensions.includes(ext)) {
      modelFileName = fileName;
    }
  }

  if (!modelFileName) {
    revokeZipUrls();
    throw new Error('No supported model file (.fbx, .glb, .gltf) found in ZIP');
  }

  return { fileMap, modelFileName };
}

function revokeZipUrls() {
  zipBlobUrls.forEach(url => URL.revokeObjectURL(url));
  zipBlobUrls = [];
}

function normalizeModel(object) {
  // Reset any existing transforms to get clean measurements
  object.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim === 0) return;
  const scale = 2 / maxDim;

  // Wrap in a group so we can offset without fighting the model's own transforms
  const center = box.getCenter(new THREE.Vector3());

  object.scale.multiplyScalar(scale);
  object.updateMatrixWorld(true);

  // Recalculate after scale
  const box2 = new THREE.Box3().setFromObject(object);
  const center2 = box2.getCenter(new THREE.Vector3());

  // Center on all axes, then shift so bottom sits at y=0
  object.position.sub(center2);
  object.position.y += box2.getSize(new THREE.Vector3()).y / 2;

  object.updateMatrixWorld(true);

  // Final bounding sphere — center should now be at (0, height/2, 0)
  const finalBox = new THREE.Box3().setFromObject(object);
  const sphere = new THREE.Sphere();
  finalBox.getBoundingSphere(sphere);
  setModelBoundingSphere(sphere);
}

export function clearModel() {
  if (currentModel) {
    removeFromScene(currentModel);
    disposeObject(currentModel);
    currentModel = null;
  }
  currentAnimations = [];
  disposeMixer();
  revokeZipUrls();
}

function disposeObject(obj) {
  obj.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach(mat => {
        Object.values(mat).forEach(val => {
          if (val && typeof val.dispose === 'function') val.dispose();
        });
        mat.dispose();
      });
    }
  });
}
