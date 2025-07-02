
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
            webSecurity: false 
        }
    });
    
    const indexPath = `file://${__dirname}/dist/browser/index.html`;
    appWin.loadURL(indexPath);

    appWin.webContents.on('will-navigate', (event, navigationUrl) => {
        if (navigationUrl !== indexPath) {
            console.log('Navegación interceptada y cancelada:', navigationUrl);
            event.preventDefault();
        }
    });

    appWin.webContents.setWindowOpenHandler(({ url }) => {
        console.log('Intento de abrir nueva ventana interceptado:', url);
        return { action: 'deny' };
    });

    appWin.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.log('Info de carga:', { errorCode, errorDescription, validatedURL });
    });

    appWin.setMenu(null);

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