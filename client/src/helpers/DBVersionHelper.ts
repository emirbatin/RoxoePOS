// src/helpers/DBVersionHelper.ts
const DB_VERSIONS = {
    // Ana POS veritabanı
    posDB: 5, // 4'ten 5'e yükseltiyoruz çünkü mevcut sürüm 5 olmuş
    // Diğer veritabanları
    salesDB: 3,
    creditDB: 3
  };
  
  /**
   * Sürüm kontrolü ve yükseltmesi için yardımcı fonksiyon
   * Tüm veritabanı sürüm bilgilerini tek yerden yönetir
   */
  export const DBVersionHelper = {
    /**
     * Belirtilen veritabanı için geçerli sürüm numarasını döndürür
     */
    getVersion(dbName: string): number {
      const versionKey = dbName as keyof typeof DB_VERSIONS;
      
      // Yeni bir sürüm yükseltmesi işareti varsa, +1 döndür
      const upgraded = localStorage.getItem('db_version_upgraded') === 'true';
      
      if (upgraded && versionKey === 'posDB') {
        return DB_VERSIONS[versionKey] + 1;
      }
      
      return DB_VERSIONS[versionKey] || 1;
    },
    
    /**
     * Sürüm yükseltme işaretini kaldırır
     */
    clearUpgradeFlag() {
      localStorage.removeItem('db_version_upgraded');
    }
  };
  
  export default DBVersionHelper;