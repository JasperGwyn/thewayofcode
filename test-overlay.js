// Script simple para probar el overlay manualmente
const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  console.log('Displays:', screen.getAllDisplays().map(d => `${d.id}: ${d.bounds.width}x${d.bounds.height}`));

  // Crear una ventana de prueba
  const testWindow = new BrowserWindow({
    x: 100,
    y: 100,
    width: 400,
    height: 300,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  testWindow.loadURL(`data:text/html,
    <html>
      <body>
        <h1>Test Overlay</h1>
        <button onclick="require('electron').ipcRenderer.send('test:trigger-overlay')">Trigger Overlay</button>
        <script>
          require('electron').ipcRenderer.on('overlay:created', () => {
            document.body.innerHTML += '<p>Overlay created!</p>';
          });
        </script>
      </body>
    </html>
  `);

  console.log('Test window created');
});
