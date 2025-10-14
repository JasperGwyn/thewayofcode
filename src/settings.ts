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
    logger.info(`SettingsManager: settings path resolved to ${this.settingsPath}`);
  }

  async loadSettings(): Promise<AppSettings> {
    try {
      logger.info(`SettingsManager: loading settings from ${this.settingsPath}`);
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
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        logger.warn(`SettingsManager: settings file not found at ${this.settingsPath}; using defaults`);
      } else {
        logger.warn(`SettingsManager: failed to load settings from ${this.settingsPath} (code=${err.code ?? 'unknown'}) - using defaults`, error);
      }
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
      const isPackaged = app.isPackaged;
      const exePath = process.execPath; // packaged: app exe, dev: electron.exe
      const devMain = path.join(process.cwd(), 'dist', 'main.js');
      const args = isPackaged ? [] : [devMain];

      // Primary: Electron login items
      try {
        app.setLoginItemSettings({
          openAtLogin: enabled,
          openAsHidden: true,
          path: exePath,
          args,
        });
        const status = app.getLoginItemSettings();
        logger.info(`Auto-start via login items: openAtLogin=${status.openAtLogin} packaged=${isPackaged}`);
      } catch (liErr) {
        logger.warn('LoginItemSettings failed; will fallback to registry', liErr);
      }

      // Fallback: Windows registry (Run key)
      const appName = 'The Way of Code - Break Timer';
      const regKey = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`;
      if (enabled) {
        const value = isPackaged ? `"${exePath}"` : `"${exePath}" "${devMain}"`;
        const command = `reg add "${regKey}" /v "${appName}" /t REG_SZ /d "${value}" /f`;
        await execAsync(command);
        logger.info('Auto-start enabled in Windows registry');
      } else {
        const command = `reg delete "${regKey}" /v "${appName}" /f`;
        try {
          await execAsync(command);
          logger.info('Auto-start disabled in Windows registry');
        } catch {
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

  getSettingsPath(): string {
    return this.settingsPath;
  }
}
