import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { logger } from './log.js';

export interface AppSettings {
  intervalMinutes: number;
  breakSeconds: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  intervalMinutes: 30,
  breakSeconds: 120,
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
      };

      logger.info(`Settings loaded: interval=${settings.intervalMinutes}min, break=${settings.breakSeconds}s`);
      return settings;
    } catch (error) {
      logger.warn('Failed to load settings, using defaults', error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      await fs.writeFile(this.settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
      logger.info(`Settings saved: interval=${settings.intervalMinutes}min, break=${settings.breakSeconds}s`);
    } catch (error) {
      logger.error('Failed to save settings', error);
      throw error;
    }
  }

  getDefaultSettings(): AppSettings {
    return { ...DEFAULT_SETTINGS };
  }
}
