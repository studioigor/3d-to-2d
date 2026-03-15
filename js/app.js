import { detectLanguage, toggleLanguage, applyLanguage, t } from './modules/i18n.js';
import {
  initScene, switchCamera, fitToFrame, resetCamera, setCameraAngle,
  toggleCustomLight, setLightIntensity, setLightPosition,
  playAnimation, togglePlayPause, setAnimSpeed, isPlaying, getCameraMode,
  getCameraAzimuth,
  fixForceOpaque, fixAlphaClip, fixSingleSided, fixDoubleSided,
  fixFlipNormals, fixRecalcNormals
} from './modules/scene.js';
import { loadModelFromFile, loadModelFromZip, extractZipFile, clearModel, getAnimations, getCurrentModel } from './modules/loader.js';
import { generateSpriteSheets, exportZip } from './modules/capture.js';

// State
let spriteResults = [];
let activeResultIndex = 0;

// Init
detectLanguage();
const canvas = document.getElementById('viewport-canvas');
initScene(canvas);
applyLanguage();

// === UPLOAD ===
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

document.getElementById('btn-browse').addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', e => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('dragging');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragging');
});

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragging');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

async function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['glb', 'gltf', 'fbx', 'zip'].includes(ext)) {
    alert(t('dropHint'));
    return;
  }

  try {
    dropZone.classList.add('hidden');
    document.getElementById('app-main').classList.add('has-model');
    document.getElementById('controls-panel').hidden = false;
    document.getElementById('camera-presets').hidden = false;
    document.getElementById('render-frame').hidden = false;
    document.getElementById('file-name').textContent = file.name;

    let animations;

    if (ext === 'zip') {
      const { fileMap, modelFileName } = await extractZipFile(file);
      const result = await loadModelFromZip(fileMap, modelFileName);
      animations = result.animations;
    } else {
      const result = await loadModelFromFile(file);
      animations = result.animations;
    }

    // Wait a frame for ResizeObserver to fire after layout change
    await new Promise(r => requestAnimationFrame(r));
    fitToFrame();

    populateAnimations(animations);
    populateExportAnimations(animations);
    updateTotalFrames();
    document.getElementById('btn-generate').disabled = false;
  } catch (err) {
    console.error('Load error:', err);
    alert('Error loading model: ' + err.message);
    handleReset();
  }
}

// === RESET ===
document.getElementById('btn-reset').addEventListener('click', handleReset);

function handleReset() {
  clearModel();
  dropZone.classList.remove('hidden');
  document.getElementById('app-main').classList.remove('has-model');
  document.getElementById('controls-panel').hidden = true;
  document.getElementById('camera-presets').hidden = true;
  document.getElementById('render-frame').hidden = true;
  document.getElementById('btn-generate').disabled = true;
  document.getElementById('animation-select').innerHTML = '';
  document.getElementById('animation-checkboxes').innerHTML = '';
  fileInput.value = '';
  spriteResults = [];
}

// === ANIMATION PREVIEW ===
const animSelect = document.getElementById('animation-select');
const btnPlayPause = document.getElementById('btn-play-pause');
const speedSlider = document.getElementById('speed-slider');
const speedReadout = document.getElementById('speed-readout');

function populateAnimations(clips) {
  animSelect.innerHTML = '';
  const section = document.getElementById('animation-section');

  if (clips.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = t('noAnimations');
    animSelect.appendChild(opt);
    animSelect.disabled = true;
    btnPlayPause.disabled = true;
    speedSlider.disabled = true;
    section.querySelector('.section-body').style.opacity = '0.5';
    return;
  }

  animSelect.disabled = false;
  btnPlayPause.disabled = false;
  speedSlider.disabled = false;
  section.querySelector('.section-body').style.opacity = '1';

  clips.forEach((clip, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = clip.name || `Animation ${i + 1}`;
    animSelect.appendChild(opt);
  });

  updatePlayPauseIcon(true);
}

animSelect.addEventListener('change', () => {
  const clips = getAnimations();
  const idx = parseInt(animSelect.value);
  if (clips[idx]) {
    playAnimation(clips[idx]);
    updatePlayPauseIcon(true);
  }
});

btnPlayPause.addEventListener('click', () => {
  const nowPlaying = togglePlayPause();
  updatePlayPauseIcon(nowPlaying);
});

function updatePlayPauseIcon(playing) {
  document.getElementById('play-icon').style.display = playing ? 'none' : '';
  document.getElementById('pause-icon').style.display = playing ? '' : 'none';
}

speedSlider.addEventListener('input', () => {
  const val = parseFloat(speedSlider.value);
  setAnimSpeed(val);
  speedReadout.textContent = val.toFixed(1) + 'x';
});

// === CAMERA ===
document.getElementById('btn-perspective').addEventListener('click', () => {
  switchCamera('perspective');
  document.getElementById('btn-perspective').classList.add('active');
  document.getElementById('btn-orthographic').classList.remove('active');
});

document.getElementById('btn-orthographic').addEventListener('click', () => {
  switchCamera('orthographic');
  document.getElementById('btn-orthographic').classList.add('active');
  document.getElementById('btn-perspective').classList.remove('active');
});

document.getElementById('btn-fit').addEventListener('click', fitToFrame);
document.getElementById('btn-reset-cam').addEventListener('click', resetCamera);

// Camera presets
document.getElementById('camera-presets').addEventListener('click', e => {
  const btn = e.target.closest('.preset-btn');
  if (!btn) return;
  const angle = btn.dataset.angle;
  setCameraAngle(angle);

  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
});

// === LIGHTING ===
const chkCustomLight = document.getElementById('chk-custom-light');
const lightControls = document.getElementById('light-controls');

chkCustomLight.addEventListener('change', () => {
  toggleCustomLight(chkCustomLight.checked);
  lightControls.classList.toggle('disabled', !chkCustomLight.checked);
});

document.getElementById('light-intensity').addEventListener('input', e => {
  const val = parseFloat(e.target.value);
  setLightIntensity(val);
  document.getElementById('intensity-readout').textContent = val.toFixed(1);
});

['light-x', 'light-y', 'light-z'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    const x = parseFloat(document.getElementById('light-x').value);
    const y = parseFloat(document.getElementById('light-y').value);
    const z = parseFloat(document.getElementById('light-z').value);
    setLightPosition(x, y, z);
    document.getElementById('light-x-readout').textContent = x.toFixed(1);
    document.getElementById('light-y-readout').textContent = y.toFixed(1);
    document.getElementById('light-z-readout').textContent = z.toFixed(1);
  });
});

// === MATERIAL FIXES ===
document.getElementById('btn-fix-opaque').addEventListener('click', () => {
  const model = getCurrentModel();
  if (model) fixForceOpaque(model);
});

document.getElementById('btn-fix-alpha-clip').addEventListener('click', () => {
  const model = getCurrentModel();
  if (model) fixAlphaClip(model);
});

document.getElementById('btn-fix-single-sided').addEventListener('click', () => {
  const model = getCurrentModel();
  if (model) fixSingleSided(model);
});

document.getElementById('btn-fix-double-sided').addEventListener('click', () => {
  const model = getCurrentModel();
  if (model) fixDoubleSided(model);
});

document.getElementById('btn-fix-flip-normals').addEventListener('click', () => {
  const model = getCurrentModel();
  if (model) fixFlipNormals(model);
});

document.getElementById('btn-fix-recalc-normals').addEventListener('click', () => {
  const model = getCurrentModel();
  if (model) fixRecalcNormals(model);
});

// === EXPORT SETTINGS ===
const animCheckboxes = document.getElementById('animation-checkboxes');
const chkSelectAll = document.getElementById('chk-select-all-anims');
const frameCountInput = document.getElementById('frame-count');
const fpsValueInput = document.getElementById('fps-value');
let frameMode = 'frames'; // 'frames' or 'fps'

document.getElementById('btn-mode-frames').addEventListener('click', () => {
  frameMode = 'frames';
  document.getElementById('btn-mode-frames').classList.add('active');
  document.getElementById('btn-mode-fps').classList.remove('active');
  document.getElementById('frames-input-group').hidden = false;
  document.getElementById('fps-input-group').hidden = true;
  updateTotalFrames();
});

document.getElementById('btn-mode-fps').addEventListener('click', () => {
  frameMode = 'fps';
  document.getElementById('btn-mode-fps').classList.add('active');
  document.getElementById('btn-mode-frames').classList.remove('active');
  document.getElementById('fps-input-group').hidden = false;
  document.getElementById('frames-input-group').hidden = true;
  updateTotalFrames();
});

fpsValueInput.addEventListener('input', updateTotalFrames);

function populateExportAnimations(clips) {
  animCheckboxes.innerHTML = '';

  if (clips.length === 0) {
    const label = document.createElement('div');
    label.className = 'info-readout';
    label.textContent = t('staticModel');
    animCheckboxes.appendChild(label);
    chkSelectAll.disabled = true;
    chkSelectAll.checked = false;
    return;
  }

  chkSelectAll.disabled = false;
  chkSelectAll.checked = true;

  clips.forEach((clip, i) => {
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = true;
    chk.dataset.animIndex = i;
    chk.addEventListener('change', () => {
      updateSelectAllState();
      updateTotalFrames();
    });
    const span = document.createElement('span');
    span.textContent = clip.name || `Animation ${i + 1}`;
    label.appendChild(chk);
    label.appendChild(span);
    animCheckboxes.appendChild(label);
  });
}

chkSelectAll.addEventListener('change', () => {
  const boxes = animCheckboxes.querySelectorAll('input[type="checkbox"]');
  boxes.forEach(b => b.checked = chkSelectAll.checked);
  updateTotalFrames();
});

function updateSelectAllState() {
  const boxes = animCheckboxes.querySelectorAll('input[type="checkbox"]');
  const allChecked = Array.from(boxes).every(b => b.checked);
  chkSelectAll.checked = allChecked;
}

// Angle checkboxes
document.querySelectorAll('#angle-checkboxes input').forEach(chk => {
  chk.addEventListener('change', updateTotalFrames);
});

frameCountInput.addEventListener('input', updateTotalFrames);

function getSelectedAngles() {
  return Array.from(document.querySelectorAll('#angle-checkboxes input:checked'))
    .map(chk => Number(chk.dataset.angle));
}

function getSelectedAnimations() {
  const clips = getAnimations();
  if (clips.length === 0) return [{ clip: null, name: 'static' }];

  const indices = Array.from(animCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
    .map(chk => parseInt(chk.dataset.animIndex));

  return indices.map(i => ({ clip: clips[i], name: clips[i].name || `animation_${i + 1}` }));
}

function getEffectiveFrameCount() {
  if (frameMode === 'fps') {
    const fps = parseInt(fpsValueInput.value) || 12;
    const clips = getAnimations();
    const selectedAnims = getSelectedAnimations();
    if (clips.length === 0 || selectedAnims.length === 0) return 1;
    // Use the max duration among selected animations
    const maxDuration = Math.max(...selectedAnims.map(a => a.clip ? a.clip.duration : 0));
    return Math.max(1, Math.round(fps * maxDuration));
  }
  return parseInt(frameCountInput.value) || 1;
}

function updateTotalFrames() {
  const angles = getSelectedAngles().length || 1;
  const anims = getSelectedAnimations().length || 1;
  const frames = getEffectiveFrameCount();
  const hasAnims = getAnimations().length > 0;
  const total = anims * angles * (hasAnims ? frames : 1);

  document.getElementById('total-frames').textContent = total;

  // Check size
  const res = parseInt(document.getElementById('resolution-select').value);
  const framesPerAnim = hasAnims ? frames : 1;
  const cols = framesPerAnim;
  const rows = angles;
  const maxW = cols * res;
  const maxH = rows * res;

  const btn = document.getElementById('btn-generate');
  if (maxW > 16384 || maxH > 16384) {
    btn.disabled = true;
    btn.title = t('warning16k');
  } else {
    btn.disabled = !getCurrentModel() || getSelectedAngles().length === 0 ||
      (getAnimations().length > 0 && getSelectedAnimations().length === 0);
    btn.title = '';
  }
}

document.getElementById('resolution-select').addEventListener('change', updateTotalFrames);

// === GENERATE ===
const btnGenerate = document.getElementById('btn-generate');
const progressContainer = document.getElementById('progress-container');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

btnGenerate.addEventListener('click', async () => {
  const selectedAnims = getSelectedAnimations();
  const selectedAngles = getSelectedAngles();
  const fps = frameMode === 'fps' ? (parseInt(fpsValueInput.value) || 12) : null;
  const frameCount = fps ? null : (parseInt(frameCountInput.value) || 16);
  const resolution = parseInt(document.getElementById('resolution-select').value);
  const transparent = document.getElementById('chk-transparent').checked;
  const model = getCurrentModel();

  if (!model || selectedAngles.length === 0) return;
  if (selectedAnims.length === 0) return;

  btnGenerate.disabled = true;
  btnGenerate.textContent = t('generating');
  progressContainer.hidden = false;
  progressFill.style.width = '0%';
  progressText.textContent = '0%';

  try {
    spriteResults = await generateSpriteSheets({
      animations: selectedAnims,
      selectedAngles,
      baseAzimuth: getCameraAzimuth(),
      frameCount,
      fps,
      resolution,
      transparent,
      model,
      onProgress(pct) {
        const p = Math.round(pct * 100);
        progressFill.style.width = p + '%';
        progressText.textContent = p + '%';
      }
    });

    activeResultIndex = 0;
    showResultModal();
  } catch (err) {
    console.error('Generate error:', err);
    alert('Error: ' + err.message);
  } finally {
    btnGenerate.disabled = false;
    btnGenerate.textContent = t('generate');
    progressContainer.hidden = true;
  }
});

// === RESULT MODAL ===
const modal = document.getElementById('result-modal');
const resultTabs = document.getElementById('result-tabs');
const resultImage = document.getElementById('result-image');
const resultInfo = document.getElementById('result-info');

function showResultModal() {
  modal.hidden = false;

  // Build tabs
  resultTabs.innerHTML = '';
  if (spriteResults.length > 1) {
    spriteResults.forEach((r, i) => {
      const btn = document.createElement('button');
      btn.className = 'result-tab' + (i === 0 ? ' active' : '');
      btn.textContent = r.name;
      btn.addEventListener('click', () => {
        activeResultIndex = i;
        resultTabs.querySelectorAll('.result-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showResultPreview(i);
      });
      resultTabs.appendChild(btn);
    });
  }

  showResultPreview(0);
}

function showResultPreview(idx) {
  const r = spriteResults[idx];
  resultImage.src = r.sheetUrl;
  resultInfo.textContent = t('sheetInfo', {
    cols: r.cols,
    rows: r.rows,
    total: r.cols * r.rows,
    w: r.width,
    h: r.height
  });
}

// Close modal
document.getElementById('btn-modal-close').addEventListener('click', closeModal);
document.querySelector('.modal-backdrop').addEventListener('click', closeModal);

function closeModal() {
  modal.hidden = true;
}

// Download PNG
document.getElementById('btn-download-png').addEventListener('click', () => {
  const r = spriteResults[activeResultIndex];
  if (r) saveAs(r.sheetBlob, `${r.name}_spritesheet.png`);
});

// Download ZIP
document.getElementById('btn-download-zip').addEventListener('click', async () => {
  const btn = document.getElementById('btn-download-zip');
  btn.disabled = true;
  btn.textContent = '...';
  try {
    await exportZip(spriteResults);
  } finally {
    btn.disabled = false;
    btn.textContent = t('downloadZIP');
  }
});

// === LANGUAGE ===
document.getElementById('btn-lang').addEventListener('click', () => {
  toggleLanguage();
  // Re-populate animations with new language if no animations
  if (getAnimations().length === 0 && getCurrentModel()) {
    populateExportAnimations([]);
  }
});
