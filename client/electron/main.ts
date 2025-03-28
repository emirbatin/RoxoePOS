import { app, BrowserWindow, Menu, dialog, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import LicenseManager from "./license";
import { autoUpdater } from "electron-updater";
import log from "electron-log";
import { backupManager, FileUtils } from "../src/backup";
import fs from "fs";

// Log ayarları
log.transports.file.level = "info";
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.allowDowngrade = false;
autoUpdater.allowPrerelease = false;
autoUpdater.forceDevUpdateConfig = false; 
autoUpdater.fullChangelog = true; 

// Güncelleme durumu takibi
let isUpdating = false;
let updateSplashWindow: BrowserWindow | null = null;
let isDeltaUpdate = false; 
let lastUpdateSize = 0; // Son güncelleme boyutu için hafıza

// GitHub token ayarları
const githubToken = process.env.GH_TOKEN;

if (githubToken) {
  autoUpdater.setFeedURL({
    provider: "github",
    owner: "emirbatin",
    repo: "RoxoePOS",
    token: githubToken,
    private: true,
  } as any); // 'as any' ile geçici olarak type checking

  log.info(
    "GitHub token ile güncelleme ayarları yapılandırıldı (delta güncellemeler etkin)"
  );
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

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

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
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
        color: #f9fafb;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
        overflow: hidden;
      }
      
      .update-card {
        background: rgba(31, 41, 55, 0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-radius: 16px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 
                    0 8px 10px -6px rgba(0, 0, 0, 0.2),
                    0 0 0 1px rgba(255, 255, 255, 0.08) inset;
        padding: 32px 40px;
        text-align: center;
        max-width: 400px;
        width: 90%;
        position: relative;
        overflow: hidden;
      }
      
      .update-logo {
        margin-bottom: 20px;
        position: relative;
        width: 80px;
        height: 80px;
        margin: 0 auto 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .update-logo::before {
        content: "";
        position: absolute;
        border-radius: 50%;
        width: 100%;
        height: 100%;
        background: rgba(124, 58, 237, 0.1);
        animation: pulse 2s infinite;
      }
      
      @keyframes pulse {
        0% { transform: scale(0.95); opacity: 0.7; }
        70% { transform: scale(1.1); opacity: 0.3; }
        100% { transform: scale(0.95); opacity: 0.7; }
      }
      
      .loader {
        position: relative;
        width: 60px;
        height: 60px;
      }
      
      .loader-circle {
        position: absolute;
        width: 100%;
        height: 100%;
        border: 4px solid transparent;
        border-top-color: #8b5cf6;
        border-radius: 50%;
        animation: spin 1.5s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
      }
      
      .loader-circle:nth-child(1) {
        width: 100%;
        height: 100%;
        animation-delay: 0s;
        border-top-color: #8b5cf6;
      }
      
      .loader-circle:nth-child(2) {
        width: 80%;
        height: 80%;
        top: 10%;
        left: 10%;
        animation-delay: -0.3s;
        border-top-color: #9333ea;
      }
      
      .loader-circle:nth-child(3) {
        width: 60%;
        height: 60%;
        top: 20%;
        left: 20%;
        animation-delay: -0.6s;
        border-top-color: #a855f7;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .update-heading {
        font-size: 22px;
        font-weight: 600;
        margin-bottom: 12px;
        background: linear-gradient(90deg, #d8b4fe, #a78bfa);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        letter-spacing: -0.01em;
      }
      
      .update-text {
        color: #d1d5db;
        font-size: 15px;
        line-height: 1.4;
        margin-bottom: 24px;
      }
      
      .progress-bar {
        width: 100%;
        height: 4px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        overflow: hidden;
        margin-top: 10px;
      }
      
      .progress-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #a855f7, #8b5cf6);
        border-radius: 4px;
        width: 0%;
        animation: progress 40s cubic-bezier(0.34, 1.56, 0.64, 1);
        animation-fill-mode: forwards;
      }
      
      @keyframes progress {
        0% { width: 0%; }
        10% { width: 10%; }
        20% { width: 25%; }
        50% { width: 40%; }
        70% { width: 55%; }
        80% { width: 65%; }
        90% { width: 75%; }
        100% { width: 90%; }
      }
      
      .ambient-circle {
        position: fixed;
        border-radius: 50%;
        filter: blur(80px);
        z-index: -1;
        opacity: 0.4;
      }
      
      .circle-1 {
        width: 250px;
        height: 250px;
        background: #8b5cf6;
        top: 20%;
        left: 15%;
        animation: float1 20s infinite alternate;
      }
      
      .circle-2 {
        width: 200px;
        height: 200px;
        background: #9333ea;
        bottom: 15%;
        right: 20%;
        animation: float2 15s infinite alternate;
      }
      
      @keyframes float1 {
        0% { transform: translate(0, 0); }
        100% { transform: translate(-30px, 30px); }
      }
      
      @keyframes float2 {
        0% { transform: translate(0, 0); }
        100% { transform: translate(30px, -30px); }
      }
    </style>
  </head>
  <body>
    <div class="ambient-circle circle-1"></div>
    <div class="ambient-circle circle-2"></div>
    
    <div class="update-card">
      <div class="update-logo">
        <div class="loader">
          <div class="loader-circle"></div>
          <div class="loader-circle"></div>
          <div class="loader-circle"></div>
        </div>
      </div>
      
      <h2 class="update-heading">RoxoePOS Güncelleniyor</h2>
      <p class="update-text">Lütfen bekleyin, en son özellikler ve iyileştirmeler sisteminize kuruluyor...</p>
      
      <div class="progress-bar">
        <div class="progress-bar-fill"></div>
      </div>
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

    // Geliştirici menüsü (sadece geliştirme modunda)
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
          {
            label: "Test Delta Update",
            click: () => {
              if (win) {
                win.webContents.send("test-update-available");
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
          remaining: 100,
        },
      });
    }, 1500);
  }

  lastProgressTime = Date.now();
  lastProgressBytes = 0;
  downloadSpeed = 0;
  isDeltaUpdate = false; // Her güncelleme başında sıfırla
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

    // İndirme başladığında, ilk 5% içinde delta güncelleme olup olmadığını tespit et
    if (progressObj.percent < 5 && progressObj.total > 0) {
      // Güncelleme başlangıcında, toplam boyuta bakarak delta veya tam güncelleme olduğunu belirle
      if (lastUpdateSize > 0) {
        // Eğer bu güncellemenin toplam boyutu, son güncellemenin %40'ından azsa delta olarak kabul et
        isDeltaUpdate = progressObj.total < lastUpdateSize * 0.4;
        log.info(
          `Güncelleme tipi tespit edildi: ${
            isDeltaUpdate ? "Delta" : "Tam"
          } güncelleme`
        );
        log.info(
          `Mevcut boyut: ${progressObj.total}, Son güncelleme boyutu: ${lastUpdateSize}`
        );
      } else {
        // İlk güncelleme, referans boyutu yok
        isDeltaUpdate = false;
        log.info(
          "İlk güncelleme tespit edildi, tam güncelleme olarak kabul edildi"
        );
      }
    }
  }

  const progressDetails = {
    percent: progressObj.percent || 0,
    transferred: progressObj.transferred || 0,
    total: progressObj.total || 0,
    speed: downloadSpeed.toFixed(2),
    remaining: progressObj.total - progressObj.transferred || 0,
    isDelta: isDeltaUpdate, // Delta durumunu ekle
  };

  log.info(
    `İndirme ilerlemesi: ${progressDetails.percent.toFixed(1)}%, ${
      progressDetails.speed
    } MB/s, ${isDeltaUpdate ? "Delta güncelleme" : "Tam güncelleme"}`
  );

  if (win) {
    win.webContents.send("update-progress", progressDetails);
    win.webContents.send("update-status", {
      status: "downloading",
      progress: progressDetails,
      version: autoUpdater.currentVersion?.version,
    });
  }
});

autoUpdater.on("update-downloaded", (info) => {
  log.info("Güncelleme indirildi:", info);

  // Güncelleme tamamlandığında son boyutu kaydet (referans için)
  if (lastProgressBytes > 0) {
    lastUpdateSize = lastProgressBytes;
    log.info(`Son güncelleme boyutu kaydedildi: ${lastUpdateSize} bytes`);
  }

  if (win) {
    win.webContents.send("update-downloaded", info);
    win.webContents.send("update-status", {
      status: "downloaded",
      version: info.version,
      updateType: isDeltaUpdate ? "delta" : "full", // Güncelleme tipini ekle
    });

    // Kullanıcıya bildirim gönder
    log.info(
      `Yeni sürüm (${info.version}) indirildi. Kullanıcıya bildirim gönderildi.`
    );

    // Opsiyonel: Otomatik güncelleme yapmak için aşağıdaki kodu etkinleştirin
    // setTimeout(() => {
    //   log.info("Otomatik güncelleme başlatılıyor...");
    //   autoUpdater.quitAndInstall(false, true);
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

// Güncellemeyi uygulama ve yeniden başlatma
ipcMain.on("quit-and-install", () => {
  log.info("Kullanıcı güncelleme ve yeniden başlatma talep etti");

  isUpdating = true;
  createUpdateSplash();

  if (win) {
    win.hide();
  }

  // Doğru yöntem: autoUpdater.quitAndInstall() kullan
  // Bu yöntem, kurulum tamamlanana kadar bekler ve sonra uygulamayı yeniden başlatır
  autoUpdater.quitAndInstall(false, true);
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

// Test için güncelleme simülasyonu
ipcMain.on("test-update-available", () => {
  log.info("Test: Güncelleme mevcut bildirimi simüle ediliyor");
  if (win) {
    const testVersion = `${app.getVersion()}.1`; // Mevcut sürümden biraz daha yüksek
    win.webContents.send("update-available", { version: testVersion });
    win.webContents.send("update-status", {
      status: "available",
      version: testVersion,
    });

    // 1.5 saniye sonra indirme durumuna geçiş yap (mevcut koddan alıntı)
    setTimeout(() => {
      win?.webContents.send("update-status", {
        status: "downloading",
        version: testVersion,
        progress: {
          percent: 0,
          transferred: 0,
          total: 100,
          speed: "0.00",
          remaining: 100,
        },
      });

      // İndirme ilerlemesini simüle et (10 saniyede tamamlanacak şekilde)
      let percent = 0;
      const interval = setInterval(() => {
        percent += 10;

        // Rastgele büyüklük (delta veya tam olma ihtimali)
        const isDeltaTest = Math.random() > 0.5;
        const totalSize = isDeltaTest ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
        const transferred = Math.floor((percent * totalSize) / 100);

        win?.webContents.send("update-progress", {
          percent: percent,
          transferred: transferred,
          total: totalSize,
          speed: "1.25",
          remaining: totalSize - transferred,
          isDelta: isDeltaTest,
        });

        win?.webContents.send("update-status", {
          status: "downloading",
          version: testVersion,
          progress: {
            percent: percent,
            transferred: transferred,
            total: totalSize,
            speed: "1.25",
            remaining: totalSize - transferred,
            isDelta: isDeltaTest,
          },
        });

        if (percent >= 100) {
          clearInterval(interval);
          // İndirme tamamlandığında, download-completed eventi tetikle
          win?.webContents.send("update-downloaded", {
            version: testVersion,
            updateType: isDeltaTest ? "delta" : "full",
          });
          win?.webContents.send("update-status", {
            status: "downloaded",
            version: testVersion,
            updateType: isDeltaTest ? "delta" : "full",
          });
        }
      }, 1000);
    }, 1500);
  }
});

// Test için indirilen güncelleme simülasyonu
ipcMain.on("test-update-downloaded", () => {
  log.info("Test: Güncelleme indirme tamamlandı bildirimi simüle ediliyor");
  if (win) {
    const testVersion = `${app.getVersion()}.1`;
    win.webContents.send("update-downloaded", {
      version: testVersion,
      updateType: "delta", // Test için delta olarak işaretle
    });
    win.webContents.send("update-status", {
      status: "downloaded",
      version: testVersion,
      updateType: "delta",
    });
  }
});

// Test için hata simülasyonu
ipcMain.on("test-update-error", () => {
  log.info("Test: Güncelleme hatası bildirimi simüle ediliyor");
  if (win) {
    win.webContents.send("update-error", new Error("Test hata mesajı"));
    win.webContents.send("update-status", {
      status: "error",
      error: "Test hata mesajı",
    });
  }
});

// Test için quit-and-install simülasyonu
ipcMain.on("test-quit-and-install", () => {
  log.info("Test: quit-and-install simüle ediliyor");

  isUpdating = true;
  createUpdateSplash();

  if (win) {
    win.hide();
  }

  // Gerçek güncelleme olmadığı için 5 saniye bekleyip uygulamayı yeniden başlatalım
  setTimeout(() => {
    log.info("Test: Uygulama yeniden başlatılıyor");
    app.relaunch();
    app.exit(0);
  }, 5000);
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
            isAutoBackup: options?.isAutoBackup === true,
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
async function handleBackupRestoration(
  event: Electron.IpcMainInvokeEvent,
  content: string,
  options: any
) {
  try {
    log.info("Renderer üzerinden geri yükleme isteği alındı");

    const window = BrowserWindow.fromWebContents(event.sender);

    // Progress callback'i main süreçte tanımla
    const onProgress = (stage: string, progress: number) => {
      if (window && !window.isDestroyed()) {
        window.webContents.send("backup-progress", { stage, progress });
      }
    };

    // Yedek içeriğini deserialize et ve verileri al
    const deserializedData = await backupManager.deserializeBackup(content);

    if (!deserializedData.isValid || !deserializedData.data) {
      throw new Error(deserializedData.error || "Geçersiz yedek dosyası");
    }

    // JSON verisini string'e dönüştür
    const jsonString = JSON.stringify(deserializedData.data);

    // Base64'e kodla (daha güvenli aktarım için)
    const base64Data = Buffer.from(jsonString).toString("base64");

    log.info("Main: Veritabanı içe aktarma isteği gönderiliyor...");

    // Renderer'a mesaj gönderip cevabını bekle
    return new Promise((resolve, reject) => {
      // İçe aktarma sonucu için bir kerelik dinleyici
      ipcMain.once("db-import-response", async (_event, response) => {
        try {
          if (!response.success) {
            reject(new Error(response.error || "İçe aktarma başarısız"));
            return;
          }

          log.info("Main: Veritabanı başarıyla içe aktarıldı");

          resolve({
            success: true,
            metadata: deserializedData.metadata,
          });
        } catch (error: any) {
          log.error("Geri yükleme işlemi hatası:", error);
          reject(error);
        }
      });

      try {
        // Base64 kodlanmış veriyi gönder
        event.sender.send("db-import-base64", base64Data);
      } catch (error: any) {
        log.error("Veri gönderme hatası:", error);
        reject(new Error(`Veri gönderme hatası: ${error.message}`));
      }
    });
  } catch (error: any) {
    log.error("Main: Geri yükleme bridge hatası:", error);
    return {
      success: false,
      error: error.message || "Bilinmeyen hata",
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
        databases: [{ name: "testDB", recordCounts: { testStore: 5 } }],
        totalRecords: 5,
      },
      databases: {
        testDB: { testStore: [{ id: 1, data: "test" }] },
      },
    };

    console.log("Test verisi hazırlandı, yedekleme başlatılıyor...");

    // isAutoBackup bayrağını true olarak ayarlayarak yedekleme yap
    const result = await backupManager.createBackupWithData(exportedData, {
      description: "Test Otomatik Yedekleme",
      backupType: "full",
      isAutoBackup: true,
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
