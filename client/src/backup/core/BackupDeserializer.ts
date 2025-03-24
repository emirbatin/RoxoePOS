/**
 * .roxoe dosyasını veri yapısına dönüştürecek modül
 */

import { CompressionUtils } from '../utils/compressionUtils';
import { ChecksumUtils } from '../utils/checksumUtils';
import { BackupMetadata } from './BackupSerializer';

export interface DeserializedBackup {
  metadata: BackupMetadata;
  data: any;
  isValid: boolean;
  error?: string;
}

export class BackupDeserializer {
  /**
   * .roxoe formatından veriyi çözümler
   * 
   * @param backupContent .roxoe formatında veri
   * @returns Çözümlenmiş veri ve meta bilgileri
   */
  deserializeFromRoxoeFormat(backupContent: string): DeserializedBackup {
    try {
      // Meta veri uzunluğunu oku (ilk 4 byte)
      const metaLengthBytes = new Uint8Array(4);
      for (let i = 0; i < 4; i++) {
        metaLengthBytes[i] = backupContent.charCodeAt(i);
      }
      
      const metaLength = metaLengthBytes[0] | 
                        (metaLengthBytes[1] << 8) | 
                        (metaLengthBytes[2] << 16) | 
                        (metaLengthBytes[3] << 24);
      
      // Meta verileri oku
      const metaJson = backupContent.substring(4, 4 + metaLength);
      const metadata = JSON.parse(metaJson) as BackupMetadata;
      
      // Sıkıştırılmış veriyi oku
      const compressedData = backupContent.substring(4 + metaLength);
      
      // Veri bütünlüğünü kontrol et
      if (metadata.checksum) {
        const calculatedChecksum = ChecksumUtils.calculateSHA256(compressedData);
        if (calculatedChecksum !== metadata.checksum) {
          return {
            metadata,
            data: null,
            isValid: false,
            error: 'Veri bütünlüğü doğrulanamadı: Checksum eşleşmiyor'
          };
        }
      }
      
      // Sıkıştırılmış veriyi aç
      const jsonData = CompressionUtils.decompress(compressedData);
      
      // JSON veriyi parse et
      const data = JSON.parse(jsonData);
      
      return {
        metadata,
        data,
        isValid: true
      };
    } catch (error) {
      console.error('Yedek çözümleme hatası:', error);
      return {
        metadata: {} as BackupMetadata,
        data: null,
        isValid: false,
        error: `Yedek çözümleme hatası: ${(error as Error).message}`
      };
    }
  }
  
  /**
   * Sıkıştırılmış veriyi açar
   * 
   * @param compressedData Sıkıştırılmış veri
   * @returns Açılmış veri
   */
  decompressData(compressedData: string): string {
    return CompressionUtils.decompress(compressedData);
  }
  
  /**
   * Veri bütünlüğünü kontrol eder
   * 
   * @param data Veri
   * @param expectedChecksum Beklenen checksum
   * @returns Veri bütünlüğü doğru mu
   */
  verifyChecksum(data: string, expectedChecksum: string): boolean {
    return ChecksumUtils.verifyChecksum(data, expectedChecksum);
  }
}