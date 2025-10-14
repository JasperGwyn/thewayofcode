// Script simple para verificar que el overlay se creó
const { app, BrowserWindow, screen, ipcMain } = require('electron');

app.whenReady().then(() => {
  console.log('=== OVERLAY VERIFICATION ===');
  console.log('Displays detected:', screen.getAllDisplays().length);
  screen.getAllDisplays().forEach((display, i) => {
    console.log(`Display ${i + 1}: ${display.bounds.width}x${display.bounds.height} at ${display.bounds.x},${display.bounds.y}`);
  });

  // Simular el evento break:start
  setTimeout(() => {
    console.log('Simulating break:start event...');
    ipcMain.emit('break:start', null, 10); // 10 seconds for testing
  }, 2000);

  // Verificar ventanas después de 5 segundos
  setTimeout(() => {
    const windows = BrowserWindow.getAllWindows();
    console.log(`Total windows: ${windows.length}`);
    windows.forEach((win, i) => {
      console.log(`Window ${i + 1}: visible=${win.isVisible()}, bounds=${JSON.stringify(win.getBounds())}`);
    });
  }, 5000);
});
