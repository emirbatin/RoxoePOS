/**
 * Yedekleri IndexedDB'ye geri yükleyecek servis
 */

import { openDB, IDBPDatabase } from 'idb';
import DBVersionHelper from '../../helpers/DBVersionHelper';

export interface ImportResult {
  success: boolean;
  importedDatabases: string[];
  importedRecords: number;
  errors: Array<{ database: string, store: string, error: string }>;
}

export interface ImportOptions {
  clearExisting?: boolean;
  onProgress?: (database: string, store: string, processed: number, total: number) => void;
}

export class IndexedDBImporter {
  /**
   * Tüm veritabanlarını içe aktarır
   * @param data İçe aktarılacak veri
   * @param options İçe aktarma seçenekleri
   * @returns İçe aktarma sonucu
   */
  async importAllDatabases(data: Record<string, any>, options?: ImportOptions): Promise<ImportResult> {
    console.log('Tüm veritabanları içe aktarılıyor...');
    
    const result: ImportResult = {
      success: true,
      importedDatabases: [],
      importedRecords: 0,
      errors: []
    };
    
    // Veri kontrolü
    if (!data || typeof data !== 'object') {
      result.success = false;
      result.errors.push({ 
        database: 'unknown', 
        store: 'unknown', 
        error: 'Geçersiz yedek formatı. Veri bulunamadı.' 
      });
      return result;
    }
    
    // Her veritabanını içe aktar
    for (const [dbName, dbData] of Object.entries(data)) {
      try {
        console.log(`${dbName} veritabanı içe aktarılıyor...`);
        const { success, importedRecords, errors } = await this.importDatabase(dbName, dbData, options);
        
        if (success) {
          result.importedDatabases.push(dbName);
          result.importedRecords += importedRecords;
        }
        
        // Hataları ekle
        result.errors.push(...errors);
        
        // Genel başarıyı güncelle
        if (!success) {
          result.success = false;
        }
      } catch (error) {
        console.error(`${dbName} veritabanı içe aktarılamadı:`, error);
        result.success = false;
        result.errors.push({ 
          database: dbName, 
          store: 'unknown', 
          error: `Veritabanı içe aktarılamadı: ${(error as Error).message}` 
        });
      }
    }
    
    return result;
  }

  /**
   * Belirli bir veritabanını içe aktarır
   * @param dbName Veritabanı adı
   * @param dbData İçe aktarılacak veri
   * @param options İçe aktarma seçenekleri
   * @returns İçe aktarma sonucu
   */
  async importDatabase(
    dbName: string, 
    dbData: Record<string, any[]>, 
    options?: ImportOptions
  ): Promise<{ success: boolean; importedRecords: number; errors: Array<{ database: string, store: string, error: string }> }> {
    const result = {
      success: true,
      importedRecords: 0,
      errors: [] as Array<{ database: string, store: string, error: string }>
    };
    
    try {
      // Veritabanı sürümünü al
      const dbVersion = DBVersionHelper.getVersion(dbName);
      
      // Veritabanını aç
      const db = await openDB(dbName, dbVersion);
      const storeNames = Array.from(db.objectStoreNames);
      
      // Her tabloyu içe aktar
      for (const [storeName, storeData] of Object.entries(dbData)) {
        try {
          // Store var mı kontrol et
          if (!storeNames.includes(storeName)) {
            result.errors.push({ 
              database: dbName, 
              store: storeName, 
              error: `Tablo bulunamadı: ${storeName}` 
            });
            continue;
          }
          
          console.log(`${storeName} tablosu içe aktarılıyor...`);
          
          // İlerleme bildirimi için hazırlık
          const totalRecords = storeData.length;
          let processedRecords = 0;
          
          // Tabloyu içe aktar
          const { success, importedCount } = await this.importTable(
            db, 
            storeName, 
            storeData,
            options?.clearExisting || false,
            (processed) => {
              processedRecords = processed;
              if (options?.onProgress) {
                options.onProgress(dbName, storeName, processed, totalRecords);
              }
            }
          );
          
          if (success) {
            result.importedRecords += importedCount;
          } else {
            result.success = false;
            result.errors.push({ 
              database: dbName, 
              store: storeName, 
              error: `Tabloya veri aktarılamadı` 
            });
          }
        } catch (error) {
          console.error(`${storeName} tablosu içe aktarılamadı:`, error);
          result.success = false;
          result.errors.push({ 
            database: dbName, 
            store: storeName, 
            error: `Tablo içe aktarılamadı: ${(error as Error).message}` 
          });
        }
      }
      
      db.close();
      
    } catch (error) {
      console.error(`${dbName} veritabanı açılamadı:`, error);
      result.success = false;
      result.errors.push({ 
        database: dbName, 
        store: 'unknown', 
        error: `Veritabanı açılamadı: ${(error as Error).message}` 
      });
    }
    
    return result;
  }

  /**
   * Belirli bir tabloyu içe aktarır
   * @param db Veritabanı bağlantısı
   * @param tableName Tablo adı
   * @param data İçe aktarılacak veri
   * @param clearExisting Mevcut verileri temizle
   * @param onProgress İlerleme bildirimi
   * @returns İçe aktarma başarılı mı
   */
  async importTable(
    db: IDBPDatabase, 
    tableName: string, 
    data: any[], 
    clearExisting: boolean,
    onProgress?: (processedCount: number) => void
  ): Promise<{ success: boolean; importedCount: number }> {
    try {
      const tx = db.transaction(tableName, 'readwrite');
      const store = tx.objectStore(tableName);
      
      // Önceki verileri temizle
      if (clearExisting) {
        await store.clear();
      }
      
      // Verileri ekle
      let importedCount = 0;
      for (const item of data) {
        try {
          // PrimaryKey'e sahip olabileceğinden put kullan
          await store.put(item);
          importedCount++;
          
          // İlerleme bildirimi
          if (onProgress && importedCount % 10 === 0) {
            onProgress(importedCount);
          }
        } catch (error) {
          console.error(`Veri aktarılamadı:`, error, item);
        }
      }
      
      // Son ilerleme bildirimi
      if (onProgress) {
        onProgress(importedCount);
      }
      
      await tx.done;
      
      return { success: true, importedCount };
    } catch (error) {
      console.error(`${tableName} tablosu içe aktarılamadı:`, error);
      return { success: false, importedCount: 0 };
    }
  }

  /**
   * Veritabanını temizler
   * @param dbName Veritabanı adı
   */
  async clearDatabase(dbName: string): Promise<void> {
    console.log(`${dbName} veritabanı temizleniyor...`);
    
    try {
      // Veritabanı sürümünü al
      const dbVersion = DBVersionHelper.getVersion(dbName);
      
      // Veritabanını aç
      const db = await openDB(dbName, dbVersion);
      const storeNames = Array.from(db.objectStoreNames);
      
      // Her tabloyu temizle
      for (const storeName of storeNames) {
        const tx = db.transaction(storeName, 'readwrite');
        await tx.objectStore(storeName).clear();
        await tx.done;
      }
      
      db.close();
      
      console.log(`${dbName} veritabanı temizlendi`);
    } catch (error) {
      console.error(`${dbName} veritabanı temizlenemedi:`, error);
      throw error;
    }
  }
}