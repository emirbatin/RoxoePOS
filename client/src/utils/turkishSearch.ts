/**
 * Türkçe karakter desteği sunan arama ve metin temizleme yardımcı fonksiyonları
 */

/**
 * Metni arama için temizler; Türkçe karakterleri ASCII karşılıklarına dönüştürür
 * ve özel birleştirme karakterlerini kaldırır.
 * @param text Temizlenecek metin
 * @returns Temizlenmiş metin
 */
export function cleanTextForSearch(text: string): string {
    if (!text) return '';
    
    let result = '';
    // Önce lowercase yapıp karakterleri dönüştürelim
    const lowercased = text.toLowerCase();
    
    // Her karakteri tek tek işleyelim
    for (let i = 0; i < lowercased.length; i++) {
      const char = lowercased[i];
      const nextChar = lowercased[i + 1];
      
      // i ve sonraki karakter nokta ise, sadece i ekle ve noktayı atla
      if (char === 'i' && nextChar === '\u0307') {
        result += 'i';
        i++; // Nokta işaretini atla
      }
      // Türkçe karakterleri değiştir
      else if (char === 'ı' || char === 'i' || char === '\u0130' || char === '\u0131') {
        result += 'i';
      }
      else if (char === 'ç') {
        result += 'c';
      }
      else if (char === 'ğ') {
        result += 'g';
      }
      else if (char === 'ş') {
        result += 's';
      }
      else if (char === 'ö') {
        result += 'o';
      }
      else if (char === 'ü') {
        result += 'u';
      }
      // Diğer karakterleri olduğu gibi ekle
      else {
        result += char;
      }
    }
    
    return result;
  }
  
  /**
   * İki metni Türkçe karakter desteği ile karşılaştırır.
   * @param source Kaynak metin
   * @param searchTerm Aranacak metin
   * @returns Eşleşme varsa true, yoksa false
   */
  export function normalizedSearch(source: string, searchTerm: string): boolean {
    if (!source || !searchTerm) return false;
    
    // Basit includes - belki bu çalışabilir
    if (source.toLowerCase().includes(searchTerm.toLowerCase())) {
      return true;
    }
    
    // Özel temizlenmiş metinlerle arama
    const cleanSource = cleanTextForSearch(source);
    const cleanTerm = cleanTextForSearch(searchTerm);
    
    return cleanSource.includes(cleanTerm);
  }