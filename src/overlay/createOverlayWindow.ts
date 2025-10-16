import { BrowserWindow, Display } from 'electron';
import type { RenderProcessGoneDetails } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../log.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Crea una ventana de overlay para un display específico
 */
export function createOverlayWindow(display: Display, breakSeconds: number): BrowserWindow {
  const { bounds } = display;
  const preloadPath = path.join(__dirname, 'ui', 'preload.js');

  logger.info(`Creating overlay window for display: ${display.id} at ${bounds.x},${bounds.y} ${bounds.width}x${bounds.height}, breakSeconds: ${breakSeconds}`);

  const overlayWindow = new BrowserWindow({
    // Posicionar en la esquina del display y dimensionar para cubrir toda la pantalla
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,

    frame: false,
    resizable: false,
    fullscreenable: true,
    autoHideMenuBar: true,
    hasShadow: false,

    // Siempre encima y no en taskbar
    alwaysOnTop: true,
    skipTaskbar: true,

    // No mostrar en alt+tab
    show: false,

    // Configuración web
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      backgroundThrottling: false,
      preload: preloadPath,
    },

    // Importante: en Windows, las ventanas transparentes no cubren la taskbar en muchos casos
    // Usar fondo opaco para asegurar cobertura total en fullscreen
    transparent: false,
    backgroundColor: '#000000',

    // Foco permitido para interacción con la pill
    focusable: true, // Necesario para que tome foco pero no bloquee completamente
  });

  // Asegurar fullscreen real para cubrir taskbar y todo el display
  try {
    // Ajustar bounds explícitamente antes de entrar en fullscreen ayuda a respetar el display destino
    overlayWindow.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
    overlayWindow.setFullScreen(true);
  } catch (error) {
    logger.warn(`createOverlayWindow: setFullScreen(true) failed or not supported (display ${display.id})`, error);
  }
  try {
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  } catch (error) {
    logger.warn(`createOverlayWindow: setAlwaysOnTop failed (display ${display.id})`, error);
  }

  // Evitar cierres accidentales por UI del SO
  try {
    overlayWindow.setClosable(false);
  } catch (error) {
    logger.warn('createOverlayWindow: setClosable(false) not supported', error);
  }

  // Evitar navegación y nuevas ventanas
  overlayWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  overlayWindow.webContents.on('preload-error', (_event, preload, error) => {
    logger.error(`Overlay preload error for display ${display.id} from ${preload}: ${(error as Error).message}`);
  });

  overlayWindow.webContents.on('console-message', (_event, level: number, message: string) => {
    logger.info(`Overlay console (display ${display.id}) [${level}]: ${message}`);
  });

  // Eventos de proceso/render para diagnstico
  overlayWindow.webContents.on('render-process-gone', (_event, details: RenderProcessGoneDetails) => {
    const reason = details.reason;
    if (reason === 'clean-exit') {
      logger.info(`Overlay render-process-gone clean-exit (display ${display.id}, winId ${overlayWindow.id})`);
    } else if (reason === 'killed') {
      logger.warn(`Overlay render-process-gone killed (display ${display.id}, winId ${overlayWindow.id})`);
    } else {
      logger.error(`Overlay render-process-gone ${reason} (display ${display.id}, winId ${overlayWindow.id})`);
    }
  });
  overlayWindow.webContents.on('destroyed', () => {
    logger.info(`Overlay webContents destroyed (display ${display.id}, winId ${overlayWindow.id})`);
  });
  overlayWindow.on('unresponsive', () => {
    logger.warn(`Overlay window unresponsive (display ${display.id}, winId ${overlayWindow.id})`);
  });
  overlayWindow.on('responsive', () => {
    logger.info(`Overlay window responsive (display ${display.id}, winId ${overlayWindow.id})`);
  });

  // Trazas adicionales de ventana para diagnosticar
  overlayWindow.on('focus', () => {
    logger.info(`Overlay window focus (display ${display.id}, winId ${overlayWindow.id})`);
  });
  overlayWindow.on('blur', () => {
    logger.info(`Overlay window blur (display ${display.id}, winId ${overlayWindow.id})`);
  });
  overlayWindow.on('minimize', () => {
    logger.warn(`Overlay window minimize (display ${display.id}, winId ${overlayWindow.id})`);
  });
  overlayWindow.on('restore', () => {
    logger.info(`Overlay window restore (display ${display.id}, winId ${overlayWindow.id})`);
  });

  // Bloquear teclas comunes de cierre
  overlayWindow.webContents.on('before-input-event', (event, input) => {
    const isCloseCombo =
      (input.key?.toLowerCase?.() === 'escape') ||
      (input.alt && (input.key?.toLowerCase?.() === 'f4')) ||
      (input.control && (input.key?.toLowerCase?.() === 'w'));
    if (isCloseCombo) {
      logger.warn(`Overlay before-input-event blocked close combo on display ${display.id} (winId ${overlayWindow.id}) key=${input.key} alt=${!!input.alt} ctrl=${!!input.control}`);
      event.preventDefault();
    }
  });

  // Cargar el HTML del overlay
  const htmlPath = path.join(__dirname, 'ui', 'index.html');
  logger.info(`Loading overlay HTML from: ${htmlPath}`);
  overlayWindow.loadFile(htmlPath, { query: { context: 'overlay' } }).catch(error => {
    logger.error('Failed to load overlay HTML', error);
  });

  // overlay:init será enviado por OverlayManager cuando la ventana haya cargado

  // No mostrar aún; el OverlayManager mostrará la ventana cuando la UI y el webview estén listos
  overlayWindow.once('ready-to-show', () => {
    logger.info(`Overlay window ready-to-show (display ${display.id}, winId ${overlayWindow.id})`);
  });

  overlayWindow.on('show', () => {
    logger.info(`Overlay window show (display ${display.id}, winId ${overlayWindow.id})`);
  });
  overlayWindow.on('hide', () => {
    logger.info(`Overlay window hide (display ${display.id}, winId ${overlayWindow.id})`);
  });
  overlayWindow.on('enter-full-screen', () => {
    logger.warn(`Overlay window enter-full-screen (display ${display.id}, winId ${overlayWindow.id})`);
  });
  overlayWindow.on('leave-full-screen', () => {
    logger.info(`Overlay window leave-full-screen (display ${display.id}, winId ${overlayWindow.id})`);
  });
  overlayWindow.on('maximize', () => {
    logger.info(`Overlay window maximize (display ${display.id}, winId ${overlayWindow.id})`);
  });
  overlayWindow.on('unmaximize', () => {
    logger.info(`Overlay window unmaximize (display ${display.id}, winId ${overlayWindow.id})`);
  });

  // Manejar errores
  overlayWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    logger.error(`Overlay window failed to load: ${errorCode} - ${errorDescription}`);
  });

  // Limpiar listeners al cerrar
  overlayWindow.on('closed', () => {
    logger.info(`Overlay window closed for display ${display.id}`);
  });

  return overlayWindow;
}
