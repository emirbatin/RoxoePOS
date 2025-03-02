import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import LicenseManager from './license';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

// Log ayarları
log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// GitHub token ayarları - private repo veya API rate limit aşımı durumlarında gerekli
// Bu token'ı bir ortam değişkeni olarak (process.env.GH_TOKEN) ayarlamanız güvenlik için önemlidir
const githubToken = process.env.GH_TOKEN;

if (githubToken) {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'emirbatin',
    repo: 'RoxoePOS',
    token: githubToken
  });
  log.info('GitHub token ile güncelleme ayarları yapılandırıldı');
} else {
  log.info('GitHub token bulunamadı, varsayılan güncelleme ayarları kullanılıyor');
}

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
    
    // Uygulamanın yüklenmesi tamamlandığında güncelleme kontrolü yap
    if (app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify();
      log.info('Güncelleme kontrolü başlatıldı...');
    }
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
          {
            label: 'Check for Updates',
            click: () => {
              autoUpdater.checkForUpdatesAndNotify();
            }
          }
        ],
      },
    ]);
    Menu.setApplicationMenu(menu);
  } else {
    // Üretim modunda menüyü gizle
    Menu.setApplicationMenu(null);
  }
}

// Güncelleme event'leri
autoUpdater.on('update-available', (info) => {
  log.info('Güncelleme mevcut:', info);
  if (win) {
    win.webContents.send('update-available', info);
    
    dialog.showMessageBox({
      type: 'info',
      title: 'Güncelleme Mevcut',
      message: `Yeni sürüm (${info.version}) mevcut. İndiriliyor...`,
      buttons: ['Tamam']
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Güncelleme indirildi:', info);
  if (win) {
    win.webContents.send('update-downloaded', info);
    
    dialog.showMessageBox({
      type: 'info',
      title: 'Güncelleme Hazır',
      message: `Yeni sürüm (${info.version}) indirildi. Uygulamayı yeniden başlatarak güncellemeleri yükleyebilirsiniz.`,
      buttons: ['Şimdi Yeniden Başlat', 'Daha Sonra'],
      defaultId: 0
    }).then((returnValue) => {
      if (returnValue.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  }
});

autoUpdater.on('error', (err) => {
  log.error('Güncelleme hatası:', err);
  if (win) {
    win.webContents.send('update-error', err);
  }
});

// Manuel güncelleme kontrolü için IPC
ipcMain.on('check-for-updates', () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  } else {
    log.info('Geliştirme modunda güncelleme kontrolü atlandı.');
    win?.webContents.send('update-message', 'Geliştirme modunda güncelleme kontrolü atlandı.');
  }
});

// Periyodik güncelleme kontrolü (her 4 saatte bir)
setInterval(() => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
    log.info('Periyodik güncelleme kontrolü yapılıyor...');
  }
}, 4 * 60 * 60 * 1000);

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