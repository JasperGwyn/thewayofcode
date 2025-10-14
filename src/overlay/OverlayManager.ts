import { BrowserWindow, screen, ipcMain } from 'electron';
import { logger } from '../log.js';
import { createOverlayWindow } from './createOverlayWindow.js';

/**
 * Gestiona las ventanas de overlay que se muestran durante los breaks.
 * Crea una ventana por cada monitor conectado.
 */
export class OverlayManager {
  private overlayWindows: BrowserWindow[] = [];
  private isActive: boolean = false;

  constructor() {
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
  public showOverlays(breakSeconds: number): void {
    if (this.isActive) {
      logger.warn('OverlayManager: Overlays already active, skipping');
      return;
    }

    this.isActive = true;
    logger.info('OverlayManager: Showing overlays on all displays');

    try {
      // Obtener todos los displays conectados
      const displays = screen.getAllDisplays();

      // Crear una ventana overlay por cada display
      for (const display of displays) {
        const overlayWindow = createOverlayWindow(display, breakSeconds);
        this.overlayWindows.push(overlayWindow);

        // Manejar cierre de ventana individual
        overlayWindow.on('closed', () => {
          logger.info(`OverlayManager: Overlay window closed for display ${display.id}`);
          // Nota: La limpieza de la lista se hace en hideOverlays() para evitar race conditions
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
}
