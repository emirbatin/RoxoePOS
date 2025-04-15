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
          
          // Tabloyu içe aktar - upsert stratejisiyle
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
   * Belirli bir tabloyu içe aktarır - upsert stratejisiyle
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
      // 1. Önce verileri geçerliliğini denetle
      let validData = data.filter(item => item !== null && item !== undefined);
      
      // 2. Tarih alanları için ekstra dönüşüm kontrolü
      validData = validData.map(item => this.ensureDateFields(item));

      console.log(`${tableName} tablosuna ${validData.length} kayıt aktarılacak`);
      
      // 3. Geçerli veri yoksa
      if (validData.length === 0) {
        console.warn(`${tableName} için içe aktarılacak geçerli veri bulunamadı!`);
        return { success: false, importedCount: 0 };
      }
      
      // 4. İşlem başlat
      const tx = db.transaction(tableName, 'readwrite');
      const store = tx.objectStore(tableName);
      
      try {
        // Eğer clearExisting seçeneği aktifse
        if (clearExisting) {
          console.log(`${tableName} tablosu temizleniyor (clearExisting=true)...`);
          await store.clear();
        }
        
        // 5. Store'un keyPath bilgisini al (birincil anahtar)
        const keyPath = store.keyPath as string;
        console.log(`${tableName} tablosunun birincil anahtarı: ${keyPath || 'null (auto-increment)'}`);
        
        // 6. Verileri aktar - upsert yaklaşımı
        let importedCount = 0;
        let updateCount = 0;
        let insertCount = 0;
        let errorCount = 0;
        
        for (const item of validData) {
          try {
            // Birincil anahtar değerini kontrol et
            const keyValue = keyPath && typeof keyPath === 'string' ? item[keyPath] : undefined;
            
            if (keyValue !== undefined && !clearExisting) {
              // Kayıt zaten var mı kontrol et
              try {
                const existingItem = await store.get(keyValue);
                
                if (existingItem) {
                  // Güncelleme
                  await store.put(item);
                  updateCount++;
                } else {
                  // Yeni kayıt
                  await store.add(item);
                  insertCount++;
                }
              } catch (getError) {
                // Kayıt bulma hatası - normal eklemeye çalış
                console.warn(`Var olan kayıt kontrolünde hata, normal eklemeye çalışılıyor: ${getError}`);
                await store.put(item);
                importedCount++;
              }
            } else {
              // clearExisting true ise veya birincil anahtar yok ise
              // Normal ekleme yap
              if (clearExisting) {
                // Temizleme yapıldığı için doğrudan ekle
                await store.add(item);
                insertCount++;
              } else {
                // Temizleme yapılmadı, put ile ekle/güncelle
                await store.put(item);
                insertCount++; // Aslında bazıları güncelleme olabilir ama ID eşleşmesi olmadığından sayamıyoruz
              }
            }
            
            importedCount++;
            
            // İlerleme bildirimi
            if (onProgress && importedCount % 10 === 0) {
              onProgress(importedCount);
            }
          } catch (error) {
            errorCount++;
            console.error(`Veri aktarılamadı (${errorCount}/${validData.length}):`, error);
            if (errorCount <= 5) {
              console.error('Hatalı veri:', JSON.stringify(item).substring(0, 200) + '...');
            }
          }
        }
        
        // Son ilerleme bildirimi
        if (onProgress) {
          onProgress(importedCount);
        }
        
        // İşlemi tamamla
        await tx.done;
        
        // Sonucu bildir
        console.log(`${tableName} için veri aktarımı tamamlandı:
          Toplam: ${importedCount}/${validData.length}
          Güncellenen: ${updateCount}
          Eklenen: ${insertCount}
          Hata: ${errorCount}`);
        
        return { success: true, importedCount };
      } catch (txError) {
        console.error(`${tableName} işlemi sırasında hata:`, txError);
        return { success: false, importedCount: 0 };
      }
    } catch (error) {
      console.error(`${tableName} tablosu içe aktarılamadı:`, error);
      return { success: false, importedCount: 0 };
    }
  }

  /**
   * Nesnedeki tarih alanlarını kontrol eder ve gerekirse dönüştürür
   */
  private ensureDateFields(item: any): any {
    if (!item) return item;
    
    // Nesne değilse doğrudan döndür
    if (typeof item !== 'object') return item;
    
    // Dizi kontrolü
    if (Array.isArray(item)) {
      return item.map(el => this.ensureDateFields(el));
    }
    
    // Nesneyi işle
    const result = {...item};
    
    for (const key in result) {
      const value = result[key];
      
      // __isDate formatında özel işaretlenmiş alan kontrolü
      if (value && typeof value === 'object' && value.__isDate === true && value.value) {
        try {
          result[key] = new Date(value.value);
          continue; // Sonraki alana geç
        } catch (e) {
          console.error(`Tarih dönüştürme hatası (${key}):`, e);
          // Hatalı tarih alanını null yap - veri bütünlüğünü korumak için
          result[key] = null;
          continue;
        }
      }
      
      // String tarih kontrolü (ISO formatını tespit et)
      if (typeof value === 'string' && 
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d{3})?Z$/.test(value)) {
        try {
          result[key] = new Date(value);
          continue;
        } catch (e) {
          // Başarısız olursa dokunma
        }
      }
      
      // İç içe nesne veya dizi kontrolü
      if (value && typeof value === 'object') {
        result[key] = this.ensureDateFields(value);
      }
    }
    
    return result;
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