import { app, Menu, Tray, dialog, nativeImage } from 'electron';
import path from 'path';
import { logger } from './log.js';
import type { BreakScheduler } from './scheduler.js';
import type { SettingsManager, AppSettings } from './settings.js';
import type { OverlayManager } from './overlay/OverlayManager.js';

export class TrayManager {
  private tray: Tray | null = null;
  private scheduler: BreakScheduler;
  private settingsManager: SettingsManager;
  private overlayManager: OverlayManager;

  constructor(scheduler: BreakScheduler, settingsManager: SettingsManager, overlayManager: OverlayManager) {
    this.scheduler = scheduler;
    this.settingsManager = settingsManager;
    this.overlayManager = overlayManager;
  }

  async createTray(): Promise<void> {
    try {
      // Try to load custom icon, fallback to programmatic icon if not found
      let img: Electron.NativeImage;

      try {
        // Try to load icon from assets/icons directory (PNG first, then ICO)
        let iconPath = path.join(process.resourcesPath, 'app', 'assets', 'icons', 'tray-icon.png');

        try {
          img = nativeImage.createFromPath(iconPath);
        } catch {
          // Try ICO if PNG fails
          iconPath = path.join(process.resourcesPath, 'app', 'assets', 'icons', 'tray-icon.ico');
          img = nativeImage.createFromPath(iconPath);
        }

        // Ensure it's the right size for tray (16x16 is standard)
        if (img.getSize().width !== 16 || img.getSize().height !== 16) {
          img = img.resize({ width: 16, height: 16 });
        }

        logger.info(`Custom tray icon loaded successfully from ${iconPath}`);
      } catch (iconError) {
        logger.warn('Custom icon not found, creating default icon', iconError);

        // Create a simple 16x16 tray icon using raw pixel data
        // This creates a basic blue square with white center
        const size = 16;
        const data = Buffer.alloc(size * size * 4); // RGBA

        // Fill with blue background
        for (let i = 0; i < size * size; i++) {
          const offset = i * 4;
          data[offset] = 0;     // R
          data[offset + 1] = 122; // G
          data[offset + 2] = 204; // B
          data[offset + 3] = 255; // A
        }

        // White center square
        const margin = 2;
        for (let y = margin; y < size - margin; y++) {
          for (let x = margin; x < size - margin; x++) {
            const offset = (y * size + x) * 4;
            data[offset] = 255;     // R
            data[offset + 1] = 255; // G
            data[offset + 2] = 255; // B
            data[offset + 3] = 255; // A
          }
        }

        img = nativeImage.createFromBuffer(data, { width: size, height: size });
        logger.info('Default tray icon created');
      }

      this.tray = new Tray(img);
      this.tray.setToolTip('Break Timer - Take regular breaks');

      await this.updateContextMenu();
      logger.info('Tray created successfully');
    } catch (error) {
      logger.error('Failed to create tray', error);
      throw error;
    }
  }

  private async updateContextMenu(): Promise<void> {
    if (!this.tray) return;

    const status = this.scheduler.getStatus();
    const pauseLabel = status.isPaused
      ? `Resume (paused for ${status.nextBreakIn} min)`
      : 'Pause for 1 hour';

    // Load current settings to check startWithWindows status
    const currentSettings = await this.settingsManager.loadSettings();
    const startWithWindowsLabel = currentSettings.startWithWindows
      ? '✓ Start with Windows'
      : 'Start with Windows';

    const contextMenu = Menu.buildFromTemplate([
      {
        label: pauseLabel,
        click: () => this.handlePauseToggle(),
      },
      { type: 'separator' },
      {
        label: startWithWindowsLabel,
        click: () => this.handleStartWithWindowsToggle(),
      },
      {
        label: 'Settings...',
        click: () => this.showSettings(),
      },
      {
        label: '🔥 Force Break Now',
        click: () => this.handleForceBreak(),
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          logger.info('Quit requested from tray menu');
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  private handlePauseToggle(): void {
    const status = this.scheduler.getStatus();

    if (status.isPaused) {
      // Resume by clearing pause
      this.scheduler.stop();
      this.scheduler.start();
      logger.info('Scheduler resumed from tray');
    } else {
      // Pause for 1 hour
      this.scheduler.pauseForOneHour();
      logger.info('Scheduler paused for 1 hour from tray');
    }

    // Update menu after action
    setTimeout(() => this.updateContextMenu(), 100);
  }

  private async handleStartWithWindowsToggle(): Promise<void> {
    try {
      const currentSettings = await this.settingsManager.loadSettings();
      const newSettings: AppSettings = {
        ...currentSettings,
        startWithWindows: !currentSettings.startWithWindows,
      };

      await this.settingsManager.saveSettings(newSettings);
      logger.info(`Start with Windows toggled to: ${newSettings.startWithWindows}`);

      // Update menu after action
      await this.updateContextMenu();
    } catch (error) {
      logger.error('Failed to toggle start with Windows setting', error);
    }
  }

  private async showSettings(): Promise<void> {
    try {
      const currentSettings = await this.settingsManager.loadSettings();

      // For now, show current settings in a dialog
      // In the future, this will open a settings window
      const message = `Current Settings:\n\n` +
        `Break Interval: ${currentSettings.intervalMinutes} minutes\n` +
        `Break Duration: ${currentSettings.breakSeconds} seconds\n\n` +
        `Settings window will be implemented in the next task.`;

      dialog.showMessageBox({
        type: 'info',
        title: 'Break Timer Settings',
        message: 'Settings',
        detail: message,
      });

      logger.info('Settings dialog shown');
    } catch (error) {
      logger.error('Failed to show settings', error);
    }
  }

  private async handleForceBreak(): Promise<void> {
    try {
      const currentSettings = await this.settingsManager.loadSettings();

      logger.info(`Force break triggered from tray menu - duration: ${currentSettings.breakSeconds} seconds`);

      // Trigger overlay directly through OverlayManager
      this.overlayManager.showOverlays(currentSettings.breakSeconds);

      logger.info('Force break activated successfully');
    } catch (error) {
      logger.error('Failed to force break', error);
      dialog.showErrorBox('Error', 'Failed to start break overlay');
    }
  }

  async updateTrayStatus(): Promise<void> {
    await this.updateContextMenu();
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
