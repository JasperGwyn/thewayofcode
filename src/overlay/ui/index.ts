// Comunicación con el proceso main de Electron
type OverlayInitPayload = {
  breakSeconds: number;
  ttsEnabled: boolean;
};

type ArticleLoadedPayload = {
  url: string;
  articleId: number;
};

type OverlayApi = {
  sendLog(_message: string): void;
  requestCloseBreak(): void;
  requestCloseBreakByTimer(): void;
  notifyReady(): void;
  onKeyboardTts(_handler: (_payload: { action: 'start' | 'stop' | 'toggle'; lang?: string; poemChapter?: number }) => void): void;
  ttsSpeak(_payload: { text: string; lang?: string; poemChapter?: number }): void;
  ttsStop(): void;
  onInit(_handler: (_payload: OverlayInitPayload) => void): void;
  onArticleLoaded(_handler: (_payload: ArticleLoadedPayload) => void): void;
  onShowNow(_handler: () => void): void;
};

interface OverlayWindow extends Window {
  electron?: {
    overlay?: OverlayApi;
  };
}

const overlayWindow = window as OverlayWindow;
const urlParams = new URLSearchParams(window.location.search);
const overlayContext = urlParams.get('context') ?? 'overlay';
const poemParam = urlParams.get('poem');
const poemChapterFromUrl = poemParam ? Number.parseInt(poemParam, 10) : undefined;
const overlayChapterNumber = Number.isFinite(poemChapterFromUrl ?? NaN) ? (poemChapterFromUrl as number) : undefined;

function getOverlayApi(): OverlayApi {
  const api = overlayWindow.electron?.overlay;

  if (!api) {
    throw new Error('Overlay renderer: overlay API no disponible');
  }

  return api;
}

function getBoundFunctions(): {
  sendLog(_message: string): void;
  requestCloseBreak(): void;
  requestCloseBreakByTimer(): void;
  notifyReady(): void;
  onInit(_handler: (_payload: OverlayInitPayload) => void): void;
  onArticleLoaded(_handler: (_payload: ArticleLoadedPayload) => void): void;
  onShowNow(_handler: () => void): void;
  onKeyboardTts(_handler: (_payload: { action: 'start' | 'stop' | 'toggle'; lang?: string; poemChapter?: number }) => void): void;
  ttsSpeak(_payload: { text: string; lang?: string; poemChapter?: number }): void;
  ttsStop(): void;
} {
  const api = getOverlayApi();

  return {
    sendLog(message: string): void {
      api.sendLog(message);
    },
    requestCloseBreak(): void {
      api.requestCloseBreak();
    },
    requestCloseBreakByTimer(): void {
      api.requestCloseBreakByTimer();
    },
    notifyReady(): void {
      api.notifyReady();
    },
    onInit(handler: (_payload: OverlayInitPayload) => void): void {
      api.onInit(handler);
    },
    onArticleLoaded(handler: (_payload: ArticleLoadedPayload) => void): void {
      api.onArticleLoaded(handler);
    },
    onShowNow(handler: () => void): void {
      api.onShowNow(handler);
    },
  onKeyboardTts(handler: (_payload: { action: 'start' | 'stop' | 'toggle'; lang?: string; poemChapter?: number }) => void): void {
      api.onKeyboardTts(handler);
    },
    ttsSpeak(payload: { text: string; lang?: string; poemChapter?: number }): void {
      api.ttsSpeak(payload);
    },
    ttsStop(): void {
      api.ttsStop();
    },
  };
}

const {
  sendLog,
  requestCloseBreak,
  requestCloseBreakByTimer,
  notifyReady,
  onInit,
  onArticleLoaded,
  onShowNow,
  onKeyboardTts,
  ttsSpeak: overlayTtsSpeak,
  ttsStop: overlayTtsStop,
} = getBoundFunctions();

// Estado global
let ttsEnabled = true; // Default habilitado

// Log inicial para confirmar que el script se carga
const overlayPosition = { x: window.screenX, y: window.screenY };
const overlaySize = { width: window.innerWidth, height: window.innerHeight };

sendLog(`Overlay script evaluating at ${overlayPosition.x}, ${overlayPosition.y}`);
sendLog(`Overlay size detected: ${overlaySize.width}x${overlaySize.height}`);
sendLog(`Overlay context detected: ${overlayContext}`);
sendLog('Overlay JavaScript loaded and executing');

// Elementos del DOM
const minutesElement = document.getElementById('minutes') as HTMLSpanElement | null;
const secondsElement = document.getElementById('seconds') as HTMLSpanElement | null;
const timerPill = document.getElementById('timer-pill') as HTMLDivElement | null;
const ttsToggleButton = document.getElementById('tts-toggle') as HTMLButtonElement | null;

// Debug: verificar que los elementos se encontraron
sendLog(`DOM elements found - minutes: ${!!minutesElement}, seconds: ${!!secondsElement}, timerPill: ${!!timerPill}`);

// Estado del contador
let remainingSeconds = 0;
let initReceived = false;
let webviewLoaded = false;
let countdownStarted = false;
let countdownInterval: NodeJS.Timeout | null = null;
let currentArticleId: number | undefined;
let isTtsActive = false;
let totalBreakSeconds = 0;

/**
 * Formatea un número como string de dos dígitos
 */
function formatTime(num: number): string {
  return num.toString().padStart(2, '0');
}

/**
 * Actualiza la visualización del contador
 */
function updateDisplay(): void {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  if (!minutesElement || !secondsElement) {
    return;
  }

  minutesElement.textContent = formatTime(minutes);
  secondsElement.textContent = formatTime(seconds);

  // Debug: log cada actualización del timer
  if (remainingSeconds % 5 === 0 || remainingSeconds <= 10) { // Log cada 5 segundos o últimos 10
    sendLog(`Timer updated: ${formatTime(minutes)}:${formatTime(seconds)} (${remainingSeconds}s remaining)`);
  }
}

/**
 * Inicia el contador regresivo
 */
function startCountdown(): void {
  if (countdownStarted) {
    sendLog('Countdown already started, skipping');
    return;
  }

  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  countdownStarted = true;

  sendLog(`Starting countdown with ${remainingSeconds} seconds remaining`);

  // Actualizar la visualización inicial
  updateDisplay();

  countdownInterval = setInterval(() => {
    // Decrementar primero
    remainingSeconds--;

    // Actualizar la visualización siempre (incluyendo cuando llega a 0)
    updateDisplay();

    // Verificar si terminó después de actualizar la visualización
    if (remainingSeconds <= 0) {
      // El contador terminó, el proceso main debería cerrar automáticamente
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      
      // Asegurar que se muestre 00:00 antes de cerrar
      sendLog(`Timer reached 0 - total break duration was ${totalBreakSeconds}s`);
      
      // Esperar un momento para asegurar que se muestre el 00:00 antes de cerrar
      setTimeout(() => {
        sendLog('Timer ended - requesting close (auto)');
        requestCloseBreakByTimer();
      }, 500);
      return;
    }
  }, 1000);
}


/**
 * Actualiza el mensaje de estado (ya no se usa, pero mantenemos para compatibilidad)
 */
// Ya no se usa un mensaje de estado; el contenido se carga en el webview

/**
 * Maneja el clic en el timer pill (cierra el break)
 */
function handleTimerPillClick(): void {
  // Enviar log al main process
  sendLog('Timer pill clicked - closing break');

  // Detener el contador local
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  // Notificar al proceso main que cierre el break
  sendLog('Sending overlay:close-break event to main process');
  requestCloseBreak();
  sendLog('Event sent successfully');
}

/**
 * Inicializa el overlay cuando recibe datos del proceso main
 */
function maybeNotifyReady(): void {
  if (initReceived && webviewLoaded) {
    // Notificar al main que puede mostrarse
    notifyReady();
  }
}

function initializeOverlay(): void {
  sendLog(`Initializing overlay UI - Window location: ${window.screenX}, ${window.screenY}`);

  onInit((data) => {
    sendLog(`Received overlay:init event with data: ${JSON.stringify(data)} at window position: ${window.screenX}, ${window.screenY}`);
    remainingSeconds = data.breakSeconds;
    totalBreakSeconds = data.breakSeconds;
    ttsEnabled = data.ttsEnabled;
    initReceived = true;
    countdownStarted = false; // Resetear el flag cuando se recibe un nuevo init
    maybeNotifyReady();

    // 🔥 AUTO-TTS: Si hay un poema desde URL, iniciar TTS automáticamente (solo si está habilitado)
    if (overlayChapterNumber !== undefined && ttsEnabled) {
      sendLog(`AUTO-TTS: URL poem detected (chapter ${overlayChapterNumber}), starting TTS...`);
      void ttsStart('en', overlayChapterNumber);
    } else if (overlayChapterNumber !== undefined && !ttsEnabled) {
      sendLog(`AUTO-TTS: URL poem detected but TTS is disabled`);
    }
  });

  onArticleLoaded((data) => {
    sendLog(`Received overlay:article-loaded event: ${JSON.stringify(data)}`);
    loadArticleUrl(data);
  });

  onShowNow(() => {
    sendLog(`Received overlay:show-now - countdownStarted=${countdownStarted}, remainingSeconds=${remainingSeconds}`);
    if (!countdownStarted) {
      startCountdown();
    } else {
      sendLog('Warning: overlay:show-now received but countdown already started');
    }
  });
}

// Elementos del DOM
const articleView = document.querySelector('#article-view') as Electron.WebviewTag | null;

// Configurar event listeners
sendLog('Setting up event listeners');

if (timerPill) {
  sendLog('Timer pill found, adding event listener');
  timerPill.addEventListener('click', handleTimerPillClick);

  timerPill.addEventListener('mousedown', () => sendLog('Timer pill mousedown'));
  timerPill.addEventListener('mouseup', () => sendLog('Timer pill mouseup'));
} else {
  sendLog('ERROR: Timer pill not found!');
}

if (ttsToggleButton) {
  ttsToggleButton.addEventListener('click', () => {
    const shouldStart = !isTtsActive;
    if (shouldStart) {
      if (ttsEnabled) {
        void ttsStart('en');
      } else {
        sendLog('TTS: TTS está desactivado, no se puede iniciar');
      }
    } else {
      ttsStop();
    }
  });
} else {
  sendLog('ERROR: TTS toggle button not found!');
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initializeOverlay);
sendLog('DOMContentLoaded listener added');

// Nota: evitamos listeners globales de clic para no interferir

// Manejo de carga de artículo en el webview
function loadArticleUrl(payload: ArticleLoadedPayload): void {
  if (!articleView) {
    sendLog('ERROR: Webview #article-view not found');
    return;
  }
  const { url, articleId } = payload;
  currentArticleId = articleId;
  setTtsActiveState(false);

  try {
    sendLog(`Loading article URL into webview: ${url}`);
    articleView.loadURL(url);

    // 🔥 AUTO-TTS: Iniciar TTS automáticamente apenas se sabe el número de poema (solo si está habilitado)
    if (ttsEnabled) {
      sendLog(`AUTO-TTS: Iniciando reproducción automática del poema ${articleId}`);
      void ttsStart('en', articleId);
    } else {
      sendLog(`AUTO-TTS: Poema ${articleId} detectado pero TTS está desactivado`);
    }
  } catch (error) {
    sendLog(`ERROR: Failed to load URL into webview: ${(error as Error).message}`);
  }
}

function setTtsActiveState(isActive: boolean): void {
  isTtsActive = isActive;
  if (ttsToggleButton) {
    ttsToggleButton.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    ttsToggleButton.title = isActive ? 'Detener lectura (S)' : 'Leer poema (T)';
  }
}

// Opcional: manejo básico de navegación del webview
if (articleView) {
  articleView.addEventListener('new-window', (e) => {
    const targetUrl = (e as unknown as { url?: string }).url ?? '';
    sendLog(`webview new-window: ${targetUrl}`);
    // Dejar que el main/OS maneje si se desea en el futuro
  });
  articleView.addEventListener('will-navigate', (e) => {
    const targetUrl = (e as unknown as { url?: string }).url ?? '';
    sendLog(`webview will-navigate: ${targetUrl}`);
  });
  articleView.addEventListener('dom-ready', () => {
    sendLog('webview dom-ready');
  });
  articleView.addEventListener('did-attach', () => {
    sendLog('webview did-attach');
  });
  articleView.addEventListener('did-finish-load', () => {
    sendLog('webview did-finish-load');
    webviewLoaded = true;
    maybeNotifyReady();
  });
  articleView.addEventListener('did-fail-load', () => {
    sendLog('webview did-fail-load');
  });
  articleView.addEventListener('crashed', () => {
    sendLog('webview crashed');
  });
  articleView.addEventListener('gpu-crashed', () => {
    sendLog('webview gpu-crashed');
  });
  articleView.addEventListener('destroyed', () => {
    sendLog('webview destroyed');
  });
}

async function ttsStart(langHint: 'en' | 'es' | 'auto' = 'auto', poemChapterOverride?: number): Promise<void> {
  if (!ttsEnabled) {
    sendLog('TTS: TTS is disabled, skipping start request');
    return;
  }

  const lang = langHint === 'en' ? 'en-US' : (langHint === 'es' ? 'es-ES' : 'en-US');
  const payload: { text: string; lang: string; poemChapter?: number } = {
    text: '',
    lang,
  };
  const chapterToUse = poemChapterOverride ?? overlayChapterNumber ?? currentArticleId;
  if (chapterToUse !== undefined) {
    payload.poemChapter = chapterToUse;
  }
  overlayTtsSpeak(payload);
  setTtsActiveState(true);
  sendLog(`TTS(Google): solicitado speak lang=${lang} capítulo=${chapterToUse ?? 'default'}`);
}

function ttsStop(): void {
  overlayTtsStop();
  setTtsActiveState(false);
  sendLog('TTS(Google): solicitado stop');
}

function ttsTogglePause(): void {
  // Pausa/reanudar no soportado vía SAPI simple; re-disparar no es trivial.
  // Como alternativa rápida: si se quería pausar, usamos stop; si reanudar, volver a start.
  sendLog('TTS(Google): toggle -> stop');
  ttsStop();
}

// Atajos: T = leer (en inglés), P = pausar/reanudar, S = parar
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.repeat) return;
  const key = e.key.toLowerCase();
  if (key === 't') {
    if (ttsEnabled) {
      void ttsStart('en');
    } else {
      sendLog('TTS: TTS está desactivado, no se puede iniciar');
    }
  } else if (key === 'p') {
    ttsTogglePause();
  } else if (key === 's') {
    ttsStop();
  }
});

onKeyboardTts((payload: { action: 'start' | 'stop' | 'toggle'; lang?: string; poemChapter?: number }) => {
  const action = payload.action;
  const lang = payload.lang === 'es' ? 'es' : 'en';
  const poemChapterOverride = payload.poemChapter ?? currentArticleId;
  if (action === 'start') {
    if (ttsEnabled) {
      void ttsStart(lang === 'es' ? 'es' : 'en', poemChapterOverride);
    } else {
      sendLog('TTS: TTS está desactivado, no se puede iniciar');
    }
  } else if (action === 'stop') {
    ttsStop();
  } else if (action === 'toggle') {
    ttsTogglePause();
  }
});

