import { ipcRenderer, contextBridge } from "electron";

// --------- Expose IPC Renderer API ---------
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) =>
      listener(event, ...args)
    );
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },
});

// --------- Web Serial API'yi Renderer Sürecine Expose Edelim ---------
contextBridge.exposeInMainWorld("serialAPI", {
  requestPort: async () => {
    const nav = navigator as unknown as { serial?: any }; // TypeScript için manuel tanımlama
    if (nav.serial) {
      return await nav.serial.requestPort();
    } else {
      throw new Error("Web Serial API desteklenmiyor!");
    }
  },
  getPorts: async () => {
    const nav = navigator as unknown as { serial?: any };
    if (nav.serial) {
      return await nav.serial.getPorts();
    } else {
      throw new Error("Web Serial API desteklenmiyor!");
    }
  },
});

// --------- Güncelleme API'sini Renderer Sürecine Expose Edelim ---------
contextBridge.exposeInMainWorld("updaterAPI", {
  // Mevcut metodlar...
  checkForUpdates: () => {
    ipcRenderer.send("check-for-updates");
  },

  // Güncelleme durumu event'leri
  onUpdateAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on("update-available", (_event, info) => callback(info));
  },

  onUpdateDownloaded: (callback: (info: any) => void) => {
    ipcRenderer.on("update-downloaded", (_event, info) => callback(info));
  },

  onUpdateError: (callback: (err: any) => void) => {
    ipcRenderer.on("update-error", (_event, err) => callback(err));
  },

  onUpdateMessage: (callback: (message: string) => void) => {
    ipcRenderer.on("update-message", (_event, message) => callback(message));
  },

  // Yeni eklenen metodlar
  onUpdateProgress: (callback: (progressObj: any) => void) => {
    ipcRenderer.on("update-progress", (_event, progressObj) =>
      callback(progressObj)
    );
  },

  onUpdateStatus: (callback: (statusObj: any) => void) => {
    ipcRenderer.on("update-status", (_event, statusObj) => callback(statusObj));
  },

  // Test metodları (geliştirme modunda)
  testUpdateAvailable: () => {
    ipcRenderer.send("test-update-available");
  },

  testUpdateDownloaded: () => {
    ipcRenderer.send("test-update-downloaded");
  },

  testUpdateError: () => {
    ipcRenderer.send("test-update-error");
  },
});

// --------- Yedekleme API'sini Renderer Sürecine Expose Edelim ---------
contextBridge.exposeInMainWorld("backupAPI", {
  // Mevcut metodlar...
  saveBackupToFile: (data: string, filename: string) => {
    return ipcRenderer.invoke("save-backup-file", data, filename);
  },

  readBackupFile: () => {
    return ipcRenderer.invoke("read-backup-file");
  },

  // Zamanlama işlemleri
  scheduleBackup: (frequency: string, hour?: number, minute?: number) => {
    return ipcRenderer.invoke("schedule-backup", frequency, hour, minute);
  },

  disableScheduledBackup: () => {
    return ipcRenderer.invoke("disable-scheduled-backup");
  },

  getBackupHistory: () => {
    return ipcRenderer.invoke("get-backup-history");
  },

  // İlerleme bildirimi
  onBackupProgress: (
    callback: (data: { stage: string; progress: number }) => void
  ) => {
    ipcRenderer.on("backup-progress", (_event, data) => callback(data));
  },

  offBackupProgress: (
    callback: (data: { stage: string; progress: number }) => void
  ) => {
    ipcRenderer.removeListener("backup-progress", (_event, data) =>
      callback(data)
    );
  },

  // YENİ: IndexedDB işlemleri için köprü fonksiyonlar
  createBackup: (options?: any) => {
    return ipcRenderer.invoke("create-backup-bridge", options);
  },

  restoreBackup: async (content: string, options?: any) => {
    try {
      return await ipcRenderer.invoke(
        "restore-backup-bridge",
        content,
        options
      );
    } catch (error) {
      console.error("Yedekleme geri yükleme hatası:", error);
      throw error;
    }
  },
});

// YENİ: IndexedDB köprüsü - Sadece renderer process için
contextBridge.exposeInMainWorld("indexedDBAPI", {
  exportAllDatabases: async () => {
    // Bu fonksiyon doğrudan renderer process'te çalışacak (burada IndexedDB erişilebilir)
    return await ipcRenderer.invoke("db-export-request");
  },

  importAllDatabases: async (data: any, options: any) => {
    return await ipcRenderer.invoke("db-import-request", data, options);
  },
});
