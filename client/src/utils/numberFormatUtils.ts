// utils/numberFormatUtils.ts dosyasına eklenecek yardımcı fonksiyon
// Bu dosyanızın yoksa oluşturun

/**
 * Türkçe sayı formatını (2.065,42) JavaScript'in anlayabileceği formata (2065.42) dönüştürür
 * @param value Dönüştürülecek değer (string, number veya undefined olabilir)
 * @returns Dönüştürülmüş sayı veya orijinal değer (dönüştürülemezse)
 */
export function parseTurkishNumber(value: string | number | undefined | null): number | undefined {
    // Undefined, null veya boş string ise undefined döndür
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    
    // Zaten number tipindeyse, doğrudan döndür
    if (typeof value === 'number') {
      return isNaN(value) ? undefined : value;
    }
    
    // String değilse, string'e dönüştür
    const strValue = String(value).trim();
    
    // Değer boşsa undefined döndür
    if (!strValue) {
      return undefined;
    }
    
    try {
      // Türkçe formatındaki sayı: önce nokta (binlik ayracı) kaldırılır, sonra virgül yerine nokta konur
      // Örnek: "1.234,56" -> "1234.56"
      
      // İlk olarak, sayı olup olmadığını kontrol edelim
      // Türkçe formattaki sayı deseni: İsteğe bağlı işaret, rakamlar, binlik ayracı olarak nokta ve ondalık ayracı olarak virgül
      const turkishNumberPattern = /^[+-]?(?:\d+(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)$/;
      
      if (turkishNumberPattern.test(strValue)) {
        // Türkçe formatta bir sayı
        
        // Binlik ayraçları (noktaları) kaldır, 2.065,42 -> 2065,42
        const withoutThousandSeparator = strValue.replace(/\./g, '');
        
        // Virgülü noktaya çevir, 2065,42 -> 2065.42
        const withDecimalPoint = withoutThousandSeparator.replace(/,/g, '.');
        
        // Sayıya dönüştür
        const parsedNumber = parseFloat(withDecimalPoint);
        
        // NaN değilse sayıyı döndür
        if (!isNaN(parsedNumber)) {
          return parsedNumber;
        }
      }
      
      // Doğrudan parseFloat ile dene (eğer İngilizce/uluslararası formattaysa)
      const directParsed = parseFloat(strValue);
      if (!isNaN(directParsed)) {
        return directParsed;
      }
      
      // Hiçbir şekilde sayıya dönüştürülemiyorsa undefined döndür
      return undefined;
    } catch (error) {
      console.error("Sayı dönüştürme hatası:", error);
      return undefined;
    }
  }
  