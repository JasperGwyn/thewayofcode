import { powerMonitor } from 'electron';
import { logger } from './log.js';
import type { BreakScheduler } from './scheduler.js';
import type { OverlayManager } from './overlay/OverlayManager.js';

export class IdleManager {
  private scheduler: BreakScheduler;
  private overlayManager: OverlayManager;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly idleThresholdSec: number;
  private isInIdle: boolean = false;

  constructor(scheduler: BreakScheduler, overlayManager: OverlayManager, idleThresholdSec: number = 60) {
    this.scheduler = scheduler;
    this.overlayManager = overlayManager;
    this.idleThresholdSec = idleThresholdSec;
  }

  start(): void {
    logger.info(`IdleManager: starting (threshold=${this.idleThresholdSec}s)`);

    // Power/screen events
    powerMonitor.on('suspend', () => this.enterIdle('suspend'));
    powerMonitor.on('resume', () => this.exitIdle('resume'));
    // Some systems emit lock/unlock instead of suspend/resume
    try { powerMonitor.on('lock-screen', () => this.enterIdle('lock-screen')); } catch { /* ignore */ }
    try { powerMonitor.on('unlock-screen', () => this.exitIdle('unlock-screen')); } catch { /* ignore */ }

    // Polling fallback using idle state
    this.pollInterval = setInterval(() => {
      try {
        const state = powerMonitor.getSystemIdleState(this.idleThresholdSec);
        if ((state === 'idle' || state === 'locked') && !this.isInIdle) {
          this.enterIdle(`idle-state:${state}`);
        } else if (state === 'active' && this.isInIdle) {
          this.exitIdle('idle-active');
        }
      } catch (error) {
        logger.warn('IdleManager: getSystemIdleState failed', error);
      }
    }, 15000); // check every 15s
  }

  stop(): void {
    logger.info('IdleManager: stopping');
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    // Note: powerMonitor listeners are process-wide; not removing to keep it simple.
  }

  private enterIdle(source: string): void {
    if (this.isInIdle) return;
    
    // Don't enter idle mode if there's an active break - breaks are intentional idle time
    if (this.scheduler.getIsBreakActive()) {
      logger.info(`IdleManager: System idle detected but break is active, ignoring idle state`);
      return;
    }
    
    this.isInIdle = true;
    logger.info(`IdleManager: entering standby due to ${source}`);

    // If an overlay is visible, hide it
    try { this.overlayManager.hideOverlays(); } catch (e) { logger.warn('IdleManager: hideOverlays failed', e); }

    // Pause scheduling by stopping timers (will be restarted on activity)
    try { this.scheduler.stop(); } catch (e) { logger.warn('IdleManager: scheduler.stop failed', e); }
  }

  private exitIdle(source: string): void {
    if (!this.isInIdle) return;
    this.isInIdle = false;
    logger.info(`IdleManager: exiting standby due to ${source}`);

    // Resume scheduling from now
    try {
      this.scheduler.stop();
      this.scheduler.start();
    } catch (e) {
      logger.warn('IdleManager: failed to restart scheduler', e);
    }
  }
}

