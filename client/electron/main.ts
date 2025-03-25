import { app, BrowserWindow, Menu, dialog, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import LicenseManager from "./license";
import { autoUpdater } from "electron-updater";
import log from "electron-log";
import { backupManager, FileUtils } from "../src/backup";
import fs from 'fs';

// Log ayarları
log.transports.file.level = "info";
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Sessiz güncelleme yapılandırması
autoUpdater.allowDowngrade = false;
autoUpdater.allowPrerelease = false;
autoUpdater.forceDevUpdateConfig = true;  // Geliştirme yapılandırması kullan

// Güncelleme durumu takibi
let isUpdating = false;
let updateSplashWindow: BrowserWindow | null = null;

// GitHub token ayarları
const githubToken = process.env.GH_TOKEN;

if (githubToken) {
  autoUpdater.setFeedURL({
    provider: "github",
    owner: "emirbatin",
    repo: "RoxoePOS",
    token: githubToken,
  });
  log.info("GitHub token ile güncelleme ayarları yapılandırıldı");
} else {
  log.info(
    "GitHub token bulunamadı, varsayılan güncelleme ayarları kullanılıyor"
  );
}

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;
let win: BrowserWindow | null;

new LicenseManager();

// Pencere başlığını güncellemek için IPC dinleyicisi
ipcMain.on("update-window-title", (_, newTitle) => {
  if (win && !win.isDestroyed()) {
    win.setTitle(newTitle);
    log.info(`Pencere başlığı güncellendi: ${newTitle}`);
  }
});

// Güncelleme yükleme ekranını oluştur
function createUpdateSplash() {
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

  if (updateSplashWindow) {
    updateSplashWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`
    );

    updateSplashWindow.once("ready-to-show", () => {
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
    icon: path.join(
      process.env.VITE_PUBLIC,
      process.platform === "darwin" ? "icon.icns" : "icon.ico"
    ),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      devTools: !app.isPackaged,
    },
  });

  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());

    if (app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify();
      log.info("Güncelleme kontrolü başlatıldı...");
    }
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

  if (!app.isPackaged) {
    win.webContents.once("did-finish-load", () => {
      win?.webContents.openDevTools();
    });
  }

  if (!app.isPackaged) {
    const menu = Menu.buildFromTemplate([
      {
        label: "Developer",
        submenu: [
          {
            label: "Toggle DevTools",
            accelerator: "Ctrl+Shift+I",
            click: () => {
              win?.webContents.toggleDevTools();
            },
          },
          {
            label: "Check for Updates",
            click: () => {
              autoUpdater.checkForUpdatesAndNotify();
            },
          },
          {
            label: "Create Backup",
            click: () => {
              if (win) {
                win.webContents.send("trigger-backup", {
                  description: "Manuel Geliştirici Yedeklemesi",
                });
              }
            },
          },
        ],
      },
    ]);
    Menu.setApplicationMenu(menu);
  } else {
    Menu.setApplicationMenu(null);
  }
}

let lastProgressTime = Date.now();
let lastProgressBytes = 0;
let downloadSpeed = 0;

// Güncelleme olayları
autoUpdater.on("checking-for-update", () => {
  log.info("Güncellemeler kontrol ediliyor...");
  if (win) {
    win.webContents.send("update-status", { status: "checking" });
  }
});

autoUpdater.on("update-available", (info) => {
  log.info("Güncelleme mevcut:", info);
  if (win) {
    win.webContents.send("update-available", info);
    win.webContents.send("update-status", {
      status: "available",
      version: info.version,
    });

    // Kullanıcıya sadece bildirim göster, dialog gösterme
    log.info(`Yeni sürüm (${info.version}) mevcut. İndiriliyor...`);
    
    // 1.5 saniye sonra indirme durumuna geçiş yap
    setTimeout(() => {
      win?.webContents.send("update-status", {
        status: "downloading",
        version: info.version,
        progress: {
          percent: 0,
          transferred: 0,
          total: 100,
          speed: "0.00",
          remaining: 100
        }
      });
    }, 1500);
  }

  lastProgressTime = Date.now();
  lastProgressBytes = 0;
  downloadSpeed = 0;
});

autoUpdater.on("download-progress", (progressObj) => {
  const currentTime = Date.now();
  const elapsedTime = (currentTime - lastProgressTime) / 1000;

  if (elapsedTime > 0.5) {
    const bytesPerSecond =
      (progressObj.transferred - lastProgressBytes) / elapsedTime;
    downloadSpeed = bytesPerSecond / (1024 * 1024);

    lastProgressTime = currentTime;
    lastProgressBytes = progressObj.transferred;
  }

  const progressDetails = {
    percent: progressObj.percent || 0,
    transferred: progressObj.transferred || 0,
    total: progressObj.total || 0,
    speed: downloadSpeed.toFixed(2),
    remaining: progressObj.total - progressObj.transferred || 0,
  };

  log.info(
    `İndirme ilerlemesi: ${progressDetails.percent.toFixed(1)}%, ${
      progressDetails.speed
    } MB/s`
  );

  if (win) {
    win.webContents.send("update-progress", progressDetails);
    win.webContents.send("update-status", {
      status: "downloading",
      progress: progressDetails,
      version: autoUpdater.currentVersion?.version
    });
  }
});

autoUpdater.on("update-downloaded", (info) => {
  log.info("Güncelleme indirildi:", info);
  if (win) {
    win.webContents.send("update-downloaded", info);
    win.webContents.send("update-status", {
      status: "downloaded",
      version: info.version,
    });
    
    // Kullanıcıya bildirim gönder
    log.info(`Yeni sürüm (${info.version}) indirildi. Kullanıcıya bildirim gönderildi.`);
    
    // Opsiyonel: Otomatik güncelleme yapmak için aşağıdaki kodu etkinleştirin
    // setTimeout(() => {
    //   log.info("Otomatik güncelleme başlatılıyor...");
    //   app.relaunch({ args: [] });
    //   app.exit(0);
    // }, 5 * 60 * 1000); // 5 dakika sonra
  }
});

autoUpdater.on("error", (err) => {
  log.error("Güncelleme hatası:", err);
  if (win) {
    win.webContents.send("update-error", err);
    win.webContents.send("update-status", {
      status: "error",
      error: err.message,
    });
  }
});

// Manuel güncelleme kontrolü için IPC
ipcMain.on("check-for-updates", () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  } else {
    log.info("Geliştirme modunda güncelleme kontrolü atlandı.");
    win?.webContents.send(
      "update-message",
      "Geliştirme modunda güncelleme kontrolü atlandı."
    );
  }
});

// Güncellemeyi uygulama ve yeniden başlatma
ipcMain.on("quit-and-install", () => {
  log.info("Kullanıcı güncelleme ve yeniden başlatma talep etti");

  isUpdating = true;
  createUpdateSplash();

  if (win) {
    win.hide();
  }

  app.relaunch({ args: [] });
  app.exit(0);
});

// YEDEKLEME SİSTEMİ IPC İŞLEYİCİLERİ
async function handleBackupCreation(
  event: Electron.IpcMainInvokeEvent,
  options: any
) {
  try {
    log.info("Renderer üzerinden yedekleme isteği alındı:", options);

    const window = BrowserWindow.fromWebContents(event.sender);

    // Progress callback'i main süreçte tanımla
    const onProgress = (stage: string, progress: number) => {
      if (window && !window.isDestroyed()) {
        window.webContents.send("backup-progress", { stage, progress });
      }
    };

    // Renderer process'ten IndexedDB verisi al
    log.info("Main: Veritabanı dışa aktarma isteği gönderiliyor...");

    // Renderer'a mesaj gönderip cevabını bekle
    return new Promise((resolve, reject) => {
      // Dışa aktarma sonucu için bir kerelik dinleyici
      ipcMain.once("db-export-response", async (_event, response) => {
        try {
          if (!response.success) {
            reject(new Error(response.error || "Dışa aktarma başarısız"));
            return;
          }

          log.info("Main: Veritabanı başarıyla dışa aktarıldı");

          // BackupManager'ı kullanarak yedeği oluştur
          const cleanOptions = {
            description: options?.description || "Manuel Yedekleme",
            backupType: options?.backupType || "full",
            onProgress,
            isAutoBackup: options?.isAutoBackup === true
          };

          log.info("Yedekleme başlatılıyor:", cleanOptions);

          const result = await backupManager.createBackupWithData(
            response.data,
            cleanOptions
          );

          log.info(
            "Yedekleme sonucu:",
            result.success ? "Başarılı" : "Başarısız"
          );
          resolve(result);
        } catch (error: any) {
          log.error("Yedekleme işlemi hatası:", error);
          reject(error);
        }
      });

      // Renderer'a dışa aktarma isteği gönder
      event.sender.send("db-export-request");
    });
  } catch (error: any) {
    log.error("Main: Yedekleme bridge hatası:", error);
    return {
      success: false,
      backupId: "",
      metadata: {},
      error: error.message || "Bilinmeyen hata",
    };
  }
}

// Geri yükleme fonksiyonu
async function handleBackupRestoration(event: Electron.IpcMainInvokeEvent, content: string, options: any) {
  try {
    log.info('Renderer üzerinden geri yükleme isteği alındı');
    
    const window = BrowserWindow.fromWebContents(event.sender);
    
    // Progress callback'i main süreçte tanımla
    const onProgress = (stage: string, progress: number) => {
      if (window && !window.isDestroyed()) {
        window.webContents.send('backup-progress', { stage, progress });
      }
    };
    
    // Yedek içeriğini deserialize et ve verileri al
    const deserializedData = await backupManager.deserializeBackup(content);
    
    if (!deserializedData.isValid || !deserializedData.data) {
      throw new Error(deserializedData.error || 'Geçersiz yedek dosyası');
    }
    
    // JSON verisini string'e dönüştür
    const jsonString = JSON.stringify(deserializedData.data);
    
    // Base64'e kodla (daha güvenli aktarım için)
    const base64Data = Buffer.from(jsonString).toString('base64');
    
    log.info('Main: Veritabanı içe aktarma isteği gönderiliyor...');
    
    // Renderer'a mesaj gönderip cevabını bekle
    return new Promise((resolve, reject) => {
      // İçe aktarma sonucu için bir kerelik dinleyici
      ipcMain.once('db-import-response', async (_event, response) => {
        try {
          if (!response.success) {
            reject(new Error(response.error || 'İçe aktarma başarısız'));
            return;
          }
          
          log.info('Main: Veritabanı başarıyla içe aktarıldı');
          
          resolve({
            success: true,
            metadata: deserializedData.metadata
          });
        } catch (error: any) {
          log.error('Geri yükleme işlemi hatası:', error);
          reject(error);
        }
      });
      
      try {
        // Base64 kodlanmış veriyi gönder
        event.sender.send('db-import-base64', base64Data);
      } catch (error: any) {
        log.error('Veri gönderme hatası:', error);
        reject(new Error(`Veri gönderme hatası: ${error.message}`));
      }
    });
  } catch (error: any) {
    log.error('Main: Geri yükleme bridge hatası:', error);
    return {
      success: false,
      error: error.message || 'Bilinmeyen hata'
    };
  }
}

// Yeni IPC handler'ları kaydet
ipcMain.handle("create-backup-bridge", handleBackupCreation);
ipcMain.handle("restore-backup-bridge", handleBackupRestoration);

// Yedek oluşturma işleyicisi - ESKİ, KULLANIM DIŞI
ipcMain.handle("create-backup", async (event, options) => {
  try {
    log.warn(
      "Eski create-backup API'si kullanılıyor. create-backup-bridge kullanın."
    );
    return await handleBackupCreation(event, options);
  } catch (error: any) {
    log.error("Yedekleme hatası (eski API):", error);
    return {
      success: false,
      backupId: "",
      metadata: {},
      error: error.message,
    };
  }
});

// Yedekten geri yükleme işleyicisi - ESKİ, KULLANIM DIŞI
ipcMain.handle("restore-backup", async (event, content, options) => {
  try {
    log.warn(
      "Eski restore-backup API'si kullanılıyor. restore-backup-bridge kullanın."
    );
    return await handleBackupRestoration(event, content, options);
  } catch (error: any) {
    log.error("Geri yükleme hatası (eski API):", error);
    return {
      success: false,
      error: error.message,
    };
  }
});

// Yedek geçmişini getir
ipcMain.handle("get-backup-history", async () => {
  try {
    const history = backupManager.listBackups();
    return history;
  } catch (error: any) {
    log.error("Yedek geçmişi alma hatası:", error);
    return [];
  }
});

// Yedek dosyası okuma işleyicisi
ipcMain.handle("read-backup-file", async () => {
  try {
    return await FileUtils.readFile();
  } catch (error) {
    log.error("Dosya okuma hatası:", error);
    throw error;
  }
});

// Otomatik yedekleme zamanlaması işleyicileri
ipcMain.handle(
  "schedule-backup",
  async (event, frequency, hour = 3, minute = 0) => {
    try {
      return backupManager.scheduleBackup(frequency, hour, minute);
    } catch (error: any) {
      log.error("Zamanlama hatası:", error);
      return false;
    }
  }
);

ipcMain.handle("disable-scheduled-backup", async () => {
  try {
    return backupManager.disableScheduledBackup();
  } catch (error: any) {
    log.error("Zamanlama iptal hatası:", error);
    return false;
  }
});

ipcMain.handle("test-auto-backup", async () => {
  try {
    console.log("Otomatik yedekleme testi başlatılıyor...");
    
    // Gerekli verileri oluştur
    const exportedData = {
      exportInfo: {
        databases: [
          { name: "testDB", recordCounts: { testStore: 5 } }
        ],
        totalRecords: 5
      },
      databases: {
        testDB: { testStore: [{ id: 1, data: "test" }] }
      }
    };
    
    console.log("Test verisi hazırlandı, yedekleme başlatılıyor...");
    
    // isAutoBackup bayrağını true olarak ayarlayarak yedekleme yap
    const result = await backupManager.createBackupWithData(exportedData, {
      description: "Test Otomatik Yedekleme",
      backupType: "full",
      isAutoBackup: true
    });
    
    console.log("Yedekleme tamamlandı, sonuç:", result);
    
    return result;
  } catch (error) {
    console.error("Test yedekleme hatası:", error);
    return { success: false, error: (error as Error).message };
  }
});

// Periyodik güncelleme kontrolü (her 4 saatte bir)
setInterval(() => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
    log.info("Periyodik güncelleme kontrolü yapılıyor...");
  }
}, 4 * 60 * 60 * 1000);

// Uygulama kapatılmadan önce kontrol et
app.on("before-quit", (event) => {
  if (isUpdating && updateSplashWindow && !updateSplashWindow.isDestroyed()) {
    event.preventDefault();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  if (!app.isPackaged) {
    app.commandLine.appendSwitch("remote-debugging-port", "9222");
  }
  createWindow();

  backupManager.startScheduler();
  log.info("Yedekleme zamanlayıcısı başlatıldı");
});