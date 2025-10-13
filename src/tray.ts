import { app, Menu, Tray, BrowserWindow, dialog } from 'electron';
import path from 'path';
import { logger } from './log.js';
import type { BreakScheduler } from './scheduler.js';
import type { SettingsManager, AppSettings } from './settings.js';

export class TrayManager {
  private tray: Tray | null = null;
  private scheduler: BreakScheduler;
  private settingsManager: SettingsManager;

  constructor(scheduler: BreakScheduler, settingsManager: SettingsManager) {
    this.scheduler = scheduler;
    this.settingsManager = settingsManager;
  }

  async createTray(): Promise<void> {
    try {
      // For now, use a default icon. In production, you'd include a proper icon file
      const iconPath = path.join(process.resourcesPath || '', 'icon.ico');

      // Fallback to a built-in icon if custom icon doesn't exist
      let finalIconPath: string;
      try {
        await require('fs').promises.access(iconPath);
        finalIconPath = iconPath;
      } catch {
        // Use Electron's default icon as fallback
        finalIconPath = path.join(process.resourcesPath || '', 'electron.ico');
      }

      this.tray = new Tray(finalIconPath);
      this.tray.setToolTip('Break Timer - Take regular breaks');

      this.updateContextMenu();
      logger.info('Tray created successfully');
    } catch (error) {
      logger.error('Failed to create tray', error);
      throw error;
    }
  }

  private updateContextMenu(): void {
    if (!this.tray) return;

    const status = this.scheduler.getStatus();
    const pauseLabel = status.isPaused
      ? `Resume (paused for ${status.nextBreakIn} min)`
      : 'Pause for 1 hour';

    const contextMenu = Menu.buildFromTemplate([
      {
        label: pauseLabel,
        click: () => this.handlePauseToggle(),
      },
      { type: 'separator' },
      {
        label: 'Settings...',
        click: () => this.showSettings(),
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

  private async showSettings(): Promise<void> {
    try {
      const currentSettings = await this.settingsManager.loadSettings();

      // For now, show current settings in a dialog
      // In the future, this will open a settings window
      const message = `Current Settings:\n\n` +
        `Break Interval: ${currentSettings.intervalMinutes} minutes\n` +
        `Break Duration: ${currentSettings.breakSeconds} seconds\n\n` +
        `Settings window will be implemented in the next task.`;

      dialog.showMessageBox(BrowserWindow.getFocusedWindow() || undefined, {
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

  updateTrayStatus(): void {
    this.updateContextMenu();
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
