import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { logger } from './log.js';

export class SoundManager {
  private audioWindow: BrowserWindow | null = null;
  private isReady: boolean = false;

  private getAssetPath(...segments: string[]): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'app', 'assets', ...segments);
    }
    return path.join(process.cwd(), 'assets', ...segments);
  }

  private async ensureWindow(): Promise<void> {
    if (this.audioWindow && !this.audioWindow.isDestroyed() && this.isReady) {
      return;
    }

    if (!this.audioWindow || this.audioWindow.isDestroyed()) {
      this.audioWindow = new BrowserWindow({
        show: false,
        width: 200,
        height: 100,
        frame: false,
        transparent: true,
        skipTaskbar: true,
        webPreferences: {
          autoplayPolicy: 'no-user-gesture-required',
          contextIsolation: false,
          nodeIntegration: false,
          backgroundThrottling: false,
          webSecurity: false,
        },
      });
      this.audioWindow.on('closed', () => {
        this.audioWindow = null;
        this.isReady = false;
      });
    }

    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>
      <audio id="p" preload="auto"></audio>
      <script>
        (function(){
          const a = document.getElementById('p');
          window.play = (src) => {
            try {
              if (!a) { return false; }
              a.src = src;
              a.currentTime = 0;
              const pr = a.play && a.play();
              if (pr && pr.catch) pr.catch(() => {});
              return true;
            } catch {
              return false;
            }
          };
          window.fallbackBeep = (durationMs = 300, freq = 880) => {
            try {
              const AC = window.AudioContext || window.webkitAudioContext;
              const ac = new AC();
              const osc = ac.createOscillator();
              const gain = ac.createGain();
              osc.type = 'sine';
              osc.frequency.value = freq;
              gain.gain.value = 0.15;
              osc.connect(gain).connect(ac.destination);
              osc.start();
              setTimeout(() => { try { osc.stop(); ac.close(); } catch {} }, durationMs);
              return true;
            } catch {
              return false;
            }
          };
        })();
      </script>
    </body></html>`;

    if (!this.isReady) {
      // Load minimal audio stub in hidden window
      await this.audioWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      this.isReady = true;
      try { this.audioWindow.webContents.setAudioMuted(false); } catch (e) {
        logger.warn('Sound: failed to unmute audio');
      }
    }
  }

  async playEndSound(): Promise<void> {
    try {
      const filePath = this.getAssetPath('sounds', 'end.wav');
      let dataUrl: string | null = null;
      try {
        const buf = await fs.readFile(filePath);
        dataUrl = `data:audio/wav;base64,${buf.toString('base64')}`;
      } catch (fsErr) {
        logger.warn('Sound: end.wav not readable, using fallback beep', fsErr);
      }

      await this.ensureWindow();
      if (this.audioWindow && !this.audioWindow.isDestroyed()) {
        if (dataUrl) {
          const ok: boolean = await this.audioWindow.webContents.executeJavaScript(
            `window.play(${JSON.stringify(dataUrl)})`,
            true
          );
          if (!ok) {
            logger.warn('Sound: playback failed, using fallback beep');
            await this.audioWindow.webContents.executeJavaScript(`window.fallbackBeep()`, true);
          } else {
            logger.info('Sound: end played');
          }
        } else {
          await this.audioWindow.webContents.executeJavaScript(`window.fallbackBeep()`, true);
          logger.info('Sound: fallback beep');
        }
      }
    } catch (error) {
      logger.error('Sound: failed to play end', error);
    }
  }

  destroy(): void {
    try {
      if (this.audioWindow && !this.audioWindow.isDestroyed()) {
        this.audioWindow.destroy();
      }
    } catch (error) {
      logger.warn('SoundManager: Error during destroy()', error);
    }
    this.audioWindow = null;
    this.isReady = false;
  }
}
