import * as THREE from 'three';
import { getScene, getCameraMode, getBoundingSphere, getActiveCamera, getControls } from './scene.js';

export async function generateSpriteSheets({
  animations,        // [{clip, name}]
  selectedAngles,    // [0, 90, 180, 270, ...] — relative offsets
  baseAzimuth = 0,   // current camera azimuth in degrees
  frameCount,        // fixed frame count (frames mode) or null
  fps,               // fps value (fps mode) or null
  resolution,
  transparent,
  model,
  onProgress
}) {
  const scene = getScene();
  const isOrtho = getCameraMode() === 'orthographic';
  const sphere = getBoundingSphere();
  if (!sphere) throw new Error('No model bounding sphere');

  // Offscreen renderer
  const offRenderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: transparent,
    preserveDrawingBuffer: true
  });
  offRenderer.setSize(resolution, resolution);
  offRenderer.outputColorSpace = THREE.SRGBColorSpace;
  offRenderer.toneMapping = THREE.ACESFilmicToneMapping;

  // Capture preview camera state: target (pan), distance, elevation, azimuth
  // All computed relative to controls.target (not sphere.center) to match preview exactly
  const previewCam = getActiveCamera();
  const previewTarget = getControls().target.clone();
  const camOffset = previewCam.position.clone().sub(previewTarget);
  const dist = camOffset.length();
  const elevation = camOffset.y;
  const horizDist = Math.sqrt(camOffset.x * camOffset.x + camOffset.z * camOffset.z);
  // Compute base azimuth relative to controls.target (ignore passed-in baseAzimuth)
  const localBaseRad = Math.atan2(-camOffset.x, camOffset.z);
  let localBaseAzimuth = THREE.MathUtils.radToDeg(localBaseRad);
  if (localBaseAzimuth < 0) localBaseAzimuth += 360;

  let captureCam;
  if (isOrtho) {
    const s = previewCam.top;
    captureCam = new THREE.OrthographicCamera(-s, s, s, -s, 0.01, dist * 4);
  } else {
    captureCam = new THREE.PerspectiveCamera(previewCam.fov, 1, 0.01, dist * 4);
  }
  // Copy zoom — OrbitControls uses camera.zoom for orthographic zoom
  // (for perspective it changes distance instead, but copy anyway for safety)
  captureCam.zoom = previewCam.zoom;
  captureCam.updateProjectionMatrix();

  // Mixer for seeking
  const mixer = new THREE.AnimationMixer(model);

  const hasAnimations = animations.length > 0;
  const results = [];

  // Pre-calculate frame counts per animation for progress tracking
  function getFramesForAnim(animData) {
    if (!hasAnimations) return 1;
    if (fps && animData.clip) return Math.max(1, Math.round(fps * animData.clip.duration));
    return frameCount || 1;
  }

  const totalSteps = animations.reduce((sum, a) => sum + selectedAngles.length * getFramesForAnim(a), 0);
  let step = 0;

  for (const animData of animations) {
    const framesPerAngle = getFramesForAnim(animData);
    const cols = framesPerAngle;
    const rows = selectedAngles.length;
    const sheetW = cols * resolution;
    const sheetH = rows * resolution;

    // 2D canvas for sprite sheet
    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = sheetW;
    sheetCanvas.height = sheetH;
    const ctx = sheetCanvas.getContext('2d');

    // Prepare animation action
    let action = null;
    let duration = 1;
    if (hasAnimations && animData.clip) {
      action = mixer.clipAction(animData.clip);
      action.play();
      duration = animData.clip.duration;
    }

    const individualFrames = [];

    for (let row = 0; row < selectedAngles.length; row++) {
      const angleDeg = (localBaseAzimuth + selectedAngles[row]) % 360;
      positionCamera(captureCam, angleDeg, previewTarget, horizDist, elevation);

      for (let col = 0; col < framesPerAngle; col++) {
        // Seek animation
        if (action) {
          const seekTime = (col / framesPerAngle) * duration;
          mixer.setTime(seekTime);
          scene.updateMatrixWorld(true);
        }

        // Render
        offRenderer.render(scene, captureCam);

        // Draw to sprite sheet
        ctx.drawImage(offRenderer.domElement, col * resolution, row * resolution);

        // Save individual frame
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = resolution;
        frameCanvas.height = resolution;
        const fctx = frameCanvas.getContext('2d');
        fctx.drawImage(offRenderer.domElement, 0, 0);
        individualFrames.push(frameCanvas);

        step++;
        if (onProgress) onProgress(step / totalSteps);

        // Yield to event loop every 4 frames
        if (step % 4 === 0) {
          await new Promise(r => setTimeout(r, 0));
        }
      }
    }

    // Stop the action
    if (action) {
      action.stop();
      mixer.uncacheAction(animData.clip);
    }

    // Convert sheet to blob
    const sheetBlob = await new Promise(resolve =>
      sheetCanvas.toBlob(resolve, 'image/png')
    );

    results.push({
      name: animData.name,
      sheetBlob,
      sheetUrl: URL.createObjectURL(sheetBlob),
      frames: individualFrames,
      cols,
      rows,
      width: sheetW,
      height: sheetH
    });
  }

  // Cleanup
  mixer.stopAllAction();
  offRenderer.dispose();

  return results;
}

function positionCamera(camera, angleDeg, target, horizDist, elevation) {
  if (angleDeg === 'top') {
    const totalDist = Math.sqrt(horizDist * horizDist + elevation * elevation);
    camera.position.set(target.x, target.y + totalDist, target.z + 0.01);
  } else {
    const rad = THREE.MathUtils.degToRad(Number(angleDeg));
    camera.position.set(
      target.x - horizDist * Math.sin(rad),
      target.y + elevation,
      target.z + horizDist * Math.cos(rad)
    );
  }

  camera.lookAt(target);
  camera.updateProjectionMatrix();
}

export async function exportZip(results) {
  const zip = new JSZip();

  for (const result of results) {
    const folder = results.length > 1
      ? zip.folder(sanitizeName(result.name))
      : zip;

    folder.file('spritesheet.png', result.sheetBlob);

    const framesFolder = folder.folder('frames');
    for (let i = 0; i < result.frames.length; i++) {
      const blob = await new Promise(resolve =>
        result.frames[i].toBlob(resolve, 'image/png')
      );
      framesFolder.file(`frame_${String(i).padStart(4, '0')}.png`, blob);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'spritesheet.zip');
}

function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50) || 'animation';
}
