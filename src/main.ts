import { app } from 'electron';
import { logger } from './log.js';
import { SettingsManager } from './settings.js';
import { BreakScheduler } from './scheduler.js';
import { TrayManager } from './tray.js';
import { setupIpcHandlers } from './ipc.js';
import { OverlayManager } from './overlay/OverlayManager.js';
import { SoundManager } from './sound.js';
import { IdleManager } from './idle.js';

// Keep a reference to prevent garbage collection
let trayManager: TrayManager | null = null;
let scheduler: BreakScheduler | null = null;
let settingsManager: SettingsManager | null = null;
let overlayManager: OverlayManager | null = null;
let soundManager: SoundManager | null = null;
let idleManager: IdleManager | null = null;

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
      onBreakStart: (breakSeconds: number, ttsEnabled: boolean) => {
        logger.info('Break started - activating overlays');
        try {
          if (overlayManager && settingsManager) {
            overlayManager.showOverlays(breakSeconds, ttsEnabled);
          } else {
            logger.warn('OverlayManager or SettingsManager not ready on break start');
          }
        } catch (err) {
          logger.error('Failed to activate overlays on break start', err);
        }
      },
      onBreakEnd: () => {
        logger.info('Break ended - hiding overlays');
        try {
          if (overlayManager) {
            overlayManager.hideOverlays();
          }
          if (soundManager) {
            soundManager.playEndSound();
          }
        } catch (err) {
          logger.error('Failed to finalize break end actions', err);
        }
      },
    });
    // Ensure break end accounts for preload delay so user gets full time
    scheduler.setDisplayDelayMs(3000);

    // Initialize overlay manager
    logger.info('Initializing OverlayManager...');
    overlayManager = new OverlayManager();
    logger.info('OverlayManager initialized successfully');

    // Initialize sound manager
    soundManager = new SoundManager();

    // Initialize tray
    trayManager = new TrayManager(scheduler, settingsManager, overlayManager);
    await trayManager.createTray();

    // Setup IPC handlers
    setupIpcHandlers(settingsManager, scheduler, trayManager, soundManager ?? undefined);

    // Start the scheduler
    scheduler.start();

    // Start idle detection (standby when inactive/monitors off)
    idleManager = new IdleManager(scheduler, overlayManager);
    idleManager.start();

    // Test mode removed: app starts scheduler only; no auto-overlay.

    logger.info('Break Timer app started successfully');
  } catch (error) {
    logger.error('Failed to start app', error);
    app.quit();
  }
});

// Do not quit the app when overlay windows close; keep tray running
app.on('window-all-closed', () => {
  logger.info('All windows closed; keeping app alive (tray mode)');
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

  if (soundManager) {
    soundManager.destroy();
  }

  if (idleManager) {
    idleManager.stop();
  }
});

// IPC handlers are now setup in ipc.ts

// Handle app activation (macOS)
app.on('activate', () => {
  // On macOS it's common to re-create a window when dock icon is clicked
  // Since we don't have windows, this is a no-op for now
  logger.info('App activated');
});
