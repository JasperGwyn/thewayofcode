import { BrowserWindow, Display } from 'electron';
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
    // Posición y tamaño del display
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,

    // Configuración fullscreen sin marco
    fullscreen: true,
    frame: false,
    resizable: false,

    // Siempre encima y no en taskbar
    alwaysOnTop: true,
    skipTaskbar: true,

    // No mostrar en alt+tab
    show: false,

    // Configuración web
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },

    // Transparente para overlay suave
    transparent: true,

    // Sin foco automático para no bloquear input
    focusable: true, // Necesario para que tome foco pero no bloquee completamente
  });

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

  // Cargar el HTML del overlay
  const htmlPath = path.join(__dirname, 'ui', 'index.html');
  logger.info(`Loading overlay HTML from: ${htmlPath}`);
  overlayWindow.loadFile(htmlPath).catch(error => {
    logger.error('Failed to load overlay HTML', error);
  });

  // Enviar datos del break cuando esté listo
  overlayWindow.webContents.once('did-finish-load', () => {
    logger.info(`OverlayManager: Sending overlay:init to window for display ${display.id} with breakSeconds: ${breakSeconds}`);
    overlayWindow.webContents.send('overlay:init', { breakSeconds });
  });

  // Mostrar la ventana cuando esté lista
  overlayWindow.once('ready-to-show', () => {
    overlayWindow.show();
    logger.info(`Overlay window shown for display ${display.id} - Window is visible: ${overlayWindow.isVisible()}`);
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
