import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const settings = {
  intervalMinutes: 45,
  breakSeconds: 300,
  startWithWindows: false
};

const settingsPath = path.join(process.env.APPDATA || '', 'Electron', 'settings.json');
const dir = path.dirname(settingsPath);

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
console.log('Settings created at:', settingsPath);
console.log('Content:', JSON.stringify(settings, null, 2));
