// src/types/backup.ts

// Yedek dosyası için meta veri yapısı
export interface BackupMetadata {
    version: string;                 // Yedek format sürümü
    appVersion: string;              // Uygulama sürümü
    createdAt: string;               // Oluşturma zamanı (ISO string)
    description?: string;            // Kullanıcı tanımı
    databases: string[];             // Yedeklenen veritabanları
    recordCounts: Record<string, number>; // Tablo başına kayıt sayıları
    backupType: 'full';              // Tam veya kademeli yedek
    dataFormat: 'compressed';        // Veri formatı 
    compressionMethod: 'lz-string';  // Sıkıştırma yöntemi
    checksum: string;                // Veri bütünlüğü kontrolü
  }
  
  // Yedekleme dosyası yapısı
  export interface BackupFile {
    metadata: BackupMetadata;
    data: BackupData;
  }
  
  // Veritabanı verilerinin yapısı
  export interface BackupData {
    [dbName: string]: {
      [storeName: string]: any[];  // Her store için veri dizisi
    };
  }
  
  // Yedekleme ayarları
  export interface BackupSettings {
    autoBackup: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    maxBackups: number;
    compressData: boolean;
    encryptData: boolean;
    backupPath?: string;
  }
  
  // Geri yükleme seçenekleri
  export interface RestoreOptions {
    clearExistingData: boolean;
    restoreAll: boolean;
    selectedDatabases?: string[];
  }
  
  // Yedek dosyası bilgisi
  export interface BackupHistory {
    id: string;
    filename: string;
    createdAt: string;
    description?: string;
    size: number;
    databases: string[];
    records: Record<string, number>;
  }
  
  // Yedekleme durumu
  export interface BackupProgress {
    status: 'idle' | 'running' | 'completed' | 'failed';
    message?: string;
    progress: number; // 0-100
    currentOperation?: string;
    error?: string;
  }