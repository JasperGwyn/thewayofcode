import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');

console.log('=== DEBUG SETTINGS ===');
console.log('app.getPath("userData"):', userDataPath);
console.log('Settings file path:', settingsPath);

// Create clean settings file
const settings = {
  intervalMinutes: 1,
  breakSeconds: 30,
  startWithWindows: false
};

try {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  console.log('✅ Settings file created successfully');
  console.log('Content:', JSON.stringify(settings, null, 2));

  // Verify it can be parsed
  const content = fs.readFileSync(settingsPath, 'utf8');
  const parsed = JSON.parse(content);
  console.log('✅ JSON parsed successfully:', parsed);
} catch (error) {
  console.log('❌ Error:', error.message);
}

app.quit();
