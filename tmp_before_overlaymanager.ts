import { BrowserWindow, screen, ipcMain, BrowserView, type BrowserWindowConstructorOptions } from 'electron';
import type { BrowserViewConstructorOptions } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../log.js';
import { createOverlayWindow } from './createOverlayWindow.js';
import { pickRandomArticle, getFallbackArticle, type PickedArticle } from '../articles/ArticlePicker.js';
import { ArticleScreen } from './screens/ArticleScreen.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TIMER_WINDOW_MIN_WIDTH = 260;
const TIMER_WINDOW_MAX_WIDTH = 460;
const TIMER_WINDOW_HEIGHT = 96;
const TIMER_WINDOW_BOTTOM_MARGIN = 48;
const TIMER_WINDOW_WIDTH_RATIO = 0.24;

type OverlayInitUiPayload = {
  breakSeconds: number;
};

type OverlayArticleLoadedUiPayload = {
  articleId: number;
  hasConnectionError: boolean;
};

type OverlayUiMessage =
  | { channel: 'overlay:init'; payload: OverlayInitUiPayload }
  | { channel: 'overlay:article-loaded'; payload: OverlayArticleLoadedUiPayload };

/**
 * Gestiona las ventanas de overlay que se muestran durante los breaks.
 * Crea una ventana por cada monitor conectado.
 */
type OverlayState = {
  window: BrowserWindow;
  currentArticle: PickedArticle | null;
  articleScreen: ArticleScreen | null;
  articleView: BrowserView;
  timerWindow: BrowserWindow;
  isUiReady: boolean;
  pendingUiMessages: OverlayUiMessage[];
  boundsCleanupCallbacks: Array<() => void>;
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

  /**
   * Configura los listeners de IPC para eventos de break
   */
  private setupIpcListeners(): void {
    logger.info('OverlayManager: Setting up IPC listeners');

    // Escuchar evento break:start
    ipcMain.on('break:start', (_event, breakSeconds: number) => {
      logger.info(`OverlayManager: break:start received, duration: ${breakSeconds}s`);
      this.showOverlays(breakSeconds);
    });

    // Escuchar evento break:end
    ipcMain.on('break:end', () => {
      logger.info('OverlayManager: break:end received');
      this.hideOverlays();
    });

    // Escuchar logs desde los overlays
    ipcMain.on('overlay:log', (_event, message: string) => {
      logger.info(`Overlay: ${message}`);
    });

    // Escuchar evento de cerrar break desde el overlay
    ipcMain.on('overlay:close-break', () => {
      logger.info('OverlayManager: overlay:close-break received - hiding overlays');
      this.hideOverlays();
      // Emitir break:end para que el scheduler sepa que terminó
      ipcMain.emit('break:end');
      logger.info('OverlayManager: break:end emitted');
    });
  }

  /**
   * Muestra los overlays en todos los monitores
   */
  public async showOverlays(breakSeconds: number): Promise<void> {
    if (this.isActive) {
      logger.warn('OverlayManager: Overlays already active, skipping');
      return;
    }

    this.isActive = true;
    logger.info('OverlayManager: Showing overlays on all displays');

    try {
      // Obtener artículo aleatorio para todos los overlays
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

        const articleView = this.createArticleBrowserView();
        const timerWindow = this.createTimerWindow(overlayWindow);

        const articleScreen = new ArticleScreen(articleView);

        const overlayState: OverlayState = {
          window: overlayWindow,
          currentArticle: article,
          articleScreen,
          articleView,
          timerWindow,
          isUiReady: false,
          pendingUiMessages: [],
          boundsCleanupCallbacks: [],
        };

        this.overlayStates.set(overlayWindow, overlayState);

        overlayWindow.addBrowserView(articleView);
        this.updateOverlayBounds(overlayState);
        this.registerWindowBoundsSync(overlayState);
        this.configureTimerWindow(overlayState, breakSeconds);

        this.loadArticleInOverlay(overlayWindow, article).catch((error) => {
          logger.error('OverlayManager: Failed to load article in overlay', error);
        });

        this.setupExternalLinkHandling(articleView);

        overlayWindow.on('closed', () => {
          logger.info(`OverlayManager: Overlay window closed for display ${display.id}`);
          this.cleanupOverlayState(overlayWindow);
        });
      }

      logger.info(`OverlayManager: Created ${this.overlayWindows.length} overlay windows`);
    } catch (error) {
      logger.error('OverlayManager: Failed to create overlay windows', error);
      this.isActive = false;
    }
  }

  /**
   * Oculta y destruye todos los overlays
   */
  public hideOverlays(): void {
    logger.info(`OverlayManager: hideOverlays called - isActive: ${this.isActive}, overlayWindows: ${this.overlayWindows.length}`);

    // Cerrar TODAS las ventanas que tenemos registradas
    for (const window of this.overlayWindows) {
      try {
        if (!window.isDestroyed()) {
          const bounds = window.getBounds();
          logger.info(`OverlayManager: Closing registered overlay window at ${bounds.x},${bounds.y}`);
          window.close();
        } else {
          logger.info('OverlayManager: Window already destroyed');
        }
      } catch (error) {
        logger.error('OverlayManager: Error closing overlay window', error);
      }
    }

    // Limpiar estados de overlays
    for (const window of this.overlayWindows) {
      this.cleanupOverlayState(window);
    }

    // También buscar cualquier ventana overlay que pueda haber quedado
    const allWindows = BrowserWindow.getAllWindows();
    for (const window of allWindows) {
      try {
        if (!window.isDestroyed() && window.isAlwaysOnTop()) {
          const bounds = window.getBounds();
          // Si es una ventana grande y always-on-top, probablemente es un overlay
          if (bounds.width > 1000 && bounds.height > 500) {
            logger.info(`OverlayManager: Closing additional overlay window at ${bounds.x},${bounds.y}`);
            window.close();
          }
        }
      } catch (error) {
        // Ignorar errores al verificar ventanas
      }
    }

    // Limpiar el estado local
    this.overlayWindows = [];
    this.overlayStates.clear();
    this.isActive = false;
    logger.info('OverlayManager: All overlays closed and state reset');
  }

  /**
   * Verifica si hay overlays activos
   */
  public isOverlayActive(): boolean {
    return this.isActive;
  }

  /**
   * Obtiene el número de ventanas overlay activas
   */
  public getActiveOverlayCount(): number {
    return this.overlayWindows.length;
  }

  /**
   * Carga un artículo en el overlay especificado
   */
  private async loadArticleInOverlay(window: BrowserWindow, article: PickedArticle): Promise<void> {
    const state = this.overlayStates.get(window);
    if (!state) {
      throw new Error('Overlay state not found');
    }

    if (!state.articleScreen) {
      throw new Error('OverlayManager: Article screen not initialized');
    }

    try {
      await state.articleScreen.load(article);

      // Actualizar estado
      state.currentArticle = article;

      // Notificar al UI sobre el cambio de artículo
      this.sendMessageToTimerUi(state, {
        channel: 'overlay:article-loaded',
        payload: {
          articleId: article.id,
          hasConnectionError: article.id === 0,
        },
      });

      window.webContents.send('overlay:article-loaded', {
        articleId: article.id,
        hasConnectionError: article.id === 0, // ID 0 indica fallback
      });

      logger.info(`OverlayManager: Loaded article ${article.id} in overlay`);
    } catch (error) {
      logger.error('OverlayManager: Failed to load article in overlay', error);
      throw error;
    }
  }

  /**
   * Configura el manejo de links externos en un BrowserView
   */
  private setupExternalLinkHandling(browserView: BrowserView): void {
    browserView.webContents.setWindowOpenHandler((details) => {
      const url = details.url;

      // Si no es thewayofcode.com, abrir en navegador externo
      if (!url.includes('thewayofcode.com')) {
        const { shell } = require('electron');
        shell.openExternal(url).catch((error: Error) => {
          logger.error('OverlayManager: Failed to open external link', error);
        });
        return { action: 'deny' };
      }

      // Permitir navegación dentro del sitio
      return { action: 'allow' };
    });

    // También interceptar will-navigate para mayor seguridad
    browserView.webContents.on('will-navigate', (event, url) => {
      if (!url.includes('thewayofcode.com')) {
        event.preventDefault();
        const { shell } = require('electron');
        shell.openExternal(url).catch((error: Error) => {
          logger.error('OverlayManager: Failed to open external link on navigate', error);
        });
      }
    });
  }


  /**
   * Limpia el estado de un overlay específico
   */
  private cleanupOverlayState(window: BrowserWindow): void {
    const state = this.overlayStates.get(window);
    if (state) {
      // Destruir la pantalla
      state.articleScreen?.destroy();

      for (const cleanup of state.boundsCleanupCallbacks) {
        try {
          cleanup();
        } catch (error) {
          logger.error('OverlayManager: Error cleaning up bounds listener', error);
        }
      }
      state.boundsCleanupCallbacks.length = 0;

      if (!state.articleView.webContents.isDestroyed()) {
        window.removeBrowserView(state.articleView);
        state.articleView.webContents.closeDevTools();
      }

      if (!state.timerWindow.isDestroyed()) {
        state.timerWindow.close();
      }

      // Remover del mapa
      this.overlayStates.delete(window);
    }
  }

  /**
   * Destruye el manager y limpia todos los recursos
   */
  public destroy(): void {
    logger.info('OverlayManager: Destroying manager');
    this.hideOverlays();

    // Remover listeners de IPC
    ipcMain.removeAllListeners('break:start');
    ipcMain.removeAllListeners('break:end');
    ipcMain.removeAllListeners('overlay:close-break');
  }

  private createArticleBrowserView(): BrowserView {
    const options: BrowserViewConstructorOptions = {
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    };

    const view = new BrowserView(options);
    view.setBackgroundColor('#000000');
    view.webContents.setAudioMuted(true);
    return view;
  }

  private createTimerWindow(parent: BrowserWindow): BrowserWindow {
    const options: BrowserWindowConstructorOptions = {
      parent,
      width: TIMER_WINDOW_MAX_WIDTH,
      height: TIMER_WINDOW_HEIGHT,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      show: false,
      focusable: true,
      acceptFirstMouse: true,
      hasShadow: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      fullscreenable: false,
      webPreferences: {
        preload: this.overlayUiPreloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        backgroundThrottling: false,
      },
    };

    const child = new BrowserWindow(options);

    child.setBackgroundColor('#00000000');
    child.setAlwaysOnTop(true, 'screen-saver');
    child.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: false });
    child.webContents.setAudioMuted(true);

    return child;
  }

  private configureTimerWindow(state: OverlayState, breakSeconds: number): void {
    const { timerWindow, window } = state;

    timerWindow.setIgnoreMouseEvents(false);
    timerWindow.setAlwaysOnTop(true, 'screen-saver');
    timerWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    timerWindow.setMenuBarVisibility(false);
    timerWindow.setSkipTaskbar(true);

    timerWindow.webContents.once('did-finish-load', () => {
      logger.info('OverlayManager: Timer window finished loading UI');
      timerWindow.webContents.setBackgroundThrottling(false);
      this.markTimerUiReady(state);
      this.sendMessageToTimerUi(state, {
        channel: 'overlay:init',
        payload: { breakSeconds },
      });
    });

    timerWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      logger.error(`OverlayManager: Timer window failed to load (${errorCode}) - ${errorDescription}`);
    });

    timerWindow.loadFile(this.overlayUiHtmlPath, { query: { context: 'timer' } }).catch((error) => {
      logger.error('OverlayManager: Failed to load overlay UI in timer window', error);
    });

    window.once('closed', () => {
      if (!timerWindow.isDestroyed()) {
        timerWindow.close();
      }
    });
  }

  private registerWindowBoundsSync(state: OverlayState): void {
    const resizeSignal = (): void => {
      this.updateOverlayBounds(state);
    };

    state.window.on('resize', resizeSignal);
    state.boundsCleanupCallbacks.push(() => {
      state.window.removeListener('resize', resizeSignal);
    });

    const moveSignal = (): void => {
      this.updateOverlayBounds(state);
    };

    state.window.on('move', moveSignal);
    state.boundsCleanupCallbacks.push(() => {
      state.window.removeListener('move', moveSignal);
    });
  }

  private updateOverlayBounds(state: OverlayState): void {
    const { window, articleView, timerWindow } = state;
    if (window.isDestroyed()) {
      return;
    }

    const bounds = window.getBounds();

    articleView.setBounds({
      x: 0,
      y: 0,
      width: bounds.width,
      height: bounds.height,
    });
    articleView.setAutoResize({ width: true, height: true });

    if (!timerWindow.isDestroyed()) {
      const timerWidth = this.calculateTimerWindowWidth(bounds.width);
      const timerX = Math.max(bounds.x, Math.round(bounds.x + (bounds.width - timerWidth) / 2));
      const timerY = Math.max(bounds.y, bounds.y + bounds.height - TIMER_WINDOW_HEIGHT - TIMER_WINDOW_BOTTOM_MARGIN);

      timerWindow.setBounds({
        x: timerX,
        y: timerY,
        width: timerWidth,
        height: TIMER_WINDOW_HEIGHT,
      });

      if (!timerWindow.isVisible()) {
        timerWindow.showInactive();
      }
    }
  }

  private calculateTimerWindowWidth(windowWidth: number): number {
    const desiredWidth = Math.round(windowWidth * TIMER_WINDOW_WIDTH_RATIO);
    const clampedWidth = Math.max(TIMER_WINDOW_MIN_WIDTH, Math.min(TIMER_WINDOW_MAX_WIDTH, desiredWidth));
    return clampedWidth;
  }

  private markTimerUiReady(state: OverlayState): void {
    state.isUiReady = true;
    this.flushPendingTimerMessages(state);
  }

  private flushPendingTimerMessages(state: OverlayState): void {
    while (state.pendingUiMessages.length > 0) {
      const message = state.pendingUiMessages.shift();
      if (!message) {
        continue;
      }
      try {
        if (!state.timerWindow.isDestroyed()) {
          state.timerWindow.webContents.send(message.channel, message.payload);
        }
      } catch (error) {
        logger.error('OverlayManager: Failed to flush message to timer UI', error);
      }
    }
  }

  private sendMessageToTimerUi(state: OverlayState, message: OverlayUiMessage): void {
    if (!state.isUiReady) {
      state.pendingUiMessages.push(message);
      return;
    }

    try {
      if (!state.timerWindow.isDestroyed()) {
        state.timerWindow.webContents.send(message.channel, message.payload);
      }
    } catch (error) {
      logger.error('OverlayManager: Failed to send message to timer UI', error);
    }
  }
}

