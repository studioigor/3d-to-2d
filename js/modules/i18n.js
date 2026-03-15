const STRINGS = {
  en: {
    appTitle: '3D to 2D Converter',
    studioName: 'Studio Igor',
    dropText: 'Drag & drop 3D model here',
    dropHint: 'Supports GLB, GLTF, FBX, ZIP',
    browse: 'Browse Files',
    reset: 'Reset',
    animationPreview: 'Animation',
    animation: 'Animation',
    speed: 'Speed',
    camera: 'Camera',
    perspective: 'Perspective',
    orthographic: 'Orthographic',
    fitToFrame: 'Fit',
    resetCamera: 'Reset',
    lighting: 'Lighting',
    customLight: 'Custom Light',
    intensity: 'Intensity',
    exportSettings: 'Export Settings',
    selectAnimations: 'Animations to Export',
    selectAll: 'Select All',
    framesPerAnimation: 'Frames',
    fpsMode: 'FPS',
    resolution: 'Frame Resolution',
    captureAngles: 'Capture Angles',
    totalFrames: 'Total frames',
    transparentBg: 'Transparent background',
    generate: 'Generate Sprite Sheet',
    generating: 'Generating...',
    result: 'Result',
    downloadPNG: 'Download PNG',
    downloadZIP: 'Download ZIP',
    noAnimations: 'No animations found',
    staticModel: 'Static model (1 frame per angle)',
    sheetInfo: '{cols}×{rows} — {total} frames — {w}×{h}px',
    warning16k: 'Warning: sprite sheet exceeds 16384px. Reduce resolution or frame count.',
    angleFront: 'Front',
    angleFrontRight: 'Front-Right',
    angleRight: 'Right',
    angleBackRight: 'Back-Right',
    angleBack: 'Back',
    angleBackLeft: 'Back-Left',
    angleLeft: 'Left',
    angleFrontLeft: 'Front-Left',
    angleTop: 'Top',
    captureAnglesTooltip: 'Rotation is performed relative to the current camera position',
    materialFixes: 'Material Fixes',
    materialFixesHint: 'Fix transparency issues after export',
    fixForceOpaque: 'Force Opaque',
    fixAlphaClip: 'Alpha Clip',
    fixSingleSided: 'Single-Sided',
    fixDoubleSided: 'Double-Sided',
    fixFlipNormals: 'Flip Normals',
    fixRecalcNormals: 'Recalc Normals',
  },
  ru: {
    appTitle: '3D в 2D конвертер',
    studioName: 'Студия Игор',
    dropText: 'Перетащите 3D модель сюда',
    dropHint: 'Поддерживаемые форматы: GLB, GLTF, FBX, ZIP',
    browse: 'Выбрать файл',
    reset: 'Сброс',
    animationPreview: 'Анимация',
    animation: 'Анимация',
    speed: 'Скорость',
    camera: 'Камера',
    perspective: 'Перспектива',
    orthographic: 'Ортографическая',
    fitToFrame: 'Подогнать',
    resetCamera: 'Сброс',
    lighting: 'Освещение',
    customLight: 'Свой источник света',
    intensity: 'Интенсивность',
    exportSettings: 'Настройки экспорта',
    selectAnimations: 'Анимации для экспорта',
    selectAll: 'Выбрать все',
    framesPerAnimation: 'Кадры',
    fpsMode: 'FPS',
    resolution: 'Разрешение кадра',
    captureAngles: 'Углы захвата',
    totalFrames: 'Всего кадров',
    transparentBg: 'Прозрачный фон',
    generate: 'Сгенерировать спрайт-лист',
    generating: 'Генерация...',
    result: 'Результат',
    downloadPNG: 'Скачать PNG',
    downloadZIP: 'Скачать ZIP',
    noAnimations: 'Анимации не найдены',
    staticModel: 'Статичная модель (1 кадр на ракурс)',
    sheetInfo: '{cols}×{rows} — {total} кадров — {w}×{h}px',
    warning16k: 'Предупреждение: спрайт-лист превышает 16384px. Уменьшите разрешение или количество кадров.',
    angleFront: 'Спереди',
    angleFrontRight: 'Спереди-справа',
    angleRight: 'Справа',
    angleBackRight: 'Сзади-справа',
    angleBack: 'Сзади',
    angleBackLeft: 'Сзади-слева',
    angleLeft: 'Слева',
    angleFrontLeft: 'Спереди-слева',
    angleTop: 'Сверху',
    captureAnglesTooltip: 'Вращение модели производится относительно текущего положения камеры',
    materialFixes: 'Фиксы материалов',
    materialFixesHint: 'Исправление прозрачности после экспорта',
    fixForceOpaque: 'Непрозрачный',
    fixAlphaClip: 'Alpha Clip',
    fixSingleSided: 'Односторонний',
    fixDoubleSided: 'Двусторонний',
    fixFlipNormals: 'Перевернуть нормали',
    fixRecalcNormals: 'Пересчитать нормали',
  }
};

let currentLang = 'en';

export function detectLanguage() {
  const lang = navigator.language || navigator.userLanguage || 'en';
  currentLang = lang.startsWith('ru') ? 'ru' : 'en';
}

export function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'ru' : 'en';
  applyLanguage();
}

export function t(key, params) {
  let str = STRINGS[currentLang][key] || STRINGS.en[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, v);
    }
  }
  return str;
}

export function getLang() {
  return currentLang;
}

export function applyLanguage() {
  document.getElementById('app-title').textContent = t('appTitle');
  document.getElementById('drop-text').textContent = t('dropText');
  document.getElementById('drop-hint').textContent = t('dropHint');
  document.getElementById('btn-browse').textContent = t('browse');

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });


  document.getElementById('studio-link').textContent = t('studioName');
  document.getElementById('btn-lang').textContent = currentLang === 'en' ? 'RU' : 'EN';
}
