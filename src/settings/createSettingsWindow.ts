import { BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../log.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createSettingsWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, 'ui', 'preload.js');
  const htmlPath = path.join(__dirname, 'ui', 'index.html');

  logger.info(`Settings: creating window (preload=${preloadPath}, html=${htmlPath})`);

  const win = new BrowserWindow({
    width: 420,
    height: 360,
    useContentSize: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    center: true,
    title: 'Settings',
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#111418',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
    },
  });

  // Hide menu bar in this window
  try {
    win.setMenuBarVisibility(false);
  } catch (error) {
    logger.warn('Settings: setMenuBarVisibility(false) not supported', error);
  }

  // Extra diagnostics for preload/renderer events
  win.webContents.on('preload-error', (_event, preload, error) => {
    logger.error(`Settings: preload error from ${preload}: ${(error as Error).message}`);
  });
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    logger.error(`Settings: did-fail-load ${errorCode} ${errorDescription}`);
  });
  win.webContents.on('console-message', (_event, level: number, message: string) => {
    logger.info(`Settings console [${level}]: ${message}`);
  });
  win.webContents.on('did-finish-load', () => {
    logger.info('Settings: did-finish-load');
  });

  win.on('ready-to-show', () => win.show());
  win.on('closed', () => {
    logger.info('Settings window closed');
  });

  win.loadFile(htmlPath).catch((error: unknown) => {
    logger.error('Settings: failed to load settings UI', error);
  });

  return win;
}
