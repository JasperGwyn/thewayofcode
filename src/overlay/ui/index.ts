// Comunicación con el proceso main de Electron
type OverlayInitPayload = {
  breakSeconds: number;
};

type ArticleLoadedPayload = {
  url: string;
};

type OverlayApi = {
  sendLog(_message: string): void;
  requestCloseBreak(): void;
  onInit(_handler: (_payload: OverlayInitPayload) => void): void;
  onArticleLoaded(_handler: (_payload: ArticleLoadedPayload) => void): void;
};

interface OverlayWindow extends Window {
  electron?: {
    overlay?: OverlayApi;
  };
}

const overlayWindow = window as OverlayWindow;
const urlParams = new URLSearchParams(window.location.search);
const overlayContext = urlParams.get('context') ?? 'overlay';

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
  onInit(_handler: (_payload: OverlayInitPayload) => void): void;
  onArticleLoaded(_handler: (_payload: ArticleLoadedPayload) => void): void;
} {
  const api = getOverlayApi();

  return {
    sendLog(message: string): void {
      api.sendLog(message);
    },
    requestCloseBreak(): void {
      api.requestCloseBreak();
    },
    onInit(handler: (_payload: OverlayInitPayload) => void): void {
      api.onInit(handler);
    },
    onArticleLoaded(handler: (_payload: ArticleLoadedPayload) => void): void {
      api.onArticleLoaded(handler);
    },
  };
}

const { sendLog, requestCloseBreak, onInit, onArticleLoaded } = getBoundFunctions();

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

// Debug: verificar que los elementos se encontraron
sendLog(`DOM elements found - minutes: ${!!minutesElement}, seconds: ${!!secondsElement}, timerPill: ${!!timerPill}`);

// Estado del contador
let remainingSeconds = 0;
let countdownInterval: NodeJS.Timeout | null = null;

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
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  updateDisplay();

  countdownInterval = setInterval(() => {
    remainingSeconds--;

    if (remainingSeconds <= 0) {
      // El contador terminó, el proceso main debería cerrar automáticamente
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      return;
    }

    updateDisplay();
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
function initializeOverlay(): void {
  sendLog(`Initializing overlay UI - Window location: ${window.screenX}, ${window.screenY}`);

  onInit((data) => {
    sendLog(`Received overlay:init event with data: ${JSON.stringify(data)} at window position: ${window.screenX}, ${window.screenY}`);
    remainingSeconds = data.breakSeconds;
    startCountdown();
  });

  onArticleLoaded((data) => {
    sendLog(`Received overlay:article-loaded event: ${JSON.stringify(data)}`);
    loadArticleUrl(data.url);
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

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initializeOverlay);
sendLog('DOMContentLoaded listener added');

// Nota: evitamos listeners globales de clic para no interferir

// Manejo de carga de artículo en el webview
function loadArticleUrl(url: string): void {
  if (!articleView) {
    sendLog('ERROR: Webview #article-view not found');
    return;
  }
  try {
    sendLog(`Loading article URL into webview: ${url}`);
    articleView.loadURL(url);
  } catch (error) {
    sendLog(`ERROR: Failed to load URL into webview: ${(error as Error).message}`);
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
