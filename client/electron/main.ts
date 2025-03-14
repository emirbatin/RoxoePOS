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

// Sessiz güncelleme yapılandırması
autoUpdater.allowDowngrade = false;
autoUpdater.allowPrerelease = false;

// Güncelleme durumu takibi
let isUpdating = false;
let updateSplashWindow: BrowserWindow | null = null;

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

// Güncelleme yükleme ekranını oluştur
function createUpdateSplash() {
  // Yeni bir pencere oluştur, sadece güncelleme durumu için
  updateSplashWindow = new BrowserWindow({
    width: 400,
    height: 200,
    frame: false,
    resizable: false,
    center: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // HTML içeriği oluştur
  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Güncelleniyor</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f5f5f5;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
        color: #333;
      }
      
      .container {
        text-align: center;
        padding: 20px;
      }
      
      h2 {
        margin-bottom: 20px;
      }
      
      .loader {
        border: 5px solid #f3f3f3;
        border-top: 5px solid #3498db;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        animation: spin 2s linear infinite;
        margin: 0 auto 20px;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="loader"></div>
      <h2>RoxoePOS Güncelleniyor</h2>
      <p>Lütfen bekleyin, uygulama güncelleniyor...</p>
    </div>
  </body>
  </html>
  `;

  // HTML içeriğini yükle
  if (updateSplashWindow) {
    updateSplashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    // Pencereyi göster
    updateSplashWindow.once('ready-to-show', () => {
      if (updateSplashWindow) {
        updateSplashWindow.show();
      }
    });
  }
}

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

let lastProgressTime = Date.now();
let lastProgressBytes = 0;
let downloadSpeed = 0;


autoUpdater.on('checking-for-update', () => {
  log.info('Güncellemeler kontrol ediliyor...');
  if (win) {
    win.webContents.send('update-status', { status: 'checking' });
  }
});

autoUpdater.on('update-available', (info) => {
  log.info('Güncelleme mevcut:', info);
  if (win) {
    win.webContents.send('update-available', info);
    win.webContents.send('update-status', { 
      status: 'available', 
      version: info.version 
    });
    
    dialog.showMessageBox({
      type: 'info',
      title: 'Güncelleme Mevcut',
      message: `Yeni sürüm (${info.version}) mevcut. İndiriliyor...`,
      buttons: ['Tamam']
    });
  }
  
  // İlerleme takibi için değişkenleri sıfırlayalım
  lastProgressTime = Date.now();
  lastProgressBytes = 0;
  downloadSpeed = 0;
});

autoUpdater.on('download-progress', (progressObj) => {
  const currentTime = Date.now();
  const elapsedTime = (currentTime - lastProgressTime) / 1000; // saniye cinsinden
  
  // Eğer yeterli zaman geçtiyse indirme hızını hesapla (titreşimi önlemek için)
  if (elapsedTime > 0.5) {
    const bytesPerSecond = (progressObj.transferred - lastProgressBytes) / elapsedTime;
    downloadSpeed = bytesPerSecond / (1024 * 1024); // MB/s cinsinden
    
    lastProgressTime = currentTime;
    lastProgressBytes = progressObj.transferred;
  }
  
  // İlerleme detaylarını gönder
  const progressDetails = {
    percent: progressObj.percent || 0,
    transferred: progressObj.transferred || 0,
    total: progressObj.total || 0,
    speed: downloadSpeed.toFixed(2), // MB/s
    remaining: (progressObj.total - progressObj.transferred) || 0
  };
  
  log.info(`İndirme ilerlemesi: ${progressDetails.percent.toFixed(1)}%, ${progressDetails.speed} MB/s`);
  
  if (win) {
    win.webContents.send('update-progress', progressDetails);
    win.webContents.send('update-status', { 
      status: 'downloading', 
      progress: progressDetails 
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Güncelleme indirildi:', info);
  if (win) {
    win.webContents.send('update-downloaded', info);
    win.webContents.send('update-status', { 
      status: 'downloaded', 
      version: info.version 
    });
    
    dialog.showMessageBox({
      type: 'info',
      title: 'Güncelleme Hazır',
      message: `Yeni sürüm (${info.version}) indirildi. Uygulamayı yeniden başlatarak güncellemeleri yükleyebilirsiniz.`,
      buttons: ['Şimdi Güncelle', 'Daha Sonra'],
      defaultId: 0
    }).then((returnValue) => {
      if (returnValue.response === 0) {
        // Güncelleme durumunu işaretle
        isUpdating = true;
        
        // Güncelleme splash ekranı göster
        createUpdateSplash();
        
        // Ana pencereyi gizle
        if (win) {
          win.hide();
        }
        
        // Kısa bir gecikme sonra güncelleme işlemini başlat
        setTimeout(() => {
          // Sessiz modda güncelleme başlat (yeniden başlatır, sessiz mod)
          autoUpdater.quitAndInstall(false, true);
        }, 1000);
      }
    });
  }
});

autoUpdater.on('error', (err) => {
  log.error('Güncelleme hatası:', err);
  if (win) {
    win.webContents.send('update-error', err);
    win.webContents.send('update-status', { 
      status: 'error', 
      error: err.message 
    });
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

// Güncellemeyi uygulama ve yeniden başlatma
ipcMain.on('quit-and-install', () => {
  log.info('Kullanıcı güncelleme ve yeniden başlatma talep etti');
  
  // Güncelleme durumunu işaretle
  isUpdating = true;
  
  // Güncelleme splash ekranı göster
  createUpdateSplash();
  
  // Ana pencereyi gizle
  if (win) {
    win.hide();
  }
  
  // Kısa bir gecikme sonra güncelleme işlemini başlat
  setTimeout(() => {
    autoUpdater.quitAndInstall(false, true);
  }, 1000);
});

// Periyodik güncelleme kontrolü (her 4 saatte bir)
setInterval(() => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
    log.info('Periyodik güncelleme kontrolü yapılıyor...');
  }
}, 4 * 60 * 60 * 1000);

// Uygulama kapatılmadan önce kontrol et
app.on('before-quit', (event) => {
  // Eğer güncelleme sürecindeyse, normal kapanma işlemini engelle
  if (isUpdating && updateSplashWindow && !updateSplashWindow.isDestroyed()) {
    event.preventDefault();
  }
});

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