import { app, BrowserWindow, Menu } from 'electron';
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
new LicenseManager();

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: false,
    icon: path.join(process.env.VITE_PUBLIC, process.platform === 'darwin' ? 'icon.icns' : 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      devTools: !app.isPackaged, // Sadece geliştirme modunda devTools'u etkinleştir
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

  // DevTools'u sadece geliştirme modunda aç
  if (!app.isPackaged) {
    win.webContents.once('did-finish-load', () => {
      win?.webContents.openDevTools();
    });
  }

  // Menüyü sadece geliştirme modunda göster
  if (!app.isPackaged) {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Developer',
        submenu: [
          {
            label: 'Toggle DevTools',
            accelerator: 'Ctrl+Shift+I',
            click: () => {
              win?.webContents.toggleDevTools();
            },
          },
        ],
      },
    ]);
    Menu.setApplicationMenu(menu);
  } else {
    // Üretim modunda menüyü gizle
    Menu.setApplicationMenu(null);
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

app.whenReady().then(() => {
  // Debug portunu sadece geliştirme modunda aç
  if (!app.isPackaged) {
    app.commandLine.appendSwitch('remote-debugging-port', '9222');
  }
  createWindow();
});