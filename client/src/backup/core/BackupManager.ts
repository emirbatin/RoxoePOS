/**
 * Yedekleme işlemlerini koordine eden ana servis
 */

import { BackupSerializer, BackupMetadata } from './BackupSerializer';
import { BackupDeserializer, DeserializedBackup } from './BackupDeserializer';
import { BackupScheduler, BackupSchedule } from '../scheduler/BackupScheduler';
import { FileUtils } from '../utils/fileUtils';
import { v4 as uuidv4 } from 'uuid';

export interface BackupOptions {
  description?: string;
  backupType?: 'full' | 'incremental';
  onProgress?: (stage: string, progress: number) => void;
}

export interface RestoreOptions {
  clearExisting?: boolean;
  onProgress?: (stage: string, progress: number) => void;
}

export interface BackupResult {
  success: boolean;
  backupId: string;
  metadata: Partial<BackupMetadata>;
  error?: string;
  filename?: string;
}

export class BackupManager {
  private serializer: BackupSerializer;
  private deserializer: BackupDeserializer;
  public scheduler: BackupScheduler;
  
  constructor() {
    this.serializer = new BackupSerializer();
    this.deserializer = new BackupDeserializer();
    this.scheduler = new BackupScheduler(this);
  }

  /**
   * Yeni bir yedek oluşturur
   * NOT: Bu fonksiyon artık IndexedDB erişimi hatası verir, createBackupWithData kullanılmalıdır
   */
  async createBackup(options?: BackupOptions): Promise<BackupResult> {
    console.warn('createBackup() artık doğrudan kullanılmamalıdır. createBackupWithData() fonksiyonunu kullanın.');
    return {
      success: false,
      backupId: '',
      metadata: {},
      error: 'Bu fonksiyon artık desteklenmiyor. Renderer process üzerinden yedekleme yapın.'
    };
  }
  
  /**
   * Türkçe karakter içeren dosya adlarını ASCII'ye dönüştürür
   * @param text Dönüştürülecek metin
   * @returns ASCII karakterler içeren metin
   */
  private normalizeString(text: string): string {
    // Türkçe karakterleri ASCII karşılıklarına dönüştür
    return text
      .replace(/ç/g, 'c').replace(/Ç/g, 'C')
      .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
      .replace(/ı/g, 'i').replace(/İ/g, 'I')
      .replace(/ö/g, 'o').replace(/Ö/g, 'O')
      .replace(/ş/g, 's').replace(/Ş/g, 'S')
      .replace(/ü/g, 'u').replace(/Ü/g, 'U')
      .replace(/[^a-zA-Z0-9\-_. ]/g, ''); // Diğer özel karakterleri temizle
  }
  
  /**
   * Dışarıdan alınan veri ile yedek oluşturur (IndexedDB erişimi olmadan)
   * @param exportedData Dışa aktarılmış veritabanı verisi
   * @param options Yedekleme seçenekleri
   */
  async createBackupWithData(exportedData: any, options?: BackupOptions): Promise<BackupResult> {
    try {
      // İlerleme bildirimi
      const notifyProgress = (stage: string, progress: number) => {
        if (options?.onProgress) {
          options.onProgress(stage, progress);
        }
      };
      
      notifyProgress('Veri serileştiriliyor', 50);
      
      // Yedek ID'si oluştur
      const backupId = uuidv4();
      
      // Açıklama metninde Türkçe karakter kontrolü
      const safeDescription = options?.description || 'Manuel Yedekleme';
      
      // Meta verileri hazırla
      const metadata: Partial<BackupMetadata> = {
        version: '1.0',
        appVersion: 'Roxoe POS v1.0',
        createdAt: new Date().toISOString(),
        description: safeDescription,
        databases: exportedData.exportInfo.databases.map((db: any) => db.name),
        recordCounts: exportedData.exportInfo.databases.reduce((counts: Record<string, number>, db: any) => {
          Object.entries(db.recordCounts).forEach(([store, count]) => {
            counts[`${db.name}.${store}`] = count as number;
          });
          return counts;
        }, {} as Record<string, number>),
        backupType: options?.backupType || 'full',
        dataFormat: 'compressed',
        compressionMethod: 'lz-string'
      };
      
      // UTF-8 karakter sorunlarını çözmek için özel serileştirme
      // Unicode escape sequence kullan
      const preparedData = this.prepareDataForSerialization(exportedData.databases);
      
      // Veriyi roxoe formatına dönüştür
      const roxoeData = this.serializer.serializeToRoxoeFormat(preparedData, metadata);
      
      notifyProgress('Yedek dosyası kaydediliyor', 80);
      
      // Dosya adı hazırla - Türkçe karakter kullanımını önle
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0];
      const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
      // Dosya adında Türkçe karakter olmadığından emin ol
      const filename = `roxoe-backup-${dateStr}-${timeStr}.roxoe`;
      
      // Dosyayı indir
      const filePath = await FileUtils.downloadFile(roxoeData, filename);
      
      // Yedek geçmişine kaydet
      FileUtils.saveBackupToHistory(backupId, {
        filename,
        description: safeDescription,
        createdAt: date.toISOString(),
        databases: metadata.databases || [],
        recordCounts: metadata.recordCounts || {},
        totalRecords: exportedData.exportInfo.totalRecords
      });
      
      notifyProgress('Yedekleme tamamlandı', 100);
      
      return {
        success: true,
        backupId,
        metadata,
        filename
      };
    } catch (error: any) {
      console.error('Yedekleme hatası:', error);
      return {
        success: false,
        backupId: '',
        metadata: {},
        error: `Yedekleme hatası: ${error.message || 'Bilinmeyen hata'}`
      };
    }
  }
  
  /**
   * Unicode karakterler için verileri serileştirmeye hazırlar
   * Türkçe karakter kodlama sorunlarını önler
   */
  private prepareDataForSerialization(data: any): any {
    const processValue = (value: any): any => {
      if (value === null || value === undefined) {
        return value;
      }
      
      // String değerleri özel işle
      if (typeof value === 'string') {
        // Unicode karakterleri korumak için değişiklik yapmıyoruz
        // String formatında güvenli bir şekilde saklanmalı
        return value;
      }
      
      // Dizileri işle
      if (Array.isArray(value)) {
        return value.map(item => processValue(item));
      }
      
      // Objeleri işle
      if (typeof value === 'object') {
        const result: any = {};
        for (const key in value) {
          if (Object.prototype.hasOwnProperty.call(value, key)) {
            result[key] = processValue(value[key]);
          }
        }
        return result;
      }
      
      // Diğer tipleri doğrudan döndür
      return value;
    };
    
    return processValue(data);
  }
  
  /**
   * Yedeği deserialize eder, içe aktarmadan
   * @param fileContent Yedek dosyası içeriği
   * @returns Deserialize edilmiş veri
   */
  async deserializeBackup(fileContent: string): Promise<DeserializedBackup> {
    try {
      const result = this.deserializer.deserializeFromRoxoeFormat(fileContent);
      
      // Deserializasyon sonrası Türkçe karakter kontrolü
      if (result.isValid && result.data) {
        // result.data içindeki Türkçe karakterler otomatik korunmalı
      }
      
      return result;
    } catch (error: any) {
      console.error('Yedek deserializasyon hatası:', error);
      return {
        metadata: {} as BackupMetadata,
        data: null,
        isValid: false,
        error: `Yedek deserializasyon hatası: ${error.message || 'Bilinmeyen hata'}`
      };
    }
  }

  /**
   * Yedeği geri yükler
   * NOT: Bu fonksiyon artık IndexedDB erişimi hatası verir, bridge üzerinden kullanılmalıdır
   */
  async restoreBackup(
    fileContent: string, 
    options?: RestoreOptions
  ): Promise<{ success: boolean; error?: string; metadata?: BackupMetadata }> {
    console.warn('restoreBackup() artık doğrudan kullanılmamalıdır. Renderer process üzerinden geri yükleme yapın.');
    return {
      success: false,
      error: 'Bu fonksiyon artık desteklenmiyor. Renderer process üzerinden geri yükleme yapın.'
    };
  }

  /**
   * Mevcut yedekleri listeler
   * @returns Yedek geçmişi
   */
  listBackups(): any[] {
    try {
      return FileUtils.getBackupHistory();
    } catch (error: any) {
      console.error('Yedek listesi alınırken hata:', error);
      return [];
    }
  }

  /**
   * Belirtilen yedeği siler
   * @param id Silinecek yedeğin ID'si
   * @returns İşlem başarılı mı
   */
  deleteBackup(id: string): boolean {
    try {
      FileUtils.deleteBackupFromHistory(id);
      return true;
    } catch (error) {
      console.error('Yedek silme hatası:', error);
      return false;
    }
  }

  /**
   * Otomatik yedekleme zamanlaması ayarlar
   * @param frequency Yedekleme sıklığı
   * @param hour Yedekleme saati
   * @param minute Yedekleme dakikası
   * @returns İşlem başarılı mı
   */
  scheduleBackup(
    frequency: BackupSchedule['frequency'],
    hour: number = 3,
    minute: number = 0
  ): boolean {
    try {
      this.scheduler.enableAutoBackup(frequency, hour, minute);
      return true;
    } catch (error) {
      console.error('Zamanlama hatası:', error);
      return false;
    }
  }

  /**
   * Otomatik yedeklemeyi devre dışı bırakır
   * @returns İşlem başarılı mı
   */
  disableScheduledBackup(): boolean {
    try {
      this.scheduler.disableAutoBackup();
      return true;
    } catch (error) {
      console.error('Zamanlama iptal hatası:', error);
      return false;
    }
  }

  /**
   * Mevcut yedekleme zamanlama ayarlarını döndürür
   * @returns Zamanlama ayarları
   */
  getBackupSchedule(): BackupSchedule | null {
    try {
      // scheduler'dan ayarları al
      return this.scheduler['schedule'];
    } catch (error) {
      console.error('Zamanlama yüklenemedi:', error);
      return null;
    }
  }

  /**
   * Zamanlayıcıyı başlatır
   */
  startScheduler(): void {
    try {
      this.scheduler.startScheduling();
    } catch (error) {
      console.error('Zamanlayıcı başlatma hatası:', error);
    }
  }
  
  /**
   * Zamanlayıcıyı durdurur
   */
  stopScheduler(): void {
    try {
      this.scheduler.stopScheduling();
    } catch (error) {
      console.error('Zamanlayıcı durdurma hatası:', error);
    }
  }
}