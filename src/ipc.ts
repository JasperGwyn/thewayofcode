import { ipcMain, BrowserWindow } from 'electron';
import { logger } from './log.js';
import type { SettingsManager } from './settings.js';
import type { BreakScheduler } from './scheduler.js';
import type { TrayManager } from './tray.js';

/**
 * IPC event handlers for communication between main and renderer processes
 */

export function setupIpcHandlers(
  settingsManager: SettingsManager,
  scheduler: BreakScheduler,
  trayManager: TrayManager
): void {
  // IPC handlers for settings
  ipcMain.handle('get-settings', async () => {
    try {
      return await settingsManager.loadSettings();
    } catch (error) {
      logger.error('IPC: get-settings failed', error);
      throw error;
    }
  });

  ipcMain.handle('save-settings', async (_event, newSettings) => {
    try {
      await settingsManager.saveSettings(newSettings);
      scheduler.updateSettings(newSettings);
      await trayManager.updateTrayStatus();
      return true;
    } catch (error) {
      logger.error('IPC: save-settings failed', error);
      throw error;
    }
  });

  // IPC handlers for scheduler
  ipcMain.handle('get-scheduler-status', () => {
    try {
      return scheduler.getStatus();
    } catch (error) {
      logger.error('IPC: get-scheduler-status failed', error);
      throw error;
    }
  });

  ipcMain.handle('pause-scheduler', async () => {
    try {
      scheduler.pauseForOneHour();
      await trayManager.updateTrayStatus();
      return true;
    } catch (error) {
      logger.error('IPC: pause-scheduler failed', error);
      throw error;
    }
  });

  // IPC handlers for break events (listening from renderer)
  ipcMain.on('break:start', () => {
    logger.info('IPC: break:start event received from renderer');
  });

  ipcMain.on('break:end', () => {
    logger.info('IPC: break:end event received from renderer');
    // User closed break early from overlay; reset scheduler interval from now
    try {
      scheduler.stop();
      scheduler.start();
      logger.info('IPC: Scheduler reset after break:end (user close)');
    } catch (error) {
      logger.error('IPC: Failed to reset scheduler after break:end', error);
    }
  });
}

/**
 * Emit IPC events to all renderer windows
 */
export function emitToRenderer(event: string, ...args: unknown[]): void {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(window => {
    window.webContents.send(event, ...args);
  });
  logger.info(`IPC: ${event} emitted to ${windows.length} windows`);
}
