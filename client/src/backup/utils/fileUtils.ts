/**
 * Dosya işlemleri için yardımcı fonksiyonlar
 */

import fs from "fs";
import path from "path";
import { app, dialog } from "electron";

export class FileUtils {
  /**
   * Dosya indirme fonksiyonu - Electron versiyonu
   * @param content İndirilecek içerik
   * @param filename Dosya adı
   * @param mimeType Dosya MIME türü
   * @returns Promise olarak kaydedilen dosya yolu
   */
  // FileUtils.ts dosyasında
  static async downloadFile(content: string, filename: string, isAutoBackup: boolean = false): Promise<string> {
    try {
      console.log(`Yedek dosyası kaydediliyor: ${filename}, otomatik: ${isAutoBackup}`);
      
      // Otomatik yedekleme ise doğrudan Documents klasörüne kaydet
      if (isAutoBackup) {
        console.log("Otomatik yedekleme dosyası kaydediliyor...");
        const documentsPath = app.getPath('documents');
        console.log(`Documents klasörü: ${documentsPath}`);
        
        const backupFolderPath = path.join(documentsPath, 'RoxoePOS Backups');
        console.log(`Yedekleme klasörü: ${backupFolderPath}`);
        
        // Backup klasörü yoksa oluştur
        if (!fs.existsSync(backupFolderPath)) {
          console.log(`Yedekleme klasörü oluşturuluyor: ${backupFolderPath}`);
          fs.mkdirSync(backupFolderPath, { recursive: true });
        }
        
        const filePath = path.join(backupFolderPath, filename);
        console.log(`Dosya kaydediliyor: ${filePath}`);
        fs.writeFileSync(filePath, content);
        console.log(`Otomatik yedek kaydedildi: ${filePath}`);
        return filePath;
      }
      
      console.log("Manuel yedekleme için dialog gösteriliyor...");
      // Manuel yedekleme için dialog göster
      const result = await dialog.showSaveDialog({
        title: 'Yedeği Kaydet',
        defaultPath: path.join(app.getPath('documents'), filename),
        filters: [{ name: 'Roxoe Yedekleri', extensions: ['roxoe'] }]
      });
      
      if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, content);
        console.log(`Manuel yedek kaydedildi: ${result.filePath}`);
        return result.filePath;
      } else {
        console.log("Kullanıcı kaydetme işlemini iptal etti");
        throw new Error('Kullanıcı işlemi iptal etti');
      }
    } catch (error) {
      console.error('Dosya kaydedilemedi:', error);
      throw error;
    }
  }

  /**
   * Dosya yükleme fonksiyonu - Electron versiyonu
   * @returns Promise olarak dosya içeriği
   */
  static async readFile(): Promise<{ name: string; content: string }> {
    try {
      const result = await dialog.showOpenDialog({
        title: "Yedek Dosyası Seç",
        properties: ["openFile"],
        filters: [{ name: "Roxoe Yedekleri", extensions: ["roxoe"] }],
      });

      if (result.canceled || result.filePaths.length === 0) {
        throw new Error("Dosya seçilmedi");
      }

      const filePath = result.filePaths[0];
      const content = fs.readFileSync(filePath, "utf8");

      return {
        name: path.basename(filePath),
        content,
      };
    } catch (error) {
      console.error("Dosya okuma hatası:", error);
      throw error;
    }
  }

  /**
   * Yedekleme dosyasını yerel dosya sistemine kaydeder (yedek geçmişi için)
   * @param backupId Yedek ID'si
   * @param backupMetadata Yedekleme meta verileri
   */
  static saveBackupToHistory(backupId: string, backupMetadata: any): void {
    try {
      const historyFilePath = path.join(
        app.getPath("userData"),
        "backup_history.json"
      );

      // Mevcut geçmişi yükle
      let backupHistory: any[] = [];
      if (fs.existsSync(historyFilePath)) {
        const historyData = fs.readFileSync(historyFilePath, "utf8");
        backupHistory = JSON.parse(historyData);
      }

      // Yeni yedeği ekle (maksimum sayıyı kontrol et)
      backupHistory.unshift({
        id: backupId,
        ...backupMetadata,
        timestamp: new Date().toISOString(),
      });

      // Maksimum 20 yedek tut
      if (backupHistory.length > 20) {
        backupHistory.pop();
      }

      // Geçmişi kaydet
      fs.writeFileSync(historyFilePath, JSON.stringify(backupHistory), "utf8");
    } catch (error) {
      console.error("Yedek geçmişi kaydedilemedi:", error);
    }
  }

  /**
   * Yerel dosya sisteminden yedek geçmişini yükler
   * @returns Yedek geçmişi listesi
   */
  static getBackupHistory(): any[] {
    try {
      const historyFilePath = path.join(
        app.getPath("userData"),
        "backup_history.json"
      );

      if (fs.existsSync(historyFilePath)) {
        const historyData = fs.readFileSync(historyFilePath, "utf8");
        return JSON.parse(historyData);
      }

      return [];
    } catch (error) {
      console.error("Yedek geçmişi yüklenemedi:", error);
      return [];
    }
  }

  /**
   * Belirtilen yedeği geçmişten siler
   * @param backupId Silinecek yedeğin ID'si
   */
  static deleteBackupFromHistory(backupId: string): void {
    try {
      const historyFilePath = path.join(
        app.getPath("userData"),
        "backup_history.json"
      );

      if (fs.existsSync(historyFilePath)) {
        const historyData = fs.readFileSync(historyFilePath, "utf8");
        let backupHistory = JSON.parse(historyData);

        const filteredHistory = backupHistory.filter(
          (item: any) => item.id !== backupId
        );
        fs.writeFileSync(
          historyFilePath,
          JSON.stringify(filteredHistory),
          "utf8"
        );
      }
    } catch (error) {
      console.error("Yedek geçmişten silinemedi:", error);
    }
  }
}
