/**
 * IndexedDBImporter.ts
 * * Yedekleri IndexedDB'ye geri yükleyecek servis.
 * Veritabanı sürümünü DBVersionHelper'dan alır ve idb kütüphanesinin
 * upgrade callback'ini kullanarak şemayı günceller.
 */

import { openDB, IDBPDatabase, IDBPTransaction, DBSchema } from 'idb';
// DBVersionHelper'ı kendi projenizdeki doğru yoldan import edin
import DBVersionHelper from '../../helpers/DBVersionHelper'; 

// --- Veritabanı Şemalarını Tanımlama (Tip Güvenliği İçin Önerilir) ---
// Kendi veri modellerinizle (interface/type) güncelleyin. 'any' yerine kullanın.
interface PosDBSchema extends DBSchema {
  products: { key: string; value: any; }; // products: { key: string; value: Product; }; gibi
  categories: { key: string; value: any; };
  productGroups: { key: number; value: any; };
  // productGroupRelations keyPath'inin ['groupId', 'productId'] olduğunu varsayıyoruz (loglardan) - DOĞRULAYIN!
  productGroupRelations: { key: [number, string]; value: any; }; 
  cashRegisterSessions: { key: string; value: any; };
  cashTransactions: { key: string; value: any; };
  // TODO: posDB için diğer store'ları buraya ekleyin (varsa)
}

interface SalesDBSchema extends DBSchema {
  sales: { key: string; value: any; }; // sales: { key: string; value: Sale; }; gibi
  // TODO: salesDB için diğer store'ları buraya ekleyin (varsa)
}

interface CreditDBSchema extends DBSchema {
  customers: { key: string; value: any; }; // customers: { key: string; value: Customer; }; gibi
  transactions: { key: string; value: any; }; // transactions: { key: string; value: CreditTransaction; }; gibi
  // TODO: creditDB için diğer store'ları buraya ekleyin (varsa)
}

// --- İçe Aktarma İçin Interface'ler ---
export interface ImportResult {
  success: boolean;
  importedDatabases: string[];
  importedRecords: number;
  errors: Array<{ database: string, store: string, error: string }>;
}

export interface ImportOptions {
  /** Mevcut veritabanı tablolarını içe aktarmadan önce temizle */
  clearExisting?: boolean; 
  /** İlerleme durumu bildirimi için callback */
  onProgress?: (database: string, store: string, processed: number, total: number) => void;
}

/**
 * Yedek verilerini IndexedDB'ye aktarmak için sınıf.
 */
export class IndexedDBImporter {
  /**
   * Yedekten alınan tüm veritabanlarını içe aktarır.
   * @param data - İçe aktarılacak veritabanı verilerini içeren nesne (örn: { posDB: { products: [...] }, salesDB: { ... } }).
   * @param options - İçe aktarma seçenekleri (clearExisting, onProgress).
   * @returns İçe aktarma işleminin sonucunu içeren bir Promise.
   */
  async importAllDatabases(data: Record<string, any>, options?: ImportOptions): Promise<ImportResult> {
    console.log('Tüm veritabanları içe aktarılıyor...');
    const result: ImportResult = {
      success: true,
      importedDatabases: [],
      importedRecords: 0,
      errors: []
    };

    // Gelen verinin geçerli bir nesne olup olmadığını kontrol et
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      result.success = false;
      result.errors.push({
        database: 'unknown',
        store: 'unknown',
        error: 'Geçersiz yedek formatı veya boş veri.'
      });
      console.error('İçe aktarma hatası: Geçersiz yedek formatı veya boş veri.');
      return result;
    }

    // Yedek verisindeki her bir veritabanı için döngü
    for (const [dbName, dbData] of Object.entries(data)) {
      // Veritabanı verisinin (dbData) bir nesne olduğunu ve tabloları içerdiğini kontrol et
      if (typeof dbData !== 'object' || dbData === null) {
          console.warn(`${dbName} için geçersiz veri formatı, atlanıyor.`);
          result.errors.push({ database: dbName, store: 'unknown', error: 'Veritabanı verisi nesne değil, atlandı.'});
          continue; // Sonraki veritabanına geç
      }
        
      try {
        console.log(`"${dbName}" veritabanı içe aktarılıyor...`);
        // Her bir veritabanını içe aktarma fonksiyonunu çağır
        const dbResult = await this.importDatabase(dbName, dbData, options);

        // Sonuçları genel sonuca ekle
        if (dbResult.success) {
          result.importedDatabases.push(dbName);
          result.importedRecords += dbResult.importedRecords;
        } else {
           // Eğer en az bir veritabanı başarısız olursa genel sonuç başarısızdır
          result.success = false; 
        }
        result.errors.push(...dbResult.errors);
        
      } catch (error) {
        // importDatabase fonksiyonundan beklenmedik bir hata gelirse
        console.error(`"${dbName}" veritabanı içe aktarılırken kritik hata:`, error);
        result.success = false;
        result.errors.push({
          database: dbName,
          store: 'unknown',
          error: `Kritik içe aktarma hatası: ${(error instanceof Error ? error.message : String(error))}`
        });
      }
    }

    console.log('Tüm veritabanlarını içe aktarma işlemi tamamlandı.', result.success ? 'Başarılı.' : 'Hatalar var.');
    return result;
  }

  /**
   * Belirli bir IndexedDB veritabanını yedek verisinden içe aktarır.
   * Gerekirse veritabanı şemasını günceller.
   * @param dbName - İçe aktarılacak veritabanının adı.
   * @param dbData - Bu veritabanına ait tablo verilerini içeren nesne (örn: { products: [...], categories: [...] }).
   * @param options - İçe aktarma seçenekleri.
   * @returns Bu veritabanı için içe aktarma sonucunu içeren bir Promise.
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

    let db: IDBPDatabase<any> | null = null; // Şema tipleri birleştirilebilir: IDBPDatabase<PosDBSchema | SalesDBSchema | CreditDBSchema>

    try {
      // 1. Adım: Gerekli veritabanı sürümünü merkezi yerden al
      const requiredVersion = DBVersionHelper.getVersion(dbName);
      console.log(`"${dbName}" veritabanı açılıyor/yükseltiliyor (Hedef Sürüm: ${requiredVersion})...`);

      // 2. Adım: Veritabanını aç (idb kütüphanesi ile) ve upgrade callback'ini tanımla
      db = await openDB(dbName, requiredVersion, {
        /**
         * Veritabanı sürümü yükseltilmesi gerektiğinde çalışır.
         * Eksik object store'ları ve index'leri oluşturur.
         */
        upgrade(innerDb, oldVersion, newVersion, transaction) {
          console.log(`"${dbName}" veritabanı ${oldVersion} sürümünden ${newVersion} sürümüne yükseltiliyor...`);

          // Veritabanı adına göre şema oluşturma/güncelleme mantığı
          switch (dbName) {
            case 'posDB':
              // --- posDB Şeması ---
              // TODO: Kendi şemanızla buradaki store ve keyPath'leri DOĞRULAYIN!
              if (!innerDb.objectStoreNames.contains('products')) {
                innerDb.createObjectStore('products', { keyPath: 'id' });
                console.log('  -> "products" store oluşturuldu (posDB).');
              }
              if (!innerDb.objectStoreNames.contains('categories')) {
                innerDb.createObjectStore('categories', { keyPath: 'id' });
                console.log('  -> "categories" store oluşturuldu (posDB).');
              }
              if (!innerDb.objectStoreNames.contains('productGroups')) {
                innerDb.createObjectStore('productGroups', { keyPath: 'id' });
                console.log('  -> "productGroups" store oluşturuldu (posDB).');
              }
              // KeyPath'in dizi olup olmadığını kontrol edin! Loglarda [groupId, productId] idi.
              if (!innerDb.objectStoreNames.contains('productGroupRelations')) {
                innerDb.createObjectStore('productGroupRelations', { keyPath: ['groupId', 'productId'] });
                console.log('  -> "productGroupRelations" store oluşturuldu (posDB, keyPath: [groupId, productId]).');
              }
              if (!innerDb.objectStoreNames.contains('cashRegisterSessions')) {
                innerDb.createObjectStore('cashRegisterSessions', { keyPath: 'id' });
                console.log('  -> "cashRegisterSessions" store oluşturuldu (posDB).');
              }
              if (!innerDb.objectStoreNames.contains('cashTransactions')) {
                innerDb.createObjectStore('cashTransactions', { keyPath: 'id' });
                console.log('  -> "cashTransactions" store oluşturuldu (posDB).');
              }
              // Başka store veya index'ler varsa buraya ekleyin...
              break;

            case 'salesDB':
              // --- salesDB Şeması ---
              if (!innerDb.objectStoreNames.contains('sales')) {
                innerDb.createObjectStore('sales', { keyPath: 'id' });
                console.log('  -> "sales" store oluşturuldu (salesDB).');
              }
              // Başka store veya index'ler varsa buraya ekleyin...
              break;

            case 'creditDB':
              // --- creditDB Şeması ---
               // TODO: Kendi şemanızla buradaki store ve keyPath'leri DOĞRULAYIN!
              if (!innerDb.objectStoreNames.contains('customers')) {
                innerDb.createObjectStore('customers', { keyPath: 'id' });
                console.log('  -> "customers" store oluşturuldu (creditDB).');
              }
              if (!innerDb.objectStoreNames.contains('transactions')) {
                innerDb.createObjectStore('transactions', { keyPath: 'id' });
                console.log('  -> "transactions" store oluşturuldu (creditDB).');
              }
              // Başka store veya index'ler varsa buraya ekleyin...
              break;

            default:
              console.warn(`"${dbName}" için upgrade mantığı tanımlanmamış.`);
          }
          console.log(`"${dbName}" veritabanı yükseltme işlemi tamamlandı.`);
        },
        /** Tarayıcı başka bir sekmede eski sürümle açık kalırsa tetiklenir. */
        blocked(currentVersion, blockedVersion, event) {
          console.error(`"${dbName}" veritabanı açma işlemi engellendi! Sürüm: ${currentVersion}, Engellenen Sürüm: ${blockedVersion}. Muhtemelen başka sekmede açık. Lütfen diğer sekmeleri kapatıp tekrar deneyin.`);
          result.success = false; // Engellenme durumunda işlemi başarısız say
          result.errors.push({ database: dbName, store: 'unknown', error: `Veritabanı (${dbName}) başka sekmede açık, işlem engellendi. Diğer sekmeleri kapatın.` });
          // Kullanıcıya uyarı gösterilebilir.
        },
        /** Başka bir sekme veritabanını kapatana kadar beklenildiğinde tetiklenir. */
        blocking(currentVersion, blockedVersion, event) {
          console.warn(`"${dbName}" veritabanı eski sürüm bağlantılarının (${currentVersion}) kapatılmasını bekliyor (Hedef: ${blockedVersion})...`);
          // Gerekirse db.close() çağrısı ile mevcut bağlantıyı kapatmaya çalışabiliriz.
          // Ancak idb genellikle bunu yönetir.
          if (db) db.close();
        },
        /** Bağlantı beklenmedik şekilde (örn. tarayıcı kapanması) sonlandırıldığında. */
        terminated() {
          console.error(`"${dbName}" veritabanı bağlantısı beklenmedik şekilde sonlandırıldı!`);
          // Bu genellikle uygulama kapanırken olur, import sırasında olması beklenmez.
          // Eğer import sırasında olursa, işlemi başarısız say.
           if (!result.success) { // Zaten başarılı değilse tekrar işaretleme
               result.success = false;
               result.errors.push({ database: dbName, store: 'unknown', error: 'Veritabanı bağlantısı beklenmedik şekilde sonlandırıldı.' });
           }
        }
      });

      // 3. Adım: Veritabanı başarıyla açıldıysa, mevcut store'ları al
      console.log(`"${dbName}" veritabanı başarıyla açıldı (Güncel Sürüm: ${db.version}).`);
      const storeNames = Array.from(db.objectStoreNames);
      console.log(`  -> Mevcut store'lar: [${storeNames.join(', ')}]`);

      // 4. Adım: Yedek verisindeki her bir tablo için veriyi içe aktar
      for (const [storeName, storeData] of Object.entries(dbData)) {
          
        // Yedek verisindeki storeData'nın bir dizi olduğunu kontrol et
        if (!Array.isArray(storeData)) {
            console.warn(`"${dbName}.${storeName}" için geçersiz veri formatı (dizi bekleniyordu), atlanıyor.`);
            result.errors.push({ database: dbName, store: storeName, error: 'Yedek verisi dizi formatında değil, atlandı.'});
            continue; // Sonraki tabloya geç
        }
          
        try {
          // Güvenlik kontrolü: Store veritabanında gerçekten var mı?
          // (upgrade sonrası var olması gerekir, yoksa şema tanımında sorun vardır)
          if (!storeNames.includes(storeName)) {
            console.error(`HATA: "${dbName}.${storeName}" tablosu 'upgrade' işleminden sonra dahi bulunamadı! Lütfen 'upgrade' callback içindeki şema tanımını kontrol edin.`);
            result.success = false; // Bu ciddi bir hatadır, işlemi başarısız say
            result.errors.push({
              database: dbName,
              store: storeName,
              error: `Tablo bulunamadı (upgrade sonrası): ${storeName}. Şema tanımını kontrol edin.`
            });
            continue; // Bu tabloyu atla
          }

          console.log(`  -> "${storeName}" tablosu içe aktarılıyor...`);

          // İlerleme bildirimi için toplam kayıt sayısı
          const totalRecords = storeData.length;
          
          // Tabloyu içe aktarma fonksiyonunu çağır
          const tableResult = await this.importTable(
            db,
            storeName,
            storeData,
            options?.clearExisting ?? false, // clearExisting belirtilmemişse false kabul et
            (processed) => { // onProgress callback'i
              if (options?.onProgress) {
                options.onProgress(dbName, storeName, processed, totalRecords);
              }
            }
          );

          // Tablo aktarım sonucunu işle
          result.importedRecords += tableResult.importedCount;
          if (!tableResult.success) {
            result.success = false; // En az bir tablo başarısızsa genel sonuç başarısızdır
            result.errors.push({
              database: dbName,
              store: storeName,
              error: `"${storeName}" tablosuna veri aktarılırken hata oluştu (detaylar için konsola bakın).`
            });
          }
        } catch (tableError) {
          // importTable fonksiyonundan beklenmedik bir hata gelirse
          console.error(`"${dbName}.${storeName}" tablosu içe aktarılırken kritik hata:`, tableError);
          result.success = false;
          result.errors.push({
            database: dbName,
            store: storeName,
            error: `Tablo aktarımında kritik hata: ${(tableError instanceof Error ? tableError.message : String(tableError))}`
          });
        }
      } // Tablo döngüsü sonu

    } catch (dbError) {
      // openDB veya genel işlem hataları
      console.error(`"${dbName}" veritabanı açılamadı veya işlem sırasında hata:`, dbError);
      result.success = false;
      result.errors.push({
        database: dbName,
        store: 'unknown',
        error: `Veritabanı hatası (${dbName}): ${(dbError instanceof Error ? dbError.message : String(dbError))}`
      });
      // blocked hatası ayrıca ele alındı, bu genellikle diğer hatalar içindir.
      
    } finally {
       // 5. Adım: İşlem bittiğinde veya hata oluştuğunda veritabanı bağlantısını kapat
      if (db) {
        try {
          db.close();
          console.log(`"${dbName}" veritabanı bağlantısı kapatıldı.`);
        } catch (closeError) {
           console.error(`"${dbName}" veritabanı bağlantısı kapatılırken hata: `, closeError);
        }
      }
    }

    console.log(`"${dbName}" veritabanı içe aktarma işlemi tamamlandı. Başarılı: ${result.success}`);
    return result;
  }

  /**
   * Belirli bir tabloya (object store) veriyi içe aktarır.
   * 'put' metodu kullanıldığı için kayıt varsa günceller, yoksa ekler (upsert).
   * @param db - Açık IndexedDB veritabanı bağlantısı.
   * @param tableName - Verinin aktarılacağı tablonun adı.
   * @param data - İçe aktarılacak kayıtları içeren dizi.
   * @param clearExisting - Eğer true ise, içe aktarmadan önce tablodaki tüm mevcut kayıtları siler.
   * @param onProgress - Her X kayıtta bir ilerleme bildirmek için çağrılacak fonksiyon.
   * @returns İşlemin başarısını ve aktarılan kayıt sayısını içeren bir Promise.
   */
  async importTable(
    db: IDBPDatabase<any>,
    tableName: string,
    data: any[],
    clearExisting: boolean,
    onProgress?: (processedCount: number) => void
  ): Promise<{ success: boolean; importedCount: number }> {
    let tx: IDBPTransaction<any, [string], "readwrite"> | null = null;
    let importedCount = 0; // Başarılı olanların sayısı
    let errorCount = 0;    // Hata alanların sayısı
    let processedCount = 0; // Döngüde işlenenlerin sayısı

    try {
      // 1. Veriyi hazırla: Null/undefined filtrele ve tarihleri dönüştür
      let validData = data
        .filter(item => item !== null && item !== undefined)
        .map(item => this.ensureDateFields(item));

      console.log(`  -> "${tableName}": ${validData.length} geçerli kayıt bulundu.`);

      // 2. Aktarılacak veri yoksa işlemi bitir
      if (validData.length === 0) {
        return { success: true, importedCount: 0 };
      }

      // 3. Yazma işlemi (transaction) başlat
      tx = db.transaction(tableName, 'readwrite');
      const store = tx.objectStore(tableName);

      // 4. Gerekirse mevcut tabloyu temizle
      if (clearExisting) {
        console.log(`    -> "${tableName}" temizleniyor (clearExisting=true)...`);
        await store.clear();
        console.log(`    -> "${tableName}" temizlendi.`);
      }

      // 5. Verileri tabloya yaz (put ile upsert)
      console.log(`    -> "${tableName}" verileri yazılıyor...`);
      for (const item of validData) {
        processedCount++;
        try {
          await store.put(item); // put hem ekler hem günceller
          importedCount++; // Başarılı olursa sayacı artır

          // Her 50 kayıtta veya son kayıtta ilerleme bildir (isteğe bağlı)
          if (onProgress && (processedCount % 50 === 0 || processedCount === validData.length)) {
            onProgress(processedCount);
          }
        } catch (putError) {
          errorCount++;
          console.error(`    -> Kayıt aktarılamadı (${tableName}, Kayıt No: ${processedCount}, Hata ${errorCount}):`, putError);
          // Hatalı ilk birkaç veriyi logla (debug için)
          if (errorCount <= 5) {
            try {
              console.error('      -> Hatalı Kayıt Verisi (ilk 300 karakter):', JSON.stringify(item).substring(0, 300) + '...');
            } catch { console.error('      -> Hatalı Kayıt Verisi (Stringify Edilemedi)'); }
          }
          // Hata durumunda bu kaydı atla ve devam et
        }
      } // Kayıt döngüsü sonu

      // 6. İşlemin tamamlanmasını bekle
      await tx.done;

      console.log(`  -> "${tableName}" için veri aktarımı tamamlandı: Toplam Denenen: ${processedCount}, Başarılı: ${importedCount}, Hata: ${errorCount}`);

      // Eğer hiç hata yoksa başarılı sayılır
      return { success: errorCount === 0, importedCount };

    } catch (txError) {
      // Transaction başlatma, store.clear() veya tx.done bekleme sırasındaki hatalar
      console.error(`"${tableName}" tablosu için işlem hatası (Genel Hata):`, txError);
      // İşlem devam ediyorsa iptal etmeye çalış
      if (tx && !tx.done.catch(() => {})) {
         try { tx.abort(); } catch {}
      }
      return { success: false, importedCount: 0 }; // Genel hata = Tamamen başarısız
    }
  }

  /**
   * Yedekten geri yüklenen verideki özel tarih formatını (`{ __isDate: true, value: '...' }`)
   * veya standart ISO string formatını Javascript Date nesnesine dönüştürür.
   * İç içe nesne ve diziler için de çalışır.
   * @param item - Dönüştürülecek veri (nesne, dizi, veya başka bir tip).
   * @returns Dönüştürülmüş veri.
   */
  private ensureDateFields(item: any): any {
    if (!item || typeof item !== 'object') { // Null, undefined, veya nesne/dizi olmayanlar
      return item;
    }

    // Özel işaretli tarih nesnesi kontrolü
    if (item.__isDate === true && typeof item.value === 'string') {
      try {
        return new Date(item.value);
      } catch (e) {
        console.error(`Hatalı özel tarih formatı dönüştürülemedi:`, item, e);
        return null; // Hata durumunda null döndür
      }
    }

    // Dizi ise elemanları tek tek işle
    if (Array.isArray(item)) {
      return item.map(el => this.ensureDateFields(el));
    }

    // Nesne ise her bir özelliğini işle
    const result = { ...item }; // Orijinali değiştirmemek için kopyala
    for (const key in result) {
      if (Object.prototype.hasOwnProperty.call(result, key)) {
          const value = result[key];
          // Standart ISO String kontrolü (YYYY-MM-DDTHH:mm:ss.sssZ)
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) {
             try {
               result[key] = new Date(value);
             } catch (e) {
                 console.warn(`ISO tarih string'i dönüştürülemedi (${key}): ${value}`, e);
                 // Dönüştüremezse olduğu gibi bırakabilir veya null yapabiliriz. Şimdilik bırakalım.
             }
          } else if (value && typeof value === 'object') {
              // İç içe nesne/dizi varsa recursive çağrı
              result[key] = this.ensureDateFields(value);
          }
          // Diğer tiplere dokunma (sayı, boolean vb.)
      }
    }
    return result;
  }

  /**
   * Belirtilen IndexedDB veritabanındaki tüm object store'ları temizler.
   * DİKKAT: Bu işlem geri alınamaz!
   * @param dbName - Temizlenecek veritabanının adı.
   * @returns İşlem tamamlandığında resolve olan bir Promise.
   */
  async clearDatabase(dbName: string): Promise<void> {
    console.warn(`"${dbName}" veritabanındaki TÜM veriler silinecek...`);
    let db: IDBPDatabase<any> | null = null;
    try {
      // Veritabanını mevcut sürümüyle açmak yeterli (sürüm yükseltmeye gerek yok)
      db = await openDB(dbName);
      const storeNames = Array.from(db.objectStoreNames);
      console.log(`  -> "${dbName}" içinde temizlenecek tablolar: [${storeNames.join(', ')}]`);

      // Her tabloyu temizle
      const clearPromises = storeNames.map(async (storeName) => {
        try {
          const tx = db!.transaction(storeName, 'readwrite'); // db null olamaz burada
          await tx.objectStore(storeName).clear();
          await tx.done;
          console.log(`    -> "${storeName}" tablosu temizlendi.`);
        } catch (clearError) {
            console.error(`    -> "${storeName}" tablosu temizlenirken hata:`, clearError);
            // Bir tablo temizlenemese bile diğerlerini denemeye devam et
            throw clearError; // Hatayı yukarıya ilet ki genel işlem başarısız olsun
        }
      });
      
      // Tüm temizleme işlemlerinin bitmesini bekle
      await Promise.all(clearPromises);

      console.log(`"${dbName}" veritabanı başarıyla temizlendi.`);
    } catch (error) {
      console.error(`"${dbName}" veritabanı temizlenemedi (Genel Hata):`, error);
      throw error; // Hatayı çağıran fonksiyona ilet
    } finally {
       // Bağlantıyı her durumda kapat
       if (db) {
         db.close();
       }
    }
  }
}

// İçe aktarma sınıfını export et
export default IndexedDBImporter;