
type OverlayInitMessage = {
  breakSeconds: number;
};

type ArticleLoadedMessage = {
  url: string;
};

type ExposeInMainWorldOverlay = (_key: string, _api: unknown) => void;

interface ElectronContextBridgeOverlay {
  exposeInMainWorld: ExposeInMainWorldOverlay;
}

interface ElectronIpcRendererOverlay {
  send(_channel: 'overlay:log', _message: string): void;
  send(_channel: 'overlay:close-break', _payload: { source: 'pill' | 'timer' }): void;
  send(_channel: 'overlay:ui-ready'): void;
  on(_channel: 'overlay:init', _listener: (_event: unknown, _data: OverlayInitMessage) => void): void;
  on(_channel: 'overlay:article-loaded', _listener: (_event: unknown, _data: ArticleLoadedMessage) => void): void;
  on(_channel: 'overlay:show-now', _listener: (_event: unknown) => void): void;
}

const overlayElectron = require('electron') as {
  contextBridge: ElectronContextBridgeOverlay;
  ipcRenderer: ElectronIpcRendererOverlay;
};

const overlayContextBridge = overlayElectron.contextBridge;
const overlayIpcRenderer = overlayElectron.ipcRenderer;

overlayContextBridge.exposeInMainWorld('electron', {
  overlay: {
    sendLog(message: string): void {
      overlayIpcRenderer.send('overlay:log', message);
    },
    requestCloseBreak(): void {
      overlayIpcRenderer.send('overlay:close-break', { source: 'pill' });
    },
    requestCloseBreakByTimer(): void {
      overlayIpcRenderer.send('overlay:close-break', { source: 'timer' });
    },
    notifyReady(): void {
      overlayIpcRenderer.send('overlay:ui-ready');
    },
    onInit(_listener: (_payload: OverlayInitMessage) => void): void {
      overlayIpcRenderer.on('overlay:init', (event, data) => {
        _listener(data);
      });
    },
    onArticleLoaded(_listener: (_payload: ArticleLoadedMessage) => void): void {
      overlayIpcRenderer.on('overlay:article-loaded', (event, data) => {
        _listener(data);
      });
    },
    onShowNow(_listener: () => void): void {
      overlayIpcRenderer.on('overlay:show-now', () => {
        _listener();
      });
    },
  },
});
