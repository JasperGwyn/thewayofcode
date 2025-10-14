import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './log.js';

const execAsync = promisify(exec);

export interface AppSettings {
  intervalMinutes: number;
  breakSeconds: number;
  startWithWindows: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  intervalMinutes: 30,
  breakSeconds: 120,
  startWithWindows: false,
};

const SETTINGS_FILE_NAME = 'settings.json';

export class SettingsManager {
  private settingsPath: string;

  constructor() {
    this.settingsPath = path.join(app.getPath('userData'), SETTINGS_FILE_NAME);
  }

  async loadSettings(): Promise<AppSettings> {
    try {
      const data = await fs.readFile(this.settingsPath, 'utf-8');
      const parsed = JSON.parse(data) as Partial<AppSettings>;

      // Validate and merge with defaults
      const settings: AppSettings = {
        intervalMinutes: typeof parsed.intervalMinutes === 'number' && parsed.intervalMinutes > 0
          ? parsed.intervalMinutes
          : DEFAULT_SETTINGS.intervalMinutes,
        breakSeconds: typeof parsed.breakSeconds === 'number' && parsed.breakSeconds > 0
          ? parsed.breakSeconds
          : DEFAULT_SETTINGS.breakSeconds,
        startWithWindows: typeof parsed.startWithWindows === 'boolean'
          ? parsed.startWithWindows
          : DEFAULT_SETTINGS.startWithWindows,
      };

      logger.info(`Settings loaded: interval=${settings.intervalMinutes}min, break=${settings.breakSeconds}s, startWithWindows=${settings.startWithWindows}`);
      return settings;
    } catch (error) {
      logger.warn('Failed to load settings, using defaults', error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      await fs.writeFile(this.settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
      logger.info(`Settings saved: interval=${settings.intervalMinutes}min, break=${settings.breakSeconds}s, startWithWindows=${settings.startWithWindows}`);

      // Apply auto-start setting
      await this.applyAutoStartSetting(settings.startWithWindows);
    } catch (error) {
      logger.error('Failed to save settings', error);
      throw error;
    }
  }

  getDefaultSettings(): AppSettings {
    return { ...DEFAULT_SETTINGS };
  }

  async setAutoStart(enabled: boolean): Promise<void> {
    if (process.platform !== 'win32') {
      logger.warn('Auto-start is only supported on Windows');
      return;
    }

    try {
      const appPath = process.execPath;
      const appName = 'BreakTimer';
      const regKey = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`;

      if (enabled) {
        // Add to registry
        const command = `reg add "${regKey}" /v "${appName}" /t REG_SZ /d "\\"${appPath}\\"" /f`;
        await execAsync(command);
        logger.info('Auto-start enabled in Windows registry');
      } else {
        // Remove from registry
        const command = `reg delete "${regKey}" /v "${appName}" /f`;
        try {
          await execAsync(command);
          logger.info('Auto-start disabled in Windows registry');
        } catch (deleteError) {
          // Ignore error if key doesn't exist
          logger.info('Auto-start key not found in registry (already disabled)');
        }
      }
    } catch (error) {
      logger.error('Failed to set auto-start', error);
      throw error;
    }
  }

  async applyAutoStartSetting(startWithWindows: boolean): Promise<void> {
    try {
      await this.setAutoStart(startWithWindows);
    } catch (error) {
      logger.error('Failed to apply auto-start setting', error);
      // Don't throw here to avoid blocking settings save
    }
  }
}
