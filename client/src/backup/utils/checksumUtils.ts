/**
 * Veri bütünlüğünü kontrol etmek için checksum hesaplama fonksiyonları
 */

import CryptoJS from 'crypto-js';

export class ChecksumUtils {
  /**
   * Verilen içeriğin SHA-256 hash'ini hesaplar
   * @param content Hash'i hesaplanacak içerik
   * @returns SHA-256 hash string
   */
  static calculateSHA256(content: string): string {
    return CryptoJS.SHA256(content).toString();
  }

  /**
   * Yedek içeriğinin bütünlüğünü kontrol eder
   * @param content Yedek içeriği
   * @param expectedChecksum Beklenen checksum değeri
   * @returns İçeriğin bütünlüğünün doğru olup olmadığı
   */
  static verifyChecksum(content: string, expectedChecksum: string): boolean {
    const calculatedChecksum = this.calculateSHA256(content);
    return calculatedChecksum === expectedChecksum;
  }
}