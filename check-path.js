import { app } from 'electron';
import path from 'path';

console.log('=== RUTA CORRECTA PARA SETTINGS ===');
console.log('app.getPath("userData"):', app.getPath('userData'));
console.log('Ruta completa del settings.json:', path.join(app.getPath('userData'), 'settings.json'));
console.log('====================================');

app.quit();
