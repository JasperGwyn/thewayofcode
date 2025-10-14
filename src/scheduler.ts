import { powerMonitor } from 'electron';
import { logger } from './log.js';
import { emitToRenderer } from './ipc.js';
import type { AppSettings } from './settings.js';

export interface SchedulerEvents {
  onBreakStart: () => void;
  onBreakEnd: () => void;
}

export class BreakScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private breakTimeoutId: NodeJS.Timeout | null = null;
  private pausedUntil: Date | null = null;
  private lastBreakTime: Date = new Date();
  private isBreakActive: boolean = false;
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
    if (this.isBreakActive) {
      logger.warn('Break already active, skipping trigger');
      return;
    }

    this.lastBreakTime = new Date();
    this.isBreakActive = true;
    logger.info(`Break started (duration: ${this.settings.breakSeconds}s)`);

    // Emit IPC event with break duration
    logger.info(`Scheduler: Emitting break:start with ${this.settings.breakSeconds} seconds`);
    emitToRenderer('break:start', this.settings.breakSeconds);

    // Also call the event handler
    this.events.onBreakStart();

    // Schedule break end
    this.breakTimeoutId = setTimeout(() => {
      this.endBreak();
    }, this.settings.breakSeconds * 1000);
  }

  private endBreak(): void {
    if (!this.isBreakActive) {
      logger.warn('No active break to end');
      return;
    }

    this.isBreakActive = false;
    logger.info('Break ended');

    // Emit IPC event
    emitToRenderer('break:end');

    // Also call the event handler
    this.events.onBreakEnd();

    // Clear timeout
    if (this.breakTimeoutId) {
      clearTimeout(this.breakTimeoutId);
      this.breakTimeoutId = null;
    }
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
    if (this.breakTimeoutId) {
      clearTimeout(this.breakTimeoutId);
      this.breakTimeoutId = null;
    }
    if (this.isBreakActive) {
      this.endBreak();
    }
    this.pausedUntil = null;
    logger.info('Break scheduler stopped');
  }

  pauseForOneHour(): void {
    // End any active break before pausing
    if (this.isBreakActive) {
      this.endBreak();
    }
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
    isBreakActive: boolean;
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
      isBreakActive: this.isBreakActive,
      pausedUntil: this.pausedUntil,
      nextBreakIn,
      lastBreakTime: this.lastBreakTime,
    };
  }
}
