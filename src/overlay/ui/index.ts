// Comunicación con el proceso main de Electron
type OverlayInitPayload = {
  breakSeconds: number;
};

type OverlayApi = {
  sendLog(_message: string): void;
  requestCloseBreak(): void;
  onInit(_handler: (_payload: OverlayInitPayload) => void): void;
};

interface OverlayWindow extends Window {
  electron?: {
    overlay?: OverlayApi;
  };
}

const overlayWindow = window as OverlayWindow;

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
  };
}

const { sendLog, requestCloseBreak, onInit } = getBoundFunctions();

// Log inicial para confirmar que el script se carga
sendLog(`Overlay script evaluating at ${window.screenX}, ${window.screenY}`);
sendLog('Overlay JavaScript loaded and executing');

// Elementos del DOM
const minutesElement = document.getElementById('minutes') as HTMLSpanElement;
const secondsElement = document.getElementById('seconds') as HTMLSpanElement;
const closeButton = document.getElementById('close-button') as HTMLButtonElement;

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

  minutesElement.textContent = formatTime(minutes);
  secondsElement.textContent = formatTime(seconds);
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
 * Maneja el clic en el botón cerrar
 */
function handleCloseClick(): void {
  // Enviar log al main process
  sendLog('Close button clicked');

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
}

// Configurar event listeners
sendLog('Setting up event listeners');

if (closeButton) {
  sendLog('Close button found, adding event listener');
  closeButton.addEventListener('click', handleCloseClick);

  // Agregar listeners adicionales para debug
  closeButton.addEventListener('mousedown', () => sendLog('Close button mousedown'));
  closeButton.addEventListener('mouseup', () => sendLog('Close button mouseup'));
} else {
  sendLog('ERROR: Close button not found!');
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initializeOverlay);
sendLog('DOMContentLoaded listener added');

// Agregar listener global para debug de clics
document.addEventListener('click', (event) => {
  sendLog(`Document click detected at: ${event.clientX}, ${event.clientY}`);
});

document.addEventListener('mousedown', (event) => {
  sendLog(`Document mousedown detected at: ${event.clientX}, ${event.clientY}`);
});
