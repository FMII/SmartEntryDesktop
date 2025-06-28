const { app, BrowserWindow } = require('electron');
const path = require('path');
const express = require('express');

let mainWindow;
let server;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'SmartEntryDesktop',
    resizable: false,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Crear servidor Express
  const expressApp = express();

  // Servir archivos estáticos generados por Angular
  expressApp.use(express.static(path.join(__dirname, 'dist', 'browser')));

  // Para cualquier ruta, devolver index.html (para manejar rutas SPA)
  expressApp.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'browser', 'index.html'));
  });

  // Iniciar servidor en puerto 3000
  server = expressApp.listen(3000, () => {
    // Cargar la app Angular desde el servidor local
    mainWindow.loadURL('http://localhost:3000');
  });

  // Opcional: abrir DevTools para debug
  // mainWindow.webContents.openDevTools();
};

app.whenReady().then(createWindow);

// Cerrar servidor y app cuando se cierran todas las ventanas
app.on('window-all-closed', () => {
  if (server) server.close();
  app.quit();
});
