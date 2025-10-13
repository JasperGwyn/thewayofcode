import { BrowserWindow, ipcMain, powerMonitor } from 'electron';
import { logger } from './log.js';
import type { AppSettings } from './settings.js';

export interface SchedulerEvents {
  onBreakStart: () => void;
}

export class BreakScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private pausedUntil: Date | null = null;
  private lastBreakTime: Date = new Date();
  private settings: AppSettings;
  private events: SchedulerEvents;

  constructor(settings: AppSettings, events: SchedulerEvents) {
    this.settings = settings;
    this.events = events;
    this.setupPowerMonitor();
  }

  private setupPowerMonitor(): void {
    // Handle system resume to adjust timer
    powerMonitor.on('resume', () => {
      logger.info('System resumed, checking if break was missed');
      this.checkMissedBreak();
    });

    // Handle system suspend
    powerMonitor.on('suspend', () => {
      logger.info('System suspended');
    });
  }

  private checkMissedBreak(): void {
    if (this.pausedUntil && new Date() < this.pausedUntil) {
      return; // Still paused
    }

    const now = new Date();
    const timeSinceLastBreak = now.getTime() - this.lastBreakTime.getTime();
    const intervalMs = this.settings.intervalMinutes * 60 * 1000;

    if (timeSinceLastBreak >= intervalMs) {
      logger.info('Break was missed during suspension, triggering now');
      this.triggerBreak();
    }
  }

  private triggerBreak(): void {
    this.lastBreakTime = new Date();
    logger.info('Break triggered');

    // Emit IPC event to main process
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      window.webContents.send('break:start');
    });

    // Also call the event handler
    this.events.onBreakStart();
  }

  private scheduleNextBreak(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    if (this.pausedUntil && new Date() < this.pausedUntil) {
      // Still paused, schedule check when pause ends
      const remainingMs = this.pausedUntil.getTime() - Date.now();
      this.intervalId = setTimeout(() => {
        this.scheduleNextBreak();
      }, remainingMs);
      logger.info(`Scheduler paused, will resume in ${Math.round(remainingMs / 1000 / 60)} minutes`);
      return;
    }

    const intervalMs = this.settings.intervalMinutes * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.triggerBreak();
    }, intervalMs);

    const nextBreak = new Date(Date.now() + intervalMs);
    logger.info(`Next break scheduled for ${nextBreak.toLocaleTimeString()}`);
  }

  start(): void {
    logger.info('Starting break scheduler');
    this.scheduleNextBreak();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.pausedUntil = null;
    logger.info('Break scheduler stopped');
  }

  pauseForOneHour(): void {
    this.pausedUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    logger.info('Scheduler paused for 1 hour');
    this.scheduleNextBreak(); // Reschedule to account for pause
  }

  updateSettings(newSettings: AppSettings): void {
    this.settings = newSettings;
    logger.info(`Settings updated: interval=${newSettings.intervalMinutes}min, break=${newSettings.breakSeconds}s`);
    this.scheduleNextBreak(); // Reschedule with new settings
  }

  getStatus(): {
    isRunning: boolean;
    isPaused: boolean;
    pausedUntil: Date | null;
    nextBreakIn: number | null; // minutes
    lastBreakTime: Date;
  } {
    const isPaused = this.pausedUntil !== null && new Date() < this.pausedUntil;
    let nextBreakIn: number | null = null;

    if (isPaused && this.pausedUntil) {
      nextBreakIn = Math.max(0, Math.round((this.pausedUntil.getTime() - Date.now()) / 1000 / 60));
    } else if (this.intervalId) {
      const intervalMs = this.settings.intervalMinutes * 60 * 1000;
      const timeSinceLastBreak = Date.now() - this.lastBreakTime.getTime();
      nextBreakIn = Math.max(0, Math.round((intervalMs - timeSinceLastBreak) / 1000 / 60));
    }

    return {
      isRunning: this.intervalId !== null,
      isPaused,
      pausedUntil: this.pausedUntil,
      nextBreakIn,
      lastBreakTime: this.lastBreakTime,
    };
  }
}
