
const { app, BrowserWindow } = require("electron");
const path = require("path");

let appWin;

createWindow = () => {
    appWin = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: "SmartEntry Desktop",
        resizable: true,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false // Permitir requests a localhost
        }
    });
    
    // Cargar SIEMPRE index.html - Angular maneja las rutas internamente
    const indexPath = `file://${__dirname}/dist/browser/index.html`;
    appWin.loadURL(indexPath);

    // CRÍTICO: Interceptar CUALQUIER navegación que no sea la página inicial
    appWin.webContents.on('will-navigate', (event, navigationUrl) => {
        // Si Electron intenta navegar a cualquier otra URL, PREVENIRLO
        if (navigationUrl !== indexPath) {
            console.log('Navegación interceptada y cancelada:', navigationUrl);
            event.preventDefault();
            // NO recargar nada - dejar que Angular maneje internamente
        }
    });

    // Interceptar intentos de abrir nuevas ventanas
    appWin.webContents.setWindowOpenHandler(({ url }) => {
        console.log('Intento de abrir nueva ventana interceptado:', url);
        return { action: 'deny' };
    });

    // Log de errores pero SIN tomar acciones
    appWin.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.log('Info de carga:', { errorCode, errorDescription, validatedURL });
        // NO hacer nada más
    });

    appWin.setMenu(null);

    // Solo DevTools en desarrollo
    if (process.env.NODE_ENV === 'development') {
        appWin.webContents.openDevTools();
    }

    appWin.on("closed", () => {
        appWin = null;
    });
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
});