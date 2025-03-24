/**
 * Veri sıkıştırma ve açma işlemleri için yardımcı fonksiyonlar
 */

import LZString from 'lz-string';

export class CompressionUtils {
  /**
   * Verilen içeriği LZ-String kullanarak sıkıştırır
   * @param content Sıkıştırılacak içerik
   * @returns Sıkıştırılmış içerik
   */
  static compress(content: string): string {
    return LZString.compressToUTF16(content);
  }

  /**
   * Sıkıştırılmış içeriği açar
   * @param compressedContent Sıkıştırılmış içerik
   * @returns Orijinal içerik
   */
  static decompress(compressedContent: string): string {
    return LZString.decompressFromUTF16(compressedContent) || '';
  }

  /**
   * İçeriği Base64 formatına dönüştürür
   * @param content Dönüştürülecek içerik
   * @returns Base64 formatında içerik
   */
  static toBase64(content: string): string {
    return btoa(unescape(encodeURIComponent(content)));
  }

  /**
   * Base64 formatındaki içeriği normal metne dönüştürür
   * @param base64Content Base64 formatında içerik
   * @returns Normal metin
   */
  static fromBase64(base64Content: string): string {
    return decodeURIComponent(escape(atob(base64Content)));
  }
}