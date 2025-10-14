
type SettingsData = {
  intervalMinutes: number;
  breakSeconds: number;
  startWithWindows: boolean;
};

type ExposeInMainWorldSettings = (_key: string, _api: unknown) => void;

interface ElectronContextBridgeSettings {
  exposeInMainWorld: ExposeInMainWorldSettings;
}

interface ElectronIpcRendererSettings {
  invoke(_channel: 'get-settings'): Promise<SettingsData>;
  invoke(_channel: 'save-settings', _settings: SettingsData): Promise<boolean>;
}

const settingsElectron = require('electron') as {
  contextBridge: ElectronContextBridgeSettings;
  ipcRenderer: ElectronIpcRendererSettings;
};

const settingsContextBridge = settingsElectron.contextBridge;
const settingsIpcRenderer = settingsElectron.ipcRenderer;

settingsContextBridge.exposeInMainWorld('electron', {
  settings: {
    async load(): Promise<SettingsData> {
      return settingsIpcRenderer.invoke('get-settings');
    },
    async save(newSettings: SettingsData): Promise<boolean> {
      return settingsIpcRenderer.invoke('save-settings', newSettings);
    },
  },
});
