import { app, BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { logger } from '../log.js';
import { createOverlayWindow } from './createOverlayWindow.js';
import { pickRandomArticle, getFallbackArticle, type PickedArticle } from '../articles/ArticlePicker.js';
import { SoundManager } from '../sound.js';

// Google Cloud TTS imports
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { protos } from '@google-cloud/text-to-speech';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const resolveTtsKeyPath = (): string => {
  const fileName = 'the-way-of-code-a39c1f8438eb.json';
  const candidates: string[] = [];

  if (app.isPackaged) {
    candidates.push(
      path.join(process.resourcesPath, 'app', 'keys', fileName),
      path.join(process.resourcesPath, 'keys', fileName),
      path.join(process.cwd(), 'resources', 'app', 'keys', fileName)
    );
  } else {
    candidates.push(
      path.join(process.cwd(), 'keys', fileName),
      path.join(process.cwd(), 'dist', 'keys', fileName)
    );
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      logger.info(`OverlayManager: TTS key file resolved to ${candidate}`);
      return candidate;
    }
  }

  const fallback = path.join(process.cwd(), 'keys', fileName);
  logger.warn(`OverlayManager: TTS key file not found in packaged paths, falling back to ${fallback}`);
  return fallback;
};

// Google Cloud TTS client and voices
const gcpTtsClient = new TextToSpeechClient({
  keyFilename: resolveTtsKeyPath()
});

// Available Chirp3-HD voices for English
const chirp3Voices = [
  { name: 'en-US-Chirp3-HD-Achernar', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Achird', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Algenib', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Algieba', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Alnilam', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Aoede', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Autonoe', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Callirrhoe', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Charon', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Despina', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Enceladus', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Erinome', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Fenrir', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Gacrux', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Iapetus', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Kore', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Laomedeia', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Leda', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Orus', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Pulcherrima', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Puck', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Rasalgethi', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Sadachbia', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Sadaltager', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Schedar', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Sulafat', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Umbriel', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Vindemiatrix', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Zephyr', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Zubenelgenubi', gender: 'Male' }
];

// Function to get random Chirp3-HD voice
function getRandomChirp3Voice() {
  const randomIndex = Math.floor(Math.random() * chirp3Voices.length);
  return chirp3Voices[randomIndex];
}

// Helper functions for Google TTS
function sanitizeTextForGoogleTts(text: string): string {
  return text
    .replace(/\s+/g, ' ') // collapse whitespace (including newlines)
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width chars
    .trim();
}

function splitText(text: string, maxLength = 180): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const word of words) {
    if (word.length === 0) {
      continue;
    }
    if ((currentChunk + ' ' + word).trim().length <= maxLength) {
      currentChunk += (currentChunk ? ' ' : '') + word;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = word;
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

type PoemChapter = {
  number: number;
  content: string;
};

type PoemsJson = {
  chapters?: PoemChapter[];
};

type OverlayInitUiPayload = {
  breakSeconds: number;
  ttsEnabled: boolean;
};

type OverlayArticleLoadedUiPayload = {
  url: string;
  articleId: number;
};

type OverlayUiMessage =
  | { channel: 'overlay:init'; payload: OverlayInitUiPayload }
  | { channel: 'overlay:article-loaded'; payload: OverlayArticleLoadedUiPayload }
  | { channel: 'overlay:show-now'; payload: Record<string, never> };

type OverlayState = {
  window: BrowserWindow;
  isUiReady: boolean;
  pendingUiMessages: OverlayUiMessage[];
  currentArticle: PickedArticle | null;
  allowClose: boolean;
  displayId: number;
};

type OverlayTtsSpeakPayload = {
  text?: string;
  lang?: string; // e.g., 'en-US'
  poemChapter?: number;
};

export class OverlayManager {
  private overlayWindows: BrowserWindow[] = [];
  private overlayStates: Map<BrowserWindow, OverlayState> = new Map();
  private isActive: boolean = false;
  private readonly overlayUiHtmlPath: string;
  private readonly overlayUiPreloadPath: string;
  private readonly preloadDelayMs: number = 3000;
  private minShowAtMs: number = 0;
  private currentTtsAudioFile: string | null = null;
  private poemsCache: PoemsJson | null = null;
  private poemIndex: number = 0;
  private readonly soundManager: SoundManager;
  private ttsEnabled: boolean = true; // Default habilitado, se actualiza cuando se muestra el overlay

  constructor() {
    this.overlayUiHtmlPath = path.join(__dirname, 'ui', 'index.html');
    this.overlayUiPreloadPath = path.join(__dirname, 'ui', 'preload.js');
    this.soundManager = new SoundManager();
    this.setupIpcListeners();
  }

  private setupIpcListeners(): void {
    logger.info('OverlayManager: Setting up IPC listeners');

    ipcMain.on('break:start', (_event, breakSeconds: number, ttsEnabled: boolean) => {
      logger.info(`OverlayManager: break:start received, duration: ${breakSeconds}s, ttsEnabled: ${ttsEnabled}`);
      this.ttsEnabled = ttsEnabled;
      this.showOverlays(breakSeconds, ttsEnabled);
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

    ipcMain.on('overlay:ui-ready', (_event) => {
      const srcWin = BrowserWindow.fromWebContents(_event.sender);
      const srcId = srcWin ? srcWin.id : -1;
      logger.info(`OverlayManager: overlay:ui-ready received from winId=${srcId}`);
      if (srcWin && !srcWin.isDestroyed()) {
        try {
          // Mostrar cuando se cumpla el delay mínimo y la UI esté lista
          const delay = Math.max(0, this.minShowAtMs - Date.now());
          setTimeout(() => {
            try {
              if (srcWin.isDestroyed()) return;
              srcWin.show();
              try { srcWin.setOpacity(1); } catch (error) {
                logger.warn('OverlayManager: setOpacity(1) failed', error);
              }
              const state = this.overlayStates.get(srcWin);
              if (state) {
                // Avisar al renderer que puede iniciar el contador
                this.sendMessageToOverlayUi(state, { channel: 'overlay:show-now', payload: {} });
              }
            } catch (err) {
              logger.error('OverlayManager: Failed to show window after delay', err);
            }
          }, delay);
        } catch (e) {
          logger.error('OverlayManager: Failed to prepare delayed show after ui-ready', e);
        }
      }
    });

    // TTS: speak using Google Translate TTS (free)
    ipcMain.on('overlay:tts-speak', async (_event, payload: OverlayTtsSpeakPayload) => {
      try {
        if (!this.ttsEnabled) {
          logger.info('OverlayManager: TTS está desactivado, ignorando solicitud de speak');
          return;
        }
        const text = payload?.text ? (payload.text).toString() : undefined;
        const lang = (payload?.lang ?? 'en').toString();
        const poemChapter = typeof payload?.poemChapter === 'number' && Number.isFinite(payload.poemChapter)
          ? Math.max(1, Math.floor(payload.poemChapter))
          : undefined;
        const trimmedText = text ? text.trim() : '';
        this.stopGoogleTts();
        await this.speakWithGoogleTts(trimmedText, lang, poemChapter);
      } catch (error) {
        logger.error('OverlayManager: TTS speak failed', error);
      }
    });

    ipcMain.on('overlay:tts-stop', () => {
      try {
        this.stopGoogleTts();
        logger.info('OverlayManager: TTS stop requested');
      } catch (error) {
        logger.error('OverlayManager: TTS stop failed', error);
      }
    });
  }

  public async showOverlays(breakSeconds: number, ttsEnabled: boolean): Promise<void> {
    if (this.isActive) {
      logger.warn('OverlayManager: Overlays already active, skipping');
      return;
    }

    this.ttsEnabled = ttsEnabled;
    this.isActive = true;
    logger.info('OverlayManager: Showing overlays on all displays');
    this.minShowAtMs = Date.now() + this.preloadDelayMs;

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
        this.sendMessageToOverlayUi(overlayState, { channel: 'overlay:init', payload: { breakSeconds, ttsEnabled } });
        this.sendMessageToOverlayUi(overlayState, {
          channel: 'overlay:article-loaded',
          payload: { url: article.url, articleId: article.id },
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
    this.stopGoogleTts();

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
            try { window.setOpacity(0); } catch (error) {
              logger.warn('OverlayManager: setOpacity(0) failed', error);
            }
            window.close();
          }
        } catch (error) {
          clearInterval(interval);
          try { window.close(); } catch (closeError) {
            logger.warn('OverlayManager: window.close() failed during fade', closeError);
          }
        }
      }, 16);
    } catch (error) {
      try { window.close(); } catch (closeError) {
        logger.warn('OverlayManager: window.close() failed (outer)', closeError);
      }
    }
  }

  private async speakWithGoogleTts(_text: string, lang: string, poemChapter?: number): Promise<void> {
    try {
      const poemText = this.getPoemByChapter(poemChapter);

      if (!poemText) {
        logger.warn('OverlayManager: no se encontró poema para TTS');
        return;
      }

      // Get random Chirp3-HD voice for each playback
      const selectedVoice = getRandomChirp3Voice();
      if (!selectedVoice) {
        logger.error('OverlayManager: No Chirp3-HD voice available');
        return;
      }

      const starName = selectedVoice.name.replace('en-US-Chirp3-HD-', '');

      logger.info(`TTS_DEBUG poemChapter=${poemChapter ?? 'auto'} length=${poemText.length} voice=${starName} (${selectedVoice.gender})`);

      // Usar chunks grandes (5000 chars = límite de Google Cloud TTS)
      // Para textos cortos como poems, usualmente resulta en 1 solo chunk
      const chunks = splitText(poemText, 5000);
      const audioBuffers: Buffer[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk) continue;

        logger.info(`TTS_DEBUG chunk ${i + 1}/${chunks.length}: "${chunk.substring(0, 50)}${chunk.length > 50 ? '…' : ''}"`);

        try {
          const request = {
            input: { text: chunk },
            voice: {
              languageCode: 'en-US',
              name: selectedVoice.name,
            },
            audioConfig: {
              audioEncoding: protos.google.cloud.texttospeech.v1.AudioEncoding.LINEAR16,
              speakingRate: 1.0,
              pitch: 0.0,
            },
          };

          const response = await gcpTtsClient.synthesizeSpeech(request);
          if (response && response[0] && response[0].audioContent) {
            const audioContent = Buffer.from(response[0].audioContent);
            audioBuffers.push(audioContent);
          }
        } catch (error) {
          logger.warn(`TTS_DEBUG chunkError=${(error as Error).message}`);
        }

        // Pausa entre chunks para no sobrecargar la API
        if (chunks.length > 1 && i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      if (audioBuffers.length === 0) {
        logger.warn('TTS_DEBUG noChunksSynthesized');
        return;
      }

      const combinedBuffer = Buffer.concat(audioBuffers);
      await this.soundManager.playAudioBuffer(combinedBuffer, 'audio/wav');
      logger.info(`TTS_DEBUG audioBufferDurationChunks=${audioBuffers.length} voice=${starName}`);

    } catch (error) {
      logger.error('OverlayManager: Failed to synthesize Google Cloud TTS', error);
    }
  }

  private stopGoogleTts(): void {
    void this.soundManager.stopAudio();
  }

  private resolvePoemsPath(): string {
    const fileName = 'poems.json';
    const subPath = path.join('assets', 'poems', fileName);

    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'app', subPath);
    }
    return path.join(process.cwd(), subPath);
  }

  private loadPoemsJson(): PoemsJson {
    if (this.poemsCache) {
      return this.poemsCache;
    }

    const jsonPath = this.resolvePoemsPath();

    try {
      const raw = readFileSync(jsonPath, 'utf-8');
      const parsed = JSON.parse(raw) as PoemsJson;
      this.poemsCache = parsed;
      logger.info(`OverlayManager: poems.json cargado (${parsed.chapters?.length ?? 0} capítulos)`);
      return parsed;
    } catch (error) {
      logger.error(`OverlayManager: no se pudo leer ${jsonPath}`, error);
      this.poemsCache = { chapters: [] };
      return this.poemsCache;
    }
  }

  private getPoemByChapter(requestedChapter?: number): string {
    const poems = this.loadPoemsJson();
    const chapters = poems.chapters ?? [];

    if (chapters.length === 0) {
      logger.warn('OverlayManager: poems.json no contiene capítulos');
      return '';
    }

    let chapter: PoemChapter | undefined;

    if (requestedChapter) {
      chapter = chapters.find(item => item.number === requestedChapter);
      if (!chapter) {
        logger.warn(`OverlayManager: capítulo ${requestedChapter} no encontrado en poems.json; usando secuencia`);
      }
    }

    if (!chapter) {
      chapter = chapters[this.poemIndex % chapters.length];
      this.poemIndex = (this.poemIndex + 1) % chapters.length;
    }

    const content = chapter?.content ?? '';
    const sanitized = sanitizeTextForGoogleTts(content);
    logger.info(`TTS_DEBUG selectedPoemChapter=${chapter?.number ?? 'desconocido'} sanitizedLength=${sanitized.length}`);
    return sanitized;
  }
}
