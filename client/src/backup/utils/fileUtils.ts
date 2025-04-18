// fileUtils.ts
import fs from "fs";
import path from "path";
import { app, dialog } from "electron";
import Store from 'electron-store'; // 1. electron-store'u import et

// 2. electron-store örneği oluştur (yedekleme dizini yolunu saklamak için)
// Tip olarak { backupDirectoryPath?: string } belirterek ne sakladığımızı netleştirelim.
const store = new Store<{ backupDirectoryPath?: string }>();

export class FileUtils {
  // Kullanıcı tanımlı yedekleme dizinini oturum boyunca hafızada tutmak için
  private static backupDirectory: string | null = null;

  /**
   * Yedekleme dizinini ayarlar ve kalıcı olarak kaydeder.
   * @param directory Yedeklemelerin kaydedileceği dizin
   */
  static setBackupDirectory(directory: string): void {
    try {
      // Adım 1: Oturum için statik değişkeni güncelle
      FileUtils.backupDirectory = directory;

      // Adım 2: Kalıcı depoya kaydet (electron-store kullanarak)
      store.set('backupDirectoryPath', directory);

      // Adım 3: Dizinin varlığını kontrol et, yoksa oluştur
      if (!fs.existsSync(directory)) {
        console.log(`Dizin mevcut değil, oluşturuluyor: ${directory}`);
        fs.mkdirSync(directory, { recursive: true });
      }

      console.log(`Yedekleme dizini ayarlandı ve kaydedildi: ${directory}`);
    } catch (error) {
      console.error('Yedekleme dizini ayarlama/kaydetme hatası:', error);
      // Hatanın yukarıya iletilmesi, IPC handler'ın bunu yakalamasını sağlar
      throw error;
    }
  }

  /**
   * Mevcut yedekleme dizinini döndürür.
   * Önce kalıcı depodan okur, bulamazsa varsayılanı hesaplar.
   * @returns Yedekleme dizini yolu (string)
   */
  static getBackupDirectory(): string {
    // Optimizasyon: Eğer bu oturumda zaten ayarlanmış veya yüklenmişse, tekrar hesaplama yapma
    if (FileUtils.backupDirectory) {
      return FileUtils.backupDirectory;
    }

    // Adım 1: Kalıcı depodan (electron-store) okumayı dene
    const storedPath = store.get('backupDirectoryPath');

    if (storedPath && typeof storedPath === 'string') {
      try {
        // Kaydedilmiş yolun hala geçerli olup olmadığını kontrol et (önerilir)
        if (!fs.existsSync(storedPath)) {
           console.warn(`Kaydedilmiş yedekleme dizini (${storedPath}) bulunamadı. Yeniden oluşturuluyor...`);
           // Dizini yeniden oluşturmayı dene
           fs.mkdirSync(storedPath, { recursive: true });
        }
        // Yolu bu oturum için statik değişkene ata
        FileUtils.backupDirectory = storedPath;
        console.log("Kaydedilmiş yedekleme dizini yüklendi:", storedPath);
        return storedPath;
      } catch (error) {
         // Eğer kaydedilmiş dizine erişilemiyorsa (örn: silinmiş, izin sorunu)
         console.error(`Kaydedilmiş yedekleme dizini (${storedPath}) erişim/oluşturma hatası:`, error);
         // Sorunlu kaydı depodan sil ve varsayılana dön
         store.delete('backupDirectoryPath');
      }
    }

    // Adım 2: Depoda yoksa veya okunamadıysa, varsayılanı hesapla
    // require('os') yerine app.getPath kullanıyoruz - daha güvenli ve tutarlı
    const documentsPath = app.getPath('documents');
    const defaultBackupPath = path.join(documentsPath, 'RoxoePOS Backups'); // Varsayılan klasör adı

    try {
      // Varsayılan dizinin varlığını kontrol et, yoksa oluştur
      if (!fs.existsSync(defaultBackupPath)) {
        console.log(`Varsayılan yedekleme dizini oluşturuluyor: ${defaultBackupPath}`);
        fs.mkdirSync(defaultBackupPath, { recursive: true });
      }
    } catch (error) {
       console.error(`Varsayılan yedekleme dizini (${defaultBackupPath}) oluşturulamadı:`, error);
       // Hata durumunda en azından belgeler klasörünü döndür
       return documentsPath;
    }

    // Hesaplanan varsayılanı bu oturum için statik değişkene ata
    FileUtils.backupDirectory = defaultBackupPath;
    console.log("Varsayılan yedekleme dizini kullanılıyor:", defaultBackupPath);

    // Önemli Not: Varsayılan yolu kalıcı depoya (store) *kaydetmiyoruz*.
    // Sadece kullanıcı `setBackupDirectory` ile bir seçim yaptığında kaydediyoruz.
    // İsterseniz ilk hesaplamada varsayılanı da kaydedebilirsiniz:
    // store.set('backupDirectoryPath', defaultBackupPath);

    return defaultBackupPath;
  }

  /**
   * Dosya indirme fonksiyonu - Electron versiyonu
   * @param content İndirilecek içerik
   * @param filename Dosya adı
   * @param isAutoBackup Otomatik yedekleme mi?
   * @returns Promise olarak kaydedilen dosya yolu
   */
  static async downloadFile(content: string, filename: string, isAutoBackup: boolean = false): Promise<string> {
    try {
      console.log(`Yedek dosyası kaydediliyor: ${filename}, otomatik: ${isAutoBackup}`);

      // Otomatik yedekleme ise doğrudan yedekleme klasörüne kaydet
      if (isAutoBackup) {
        console.log("Otomatik yedekleme dosyası kaydediliyor...");
        // getBackupDirectory artık doğru (kalıcı veya varsayılan) yolu döndürecek
        const backupFolderPath = FileUtils.getBackupDirectory();
        console.log(`Yedekleme klasörü: ${backupFolderPath}`);

        // Yedekleme klasörünün varlığını (tekrar) kontrol et (getBackupDirectory zaten yapıyor ama garanti olsun)
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
      // Manuel yedekleme için dialog göster - Başlangıç dizini olarak seçilen/varsayılan yedekleme dizinini kullan
      const result = await dialog.showSaveDialog({
        title: 'Yedeği Kaydet',
        // getBackupDirectory doğru yolu verecek
        defaultPath: path.join(FileUtils.getBackupDirectory(), filename),
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
   * @returns Promise olarak dosya içeriği { name: string; content: string }
   */
  static async readFile(): Promise<{ name: string; content: string }> {
    try {
      const result = await dialog.showOpenDialog({
        title: "Yedek Dosyası Seç",
        // Dialog başlangıç konumu olarak mevcut yedekleme dizinini kullan
        defaultPath: FileUtils.getBackupDirectory(),
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
      throw error; // Hatanın yukarıya iletilmesi önemli
    }
  }

  // --- Yedek Geçmişi Metodları 

  /**
   * Yedekleme meta verilerini yerel dosya sistemine kaydeder (yedek geçmişi için)
   * @param backupId Yedek ID'si
   * @param backupMetadata Yedekleme meta verileri (filename, description, createdAt vb. içermeli)
   */
  static saveBackupToHistory(backupId: string, backupMetadata: any): void {
    try {
      const historyFilePath = path.join(
        app.getPath("userData"), // Uygulamanın kullanıcı verileri klasörü
        "backup_history.json"
      );

      let backupHistory: any[] = [];
      if (fs.existsSync(historyFilePath)) {
        try {
          const historyData = fs.readFileSync(historyFilePath, "utf8");
          backupHistory = JSON.parse(historyData);
          // JSON parse hatasına karşı kontrol
          if (!Array.isArray(backupHistory)) backupHistory = [];
        } catch (parseError) {
           console.error("Yedek geçmişi dosyası okunamadı/parse edilemedi:", parseError);
           backupHistory = []; // Hata durumunda sıfırla
        }
      }

      // Yeni yedeği başa ekle
      backupHistory.unshift({
        id: backupId,
        ...backupMetadata, // filename, description, createdAt gibi bilgiler burada olmalı
        // Otomatik yedeklemeler için dizini de kaydedebiliriz, manuelde zaten dialogdan geliyor
        directory: backupMetadata.isAutoBackup ? FileUtils.getBackupDirectory() : undefined
      });

      // Maksimum 20 yedek tut (veya başka bir limit)
      backupHistory = backupHistory.slice(0, 20);

      fs.writeFileSync(historyFilePath, JSON.stringify(backupHistory, null, 2), "utf8"); // Güzel formatlama için null, 2 eklendi
    } catch (error) {
      console.error("Yedek geçmişi kaydedilemedi:", error);
    }
  }

  /**
   * Yerel dosya sisteminden yedek geçmişini yükler
   * @returns Yedek geçmişi listesi (any[])
   */
  static getBackupHistory(): any[] {
    try {
      const historyFilePath = path.join(
        app.getPath("userData"),
        "backup_history.json"
      );

      if (fs.existsSync(historyFilePath)) {
         try {
             const historyData = fs.readFileSync(historyFilePath, "utf8");
             const parsedData = JSON.parse(historyData);
             return Array.isArray(parsedData) ? parsedData : []; // Dizi olduğundan emin ol
         } catch (parseError) {
              console.error("Yedek geçmişi dosyası okunamadı/parse edilemedi:", parseError);
              return []; // Hata durumunda boş dizi döndür
         }
      }
      return []; // Dosya yoksa boş dizi döndür
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
         try {
             const historyData = fs.readFileSync(historyFilePath, "utf8");
             let backupHistory = JSON.parse(historyData);
             if (!Array.isArray(backupHistory)) return; // Geçerli değilse çık

             const filteredHistory = backupHistory.filter(
               (item: any) => item && item.id !== backupId // item'ın varlığını da kontrol et
             );

             // Eğer liste değişmişse dosyayı tekrar yaz
             if (filteredHistory.length !== backupHistory.length) {
                fs.writeFileSync(
                   historyFilePath,
                   JSON.stringify(filteredHistory, null, 2),
                   "utf8"
                );
                console.log(`Yedek geçmişinden silindi: ${backupId}`);
             }
         } catch (error) {
            console.error("Yedek geçmişi dosyası okunurken/yazılırken hata:", error);
         }
      }
    } catch (error) {
      console.error("Yedek geçmişten silinemedi:", error);
    }
  }
} 