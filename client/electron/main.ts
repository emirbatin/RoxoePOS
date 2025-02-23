import { app, BrowserWindow } from 'electron';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import LicenseManager from './license';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, '..');
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

let win: BrowserWindow | null;

new LicenseManager()

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: false,
    icon: path.join(process.env.VITE_PUBLIC, process.platform === 'darwin' ? 'icon.icns' : 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      devTools: !app.isPackaged, // Sadece geliştirme modunda devTools aktif
    },
  });

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }

  // Production modunda güvenlik önlemleri
  if (app.isPackaged) {
    win.webContents.on('context-menu', (event) => {
      event.preventDefault();
    });

    win.webContents.on('before-input-event', (event, input) => {
      if (
        (input.control || input.meta) &&
        (input.key.toLowerCase() === 'i' || input.key.toLowerCase() === 'j' || input.key.toLowerCase() === 'c')
      ) {
        event.preventDefault();
      }
      if (input.key === 'F12') {
        event.preventDefault();
      }
    });
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);