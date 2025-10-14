type AppSettings = {
  intervalMinutes: number;
  breakSeconds: number;
  startWithWindows: boolean;
};

type SettingsApi = {
  load: () => Promise<AppSettings>;
  save: (_settings: AppSettings) => Promise<boolean>;
};

interface SettingsWindow extends Window {
  electron?: { settings?: SettingsApi };
}

function getApi(): SettingsApi {
  const api = (window as SettingsWindow).electron?.settings;
  if (!api) {
    throw new Error('Settings UI: API not available');
  }
  return api;
}

const intervalInput = document.getElementById('interval') as HTMLInputElement | null;
const breakInput = document.getElementById('break') as HTMLInputElement | null;
const autostartInput = document.getElementById('autostart') as HTMLInputElement | null;
const form = document.getElementById('settings-form') as HTMLFormElement | null;
const cancelBtn = document.getElementById('cancel') as HTMLButtonElement | null;
const errorEl = document.getElementById('error') as HTMLParagraphElement | null;

function setError(message: string): void {
  if (errorEl) errorEl.textContent = message;
}

function fillForm(settings: AppSettings): void {
  if (!intervalInput || !breakInput || !autostartInput) return;
  intervalInput.value = String(settings.intervalMinutes);
  breakInput.value = String(settings.breakSeconds);
  autostartInput.checked = settings.startWithWindows;
}

function parseForm(): AppSettings | null {
  if (!intervalInput || !breakInput || !autostartInput) return null;
  const interval = Number(intervalInput.value);
  const brk = Number(breakInput.value);
  const startWithWindows = autostartInput.checked;

  if (!Number.isFinite(interval) || interval <= 0) {
    setError('Interval must be a positive number');
    return null;
  }
  if (!Number.isFinite(brk) || brk <= 0) {
    setError('Break duration must be a positive number');
    return null;
  }

  return { intervalMinutes: Math.round(interval), breakSeconds: Math.round(brk), startWithWindows };
}

async function bootstrap(): Promise<void> {
  try {
    const api = getApi();
    const settings = await api.load();
    fillForm(settings);
  } catch {
    setError('Failed to load settings');
  }
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setError('');
    const data = parseForm();
    if (!data) return;
    try {
      const ok = await getApi().save(data);
      if (ok) {
        window.close();
      } else {
        setError('Failed to save settings');
      }
    } catch {
      setError('Error saving settings');
    }
  });
}

if (cancelBtn) {
  cancelBtn.addEventListener('click', () => window.close());
}

document.addEventListener('DOMContentLoaded', () => { void bootstrap(); });

