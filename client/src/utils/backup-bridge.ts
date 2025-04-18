// src/utils/backup-bridge.ts
// Electron doğrudan import edilmeyecek - renderer process'te çalışacak
import { IndexedDBExporter } from '../backup/database/IndexedDBExporter';
import { IndexedDBImporter } from '../backup/database/IndexedDBImporter';
import type { ImportOptions } from '../backup/database/IndexedDBImporter';

// Yedekleme durumunu takip etmek için değişken
let isBackupInProgress = false;

// Unicode/Türkçe karakter yardımcı fonksiyonları
function safeJsonParse(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('JSON parse hatası:', error);
    // Olası karakter kodlama sorunlarını ele al
    // Geçersiz UTF-8 dizileri işle
    const cleanedString = jsonString
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '') // Kontrol karakterlerini temizle
      .replace(/\\u0000/g, ''); // Null byte'ları temizle
    
    try {
      return JSON.parse(cleanedString);
    } catch (innerError) {
      console.error('Temizlenmiş JSON parse hatası:', innerError);
      throw new Error('Veri çözümlenemedi: Unicode karakter hatası olabilir');
    }
  }
}

// UTF-8 safe base64 fonksiyonları
function base64ToUtf8String(base64: string): string {
  try {
    // Modern tarayıcılarda atob kullanarak base64'ten çözme
    const binaryString = atob(base64);
    // UTF-8 çözümleme için karakter kodlamasını handle et
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    // UTF-8 dekode et
    return new TextDecoder('utf-8').decode(bytes);
  } catch (error) {
    console.error('Base64 çözümleme hatası:', error);
    // Fallback normal atob
    return atob(base64);
  }
}

// IndexedDB işlemleri için yardımcı fonksiyonlar
export async function exportDatabases() {
  try {
    const exporter = new IndexedDBExporter();
    return await exporter.exportAllDatabases();
  } catch (error) {
    console.error('Veritabanı dışa aktarma hatası:', error);
    throw error;
  }
}

export async function importDatabases(data: any, options?: ImportOptions) {
  try {
    const importer = new IndexedDBImporter();
    return await importer.importAllDatabases(data, options);
  } catch (error) {
    console.error('Veritabanı içe aktarma hatası:', error);
    throw error;
  }
}

/**
 * Uygulama kapatılırken kapatma onayını gönderir
 * @param {boolean} success - Yedekleme başarılı oldu mu
 */
export function confirmAppClose(success: boolean): void {
  console.log(`Uygulama kapatma onayı gönderiliyor. Yedekleme ${success ? 'başarılı' : 'başarısız'}.`);
  isBackupInProgress = false;
  // Main process'e kapanma onayı gönder
  (window as any).ipcRenderer.send('confirm-app-close');
}

// Backup köprüsünü başlat
export function initBackupBridge(): void {
  // window üzerinden expose edilen API'yi kullan
  // TypeScript için global window nesnesini genişletelim
  const ipcRenderer = (window as any).ipcRenderer;
  
  if (!ipcRenderer) {
    console.error("ipcRenderer API'si bulunamadı! Preload script kontrol edilmeli.");
    return;
  }
  
  // Uygulama kapatma isteğini dinle
  ipcRenderer.on('app-close-requested', () => {
    console.log('Kapatma isteği alındı, yedekleme başlatılacak...');
    // Burada doğrudan bir işlem yapmıyoruz çünkü BackupDialogManager bileşeni bu olayı dinliyor
    // ve yedekleme işlemini o başlatıyor
  });
  
  // Yedekleme durumu için bildirim
  ipcRenderer.on('backup-in-progress-query', () => {
    ipcRenderer.send('backup-in-progress', isBackupInProgress);
  });
  
  // IndexedDB işlemleri için IPC dinleyicileri
  ipcRenderer.on('db-export-request', async () => {
    try {
      console.log('Renderer: IndexedDB verisi dışa aktarılıyor...');
      isBackupInProgress = true;
      const result = await exportDatabases();
      ipcRenderer.send('db-export-response', { success: true, data: result });
      isBackupInProgress = false;
    } catch (error: any) {
      console.error('Renderer: Dışa aktarma hatası:', error);
      isBackupInProgress = false;
      ipcRenderer.send('db-export-response', {
        success: false,
        error: error.message || 'Bilinmeyen hata'
      });
    }
  });

  // YENİ - Eski içe aktarma işleyicisi (hata verdi, artık kullanılmıyor)
  ipcRenderer.on('db-import-request', async (_event: any, data: any, options: any) => {
    try {
      console.log('Renderer: Eski içe aktarma API çağrısı! Bu kullanılmamalı.');
      ipcRenderer.send('db-import-response', {
        success: false,
        error: 'Eski API kullanım dışı, db-import-request-start kullanın'
      });
    } catch (error: any) {
      console.error('Renderer: İçe aktarma hatası:', error);
      ipcRenderer.send('db-import-response', {
        success: false,
        error: error.message || 'Bilinmeyen hata'
      });
    }
  });

  // YENİ - String olarak veri alan içe aktarma işleyicisi
  ipcRenderer.on('db-import-request-start', async (_event: any, dataAsString: string, options: any) => {
    try {
      console.log('Renderer: IndexedDB verisi içe aktarma hazırlığı...');
      isBackupInProgress = true;
      
      // String'i JSON objesine dönüştür - güvenli JSON parse kullan
      const data = safeJsonParse(dataAsString);
      
      console.log('Renderer: IndexedDB verisi içe aktarılıyor...');
      const result = await importDatabases(data, options);
      
      ipcRenderer.send('db-import-response', { success: true, data: result });
      isBackupInProgress = false;
    } catch (error: any) {
      console.error('Renderer: İçe aktarma hatası:', error);
      isBackupInProgress = false;
      ipcRenderer.send('db-import-response', {
        success: false,
        error: error.message || 'Bilinmeyen hata'
      });
    }
  });
  
  // Manuel yedekleme tetikleyicisi
  ipcRenderer.on('trigger-backup', async (event: any, options: any) => {
    try {
      console.log('Renderer: Manuel yedekleme tetiklendi:', options);
      isBackupInProgress = true;
      // backupAPI üzerinden yedeklemeyi başlat
      if ((window as any).backupAPI) {
        await (window as any).backupAPI.createBackup(options);
      }
      isBackupInProgress = false;
    } catch (error: any) {
      console.error('Renderer: Manuel yedekleme hatası:', error);
      isBackupInProgress = false;
    }
  });

  ipcRenderer.on('db-import-request-file', async (_event: any, tempFilePath: string, options: any) => {
    try {
      console.log('Renderer: Geçici dosyadan veri okunuyor...');
      isBackupInProgress = true;
      
      // Dosya okuma API'sini kullanarak geçici dosyayı oku - UTF-8 olarak belirt
      const response = await fetch(`file://${tempFilePath}`);
      if (!response.ok) {
        throw new Error(`Dosya okunamadı: ${response.statusText}`);
      }
      
      // UTF-8 olarak metni oku
      const dataAsString = await response.text();
      
      // String'i JSON objesine dönüştür - güvenli JSON parse kullan
      const data = safeJsonParse(dataAsString);
      
      console.log('Renderer: IndexedDB verisi içe aktarılıyor...');
      const result = await importDatabases(data, options);
      
      ipcRenderer.send('db-import-response', { success: true, data: result });
      isBackupInProgress = false;
    } catch (error: any) {
      console.error('Renderer: İçe aktarma hatası:', error);
      isBackupInProgress = false;
      ipcRenderer.send('db-import-response', {
        success: false,
        error: error.message || 'Bilinmeyen hata'
      });
    }
  });

  // Daha basit bir dinleyici
  ipcRenderer.on('db-import-request-file-simple', async (_event: unknown, tempFilePath: string) => {
    try {
      console.log('Renderer: Basit dosya oku/içe aktar işlemi başladı');
      isBackupInProgress = true;
      
      // Dosya okuma API'sini kullanarak geçici dosyayı oku - UTF-8 olarak belirt
      const response = await fetch(`file://${tempFilePath}`);
      if (!response.ok) {
        throw new Error(`Dosya okunamadı: ${response.statusText}`);
      }
      
      // UTF-8 olarak metni oku
      const dataAsString = await response.text();
      
      // String'i JSON objesine dönüştür - güvenli JSON parse kullan
      const data = safeJsonParse(dataAsString);
      
      console.log('Renderer: IndexedDB verisi içe aktarılıyor...');
      // Varsayılan olarak clearExisting true olarak ayarla
      const result = await importDatabases(data, { clearExisting: true });
      
      ipcRenderer.send('db-import-response', { success: true, data: result });
      isBackupInProgress = false;
    } catch (error: any) {
      console.error('Renderer: İçe aktarma hatası:', error);
      isBackupInProgress = false;
      ipcRenderer.send('db-import-response', {
        success: false,
        error: error.message || 'Bilinmeyen hata'
      });
    }
  });

  ipcRenderer.on('db-import-base64', async (_event: unknown, base64Data: string) => {
    try {
      console.log('Renderer: Base64 verisi alındı, işleniyor...');
      isBackupInProgress = true;
      
      // Base64'ten UTF-8 string'e dönüştür - özel fonksiyon kullan
      const jsonString = base64ToUtf8String(base64Data);
      
      // JSON string'i parse et - güvenli JSON parse kullan
      const data = safeJsonParse(jsonString);
      
      console.log('Renderer: IndexedDB verisi içe aktarılıyor...');
      // Varsayılan olarak clearExisting true olarak ayarla
      const result = await importDatabases(data, { clearExisting: true });
      
      ipcRenderer.send('db-import-response', { success: true, data: result });
      isBackupInProgress = false;
    } catch (error: any) {
      console.error('Renderer: İçe aktarma hatası:', error);
      isBackupInProgress = false;
      ipcRenderer.send('db-import-response', {
        success: false,
        error: error.message || 'Bilinmeyen hata'
      });
    }
  });

  console.log('Backup köprüsü başlatıldı');
}

// Yardımcı fonksiyonlar
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}