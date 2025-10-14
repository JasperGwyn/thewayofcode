import { app } from 'electron';
import { logger } from './log.js';
import { SettingsManager } from './settings.js';
import { BreakScheduler } from './scheduler.js';
import { TrayManager } from './tray.js';
import { setupIpcHandlers, emitToRenderer } from './ipc.js';
import { OverlayManager } from './overlay/OverlayManager.js';

// Keep a reference to prevent garbage collection
let trayManager: TrayManager | null = null;
let scheduler: BreakScheduler | null = null;
let settingsManager: SettingsManager | null = null;
let overlayManager: OverlayManager | null = null;

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

    // Initialize settings manager first
    settingsManager = new SettingsManager();

    // Load settings (will use defaults if file doesn't exist)
    let settings;
    try {
      settings = await settingsManager.loadSettings();
    } catch (error) {
      logger.warn('Failed to load settings, using defaults', error);
      settings = settingsManager.getDefaultSettings();
    }

    // Apply auto-start setting on startup
    await settingsManager.applyAutoStartSetting(settings.startWithWindows);

    // Initialize scheduler with break event handler
    scheduler = new BreakScheduler(settings, {
      onBreakStart: () => {
        logger.info('Break started - IPC event emitted');
        // The IPC event is already sent in the scheduler
      },
      onBreakEnd: () => {
        logger.info('Break ended - IPC event emitted');
        // The IPC event is already sent in the scheduler
      },
    });

    // Initialize overlay manager
    logger.info('Initializing OverlayManager...');
    overlayManager = new OverlayManager();
    logger.info('OverlayManager initialized successfully');

    // Initialize tray
    trayManager = new TrayManager(scheduler, settingsManager, overlayManager);
    await trayManager.createTray();

    // Setup IPC handlers
    setupIpcHandlers(settingsManager, scheduler, trayManager);

    // Start the scheduler
    scheduler.start();

    // For testing: trigger break immediately with 10 seconds
    if (process.env.NODE_ENV === 'development' && scheduler) {
      logger.info('Development mode: triggering test break in 3 seconds');
      logger.info(`NODE_ENV is set to: ${process.env.NODE_ENV}`);
      setTimeout(() => {
        logger.info('Triggering test break...');
        // Simulate break start event directly
        const testBreakSeconds = 10;
        logger.info(`Test: Emitting break:start with ${testBreakSeconds} seconds`);
        emitToRenderer('break:start', testBreakSeconds);
      }, 3000);
    }

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

  if (overlayManager) {
    overlayManager.destroy();
  }
});

// IPC handlers are now setup in ipc.ts

// Handle app activation (macOS)
app.on('activate', () => {
  // On macOS it's common to re-create a window when dock icon is clicked
  // Since we don't have windows, this is a no-op for now
  logger.info('App activated');
});
