type OverlayInitMessage = {
  breakSeconds: number;
};

type ArticleLoadedMessage = {
  url: string;
};

type ExposeInMainWorld = (_key: string, _api: unknown) => void;

interface ElectronContextBridge {
  exposeInMainWorld: ExposeInMainWorld;
}

interface ElectronIpcRenderer {
  send(_channel: 'overlay:log', _message: string): void;
  send(_channel: 'overlay:close-break', _payload: { source: 'pill' }): void;
  on(_channel: 'overlay:init', _listener: (_event: unknown, _data: OverlayInitMessage) => void): void;
  on(_channel: 'overlay:article-loaded', _listener: (_event: unknown, _data: ArticleLoadedMessage) => void): void;
}

const electronModules = require('electron') as {
  contextBridge: ElectronContextBridge;
  ipcRenderer: ElectronIpcRenderer;
};

const { contextBridge, ipcRenderer } = electronModules;

contextBridge.exposeInMainWorld('electron', {
  overlay: {
    sendLog(message: string): void {
      ipcRenderer.send('overlay:log', message);
    },
    requestCloseBreak(): void {
      ipcRenderer.send('overlay:close-break', { source: 'pill' });
    },
    onInit(_listener: (_payload: OverlayInitMessage) => void): void {
      ipcRenderer.on('overlay:init', (event, data) => {
        _listener(data);
      });
    },
    onArticleLoaded(_listener: (_payload: ArticleLoadedMessage) => void): void {
      ipcRenderer.on('overlay:article-loaded', (event, data) => {
        _listener(data);
      });
    },
  },
});
