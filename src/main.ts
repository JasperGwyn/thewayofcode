import { app, ipcMain } from 'electron';
import { logger } from './log.js';
import { SettingsManager } from './settings.js';
import { BreakScheduler } from './scheduler.js';
import { TrayManager } from './tray.js';

// Keep a reference to prevent garbage collection
let trayManager: TrayManager | null = null;
let scheduler: BreakScheduler | null = null;
let settingsManager: SettingsManager | null = null;

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus the existing one
    logger.info('Second instance prevented');
  });
}

app.on('ready', async () => {
  try {
    logger.info('Break Timer app starting...');

    // Initialize settings
    settingsManager = new SettingsManager();
    const settings = await settingsManager.loadSettings();

    // Initialize scheduler with break event handler
    scheduler = new BreakScheduler(settings, {
      onBreakStart: () => {
        logger.info('Break started - IPC event emitted');
        // The IPC event is already sent in the scheduler
      },
    });

    // Initialize tray
    trayManager = new TrayManager(scheduler, settingsManager);
    await trayManager.createTray();

    // Start the scheduler
    scheduler.start();

    logger.info('Break Timer app started successfully');
  } catch (error) {
    logger.error('Failed to start app', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // On macOS it is common for applications to stay active until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  logger.info('App shutting down...');

  if (scheduler) {
    scheduler.stop();
  }

  if (trayManager) {
    trayManager.destroy();
  }
});

// IPC handlers for future use (settings window, etc.)
ipcMain.handle('get-settings', async () => {
  if (!settingsManager) {
    throw new Error('Settings manager not initialized');
  }
  return await settingsManager.loadSettings();
});

ipcMain.handle('save-settings', async (_event, newSettings) => {
  if (!settingsManager) {
    throw new Error('Settings manager not initialized');
  }

  await settingsManager.saveSettings(newSettings);

  if (scheduler) {
    scheduler.updateSettings(newSettings);
  }

  if (trayManager) {
    trayManager.updateTrayStatus();
  }

  return true;
});

ipcMain.handle('get-scheduler-status', () => {
  if (!scheduler) {
    throw new Error('Scheduler not initialized');
  }
  return scheduler.getStatus();
});

ipcMain.handle('pause-scheduler', () => {
  if (!scheduler) {
    throw new Error('Scheduler not initialized');
  }
  scheduler.pauseForOneHour();

  if (trayManager) {
    trayManager.updateTrayStatus();
  }

  return true;
});

// Handle app activation (macOS)
app.on('activate', () => {
  // On macOS it's common to re-create a window when dock icon is clicked
  // Since we don't have windows, this is a no-op for now
  logger.info('App activated');
});
