
const { app, BrowserWindow } = require("electron");
const path = require("path");

let appWin;

createWindow = () => {
    appWin = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: "Angular and Electron",
        resizable: true,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        }
    });
    
    appWin.loadURL(`file://${__dirname}/dist/browser/index.html`);

    // Interceptar errores de carga para rutas de Angular
    appWin.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.log('Error de carga detectado:', errorDescription);
        console.log('URL que falló:', validatedURL);
        
        // Si la URL contiene rutas de Angular, recargar index.html
        const angularRoutes = ['/login', '/dashboard'];
        const isAngularRoute = angularRoutes.some(route => validatedURL.includes(route));
        
        if (isAngularRoute) {
            console.log('Recargando aplicación para manejar ruta de Angular');
            setTimeout(() => {
                appWin.loadURL(`file://${__dirname}/dist/browser/index.html`);
            }, 100);
        }
    });

    appWin.setMenu(null);

    appWin.webContents.openDevTools();

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