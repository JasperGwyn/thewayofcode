import { BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../log.js';
import { createOverlayWindow } from './createOverlayWindow.js';
import { pickRandomArticle, getFallbackArticle, type PickedArticle } from '../articles/ArticlePicker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type OverlayInitUiPayload = {
  breakSeconds: number;
};

type OverlayArticleLoadedUiPayload = {
  url: string;
};

type OverlayUiMessage =
  | { channel: 'overlay:init'; payload: OverlayInitUiPayload }
  | { channel: 'overlay:article-loaded'; payload: OverlayArticleLoadedUiPayload };

type OverlayState = {
  window: BrowserWindow;
  isUiReady: boolean;
  pendingUiMessages: OverlayUiMessage[];
  currentArticle: PickedArticle | null;
  allowClose: boolean;
  displayId: number;
};

export class OverlayManager {
  private overlayWindows: BrowserWindow[] = [];
  private overlayStates: Map<BrowserWindow, OverlayState> = new Map();
  private isActive: boolean = false;
  private readonly overlayUiHtmlPath: string;
  private readonly overlayUiPreloadPath: string;

  constructor() {
    this.overlayUiHtmlPath = path.join(__dirname, 'ui', 'index.html');
    this.overlayUiPreloadPath = path.join(__dirname, 'ui', 'preload.js');
    this.setupIpcListeners();
  }

  private setupIpcListeners(): void {
    logger.info('OverlayManager: Setting up IPC listeners');

    ipcMain.on('break:start', (_event, breakSeconds: number) => {
      logger.info(`OverlayManager: break:start received, duration: ${breakSeconds}s`);
      this.showOverlays(breakSeconds);
    });

    ipcMain.on('break:end', () => {
      logger.info('OverlayManager: break:end received');
      this.hideOverlays();
    });

    ipcMain.on('overlay:log', (_event, message: string) => {
      logger.info(`Overlay: ${message}`);
    });

    ipcMain.on('overlay:close-break', (_event, payload?: { source?: string }) => {
      const srcWin = BrowserWindow.fromWebContents(_event.sender);
      const srcId = srcWin ? srcWin.id : -1;
      logger.info(`OverlayManager: overlay:close-break received from winId=${srcId} with payload=${JSON.stringify(payload)}`);
      const source = payload?.source ?? 'unknown';
      if (source !== 'pill' && source !== 'timer') {
        logger.warn(`OverlayManager: Ignoring close request from unexpected source: ${source}`);
        return;
      }
      logger.info('OverlayManager: Valid close request from pill - hiding overlays');
      this.hideOverlays();
      // Notificar fin de break al resto de la app
      ipcMain.emit('break:end');
      logger.info('OverlayManager: break:end emitted');
    });
  }

  public async showOverlays(breakSeconds: number): Promise<void> {
    if (this.isActive) {
      logger.warn('OverlayManager: Overlays already active, skipping');
      return;
    }

    this.isActive = true;
    logger.info('OverlayManager: Showing overlays on all displays');

    try {
      let article: PickedArticle;
      try {
        article = await pickRandomArticle();
        logger.info(`OverlayManager: Picked article ${article.id}: ${article.url}`);
      } catch (error) {
        logger.warn('OverlayManager: Failed to pick random article, using fallback', error);
        article = getFallbackArticle();
      }

      const displays = screen.getAllDisplays();

      for (const display of displays) {
        const overlayWindow = createOverlayWindow(display, breakSeconds);
        this.overlayWindows.push(overlayWindow);
        logger.info(`OverlayManager: created overlay window winId=${overlayWindow.id} for display=${display.id}`);

        const overlayState: OverlayState = {
          window: overlayWindow,
          isUiReady: false,
          pendingUiMessages: [],
          currentArticle: article,
          allowClose: false,
          displayId: display.id,
        };
        this.overlayStates.set(overlayWindow, overlayState);

        overlayWindow.webContents.once('did-finish-load', () => {
          logger.info(`Overlay window did-finish-load (display ${display.id}, winId ${overlayWindow.id})`);
          this.markUiReady(overlayState);
        });

        // Enviar datos al renderer (se encolarán hasta que cargue)
        this.sendMessageToOverlayUi(overlayState, { channel: 'overlay:init', payload: { breakSeconds } });
        this.sendMessageToOverlayUi(overlayState, {
          channel: 'overlay:article-loaded',
          payload: { url: article.url },
        });

        overlayWindow.on('close', (event) => {
          // Block unexpected window closes (e.g., accidental OS gestures)
          if (!overlayState.allowClose) {
            event.preventDefault();
            logger.warn(`OverlayManager: Prevented unintended overlay window close (winId=${overlayWindow.id}, display=${overlayState.displayId})`);
          }
        });

        overlayWindow.on('closed', () => {
          logger.info(`OverlayManager: Overlay window closed (winId=${overlayWindow.id}, display=${overlayState.displayId})`);
          this.cleanupOverlayState(overlayWindow);
        });
      }
    } catch (error) {
      logger.error('OverlayManager: Failed to show overlays', error);
      this.hideOverlays();
    }
  }

  public hideOverlays(): void {
    logger.info('OverlayManager: Hiding overlays');
    this.isActive = false;

    for (const window of this.overlayWindows) {
      try {
        if (!window.isDestroyed()) {
          const state = this.overlayStates.get(window);
          if (state) {
            logger.info(`OverlayManager: Preparing to close overlay winId=${window.id} (allowClose true)`);
            state.allowClose = true;
          }
          try {
            window.setClosable(true);
          } catch (error) {
            logger.warn('OverlayManager: setClosable(true) not supported', error);
          }
          // Fade-out effect before closing (simple, fast)
          this.fadeOutAndClose(window, 250);
        }
      } catch (error) {
        logger.error('OverlayManager: Error closing overlay window', error);
      }
    }

    this.overlayWindows = [];

    for (const window of Array.from(this.overlayStates.keys())) {
      this.cleanupOverlayState(window);
    }
  }

  public getActiveOverlayCount(): number {
    return this.overlayWindows.length;
  }

  private cleanupOverlayState(window: BrowserWindow): void {
    if (this.overlayStates.has(window)) {
      this.overlayStates.delete(window);
    }
  }

  public destroy(): void {
    logger.info('OverlayManager: Destroying manager');
    this.hideOverlays();

    ipcMain.removeAllListeners('break:start');
    ipcMain.removeAllListeners('break:end');
    ipcMain.removeAllListeners('overlay:close-break');
  }

  private markUiReady(state: OverlayState): void {
    state.isUiReady = true;
    logger.info(`OverlayManager: UI marked ready for winId=${state.window.id} - flushing ${state.pendingUiMessages.length} message(s)`);
    this.flushPendingMessages(state);
  }

  private flushPendingMessages(state: OverlayState): void {
    while (state.pendingUiMessages.length > 0) {
      const message = state.pendingUiMessages.shift();
      if (!message) {
        continue;
      }
      try {
        if (!state.window.isDestroyed()) {
          logger.info(`OverlayManager: Sending queued message '${message.channel}' to winId=${state.window.id}`);
          state.window.webContents.send(message.channel, message.payload);
        }
      } catch (error) {
        logger.error('OverlayManager: Failed to flush message to overlay UI', error);
      }
    }
  }

  private sendMessageToOverlayUi(state: OverlayState, message: OverlayUiMessage): void {
    if (!state.isUiReady) {
      logger.info(`OverlayManager: Queueing message '${message.channel}' for winId=${state.window.id}`);
      state.pendingUiMessages.push(message);
      return;
    }

    try {
      if (!state.window.isDestroyed()) {
        logger.info(`OverlayManager: Sending message '${message.channel}' to winId=${state.window.id}`);
        state.window.webContents.send(message.channel, message.payload);
      }
    } catch (error) {
      logger.error('OverlayManager: Failed to send message to overlay UI', error);
    }
  }

  private getDisplayIdForWindow(window: BrowserWindow): number | null {
    try {
      const bounds = window.getBounds();
      const display = screen.getDisplayMatching(bounds);
      return display?.id ?? null;
    } catch (error) {
      logger.warn('OverlayManager: Failed to map window to display', error);
      return null;
    }
  }

  private fadeOutAndClose(window: BrowserWindow, durationMs: number = 250): void {
    try {
      if (window.isDestroyed()) return;
      const steps = Math.max(1, Math.round(durationMs / 16));
      const startOpacity = typeof (window as unknown as { getOpacity?: () => number }).getOpacity === 'function'
        ? (window as unknown as { getOpacity: () => number }).getOpacity()
        : 1;
      let currentStep = 0;
      const interval = setInterval(() => {
        try {
          if (window.isDestroyed()) { clearInterval(interval); return; }
          currentStep++;
          const t = currentStep / steps;
          const newOpacity = Math.max(0, startOpacity * (1 - t));
          window.setOpacity(newOpacity);
          if (currentStep >= steps) {
            clearInterval(interval);
            // Ensure opacity is 0 just before closing
            try { window.setOpacity(0); } catch {}
            window.close();
          }
        } catch {
          clearInterval(interval);
          try { window.close(); } catch {}
        }
      }, 16);
    } catch {
      try { window.close(); } catch {}
    }
  }
}
