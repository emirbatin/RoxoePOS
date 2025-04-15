/**
 * .roxoe dosyasını veri yapısına dönüştürecek modül
 */

import { CompressionUtils } from "../utils/compressionUtils";
import { ChecksumUtils } from "../utils/checksumUtils";
import { BackupMetadata } from "./BackupSerializer";

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

      const metaLength =
        metaLengthBytes[0] |
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
        const calculatedChecksum =
          ChecksumUtils.calculateSHA256(compressedData);
        if (calculatedChecksum !== metadata.checksum) {
          return {
            metadata,
            data: null,
            isValid: false,
            error: "Veri bütünlüğü doğrulanamadı: Checksum eşleşmiyor",
          };
        }
      }

      // Sıkıştırılmış veriyi aç
      const jsonData = CompressionUtils.decompress(compressedData);

      // JSON veriyi parse et
      const rawData = JSON.parse(jsonData);

      // Date nesnelerini restore et
      const data = this.restoreDataFromBackup(rawData);

      console.log("Veri geri yüklendi, Date nesneleri dönüştürüldü");

      return {
        metadata,
        data,
        isValid: true,
      };
    } catch (error) {
      console.error("Yedek çözümleme hatası:", error);
      return {
        metadata: {} as BackupMetadata,
        data: null,
        isValid: false,
        error: `Yedek çözümleme hatası: ${(error as Error).message}`,
      };
    }
  }

  /**
   * JSON string'i parse eder ve ISO tarih formatında olan alanları Date objelerine dönüştürür
   */
  private parseWithDateReviver(jsonString: string): any {
    return JSON.parse(jsonString, (key, value) => {
      // ISO tarih formatını kontrol et
      if (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d{3})?Z$/.test(value)
      ) {
        return new Date(value);
      }
      return value;
    });
  }

  /**
   * Özel işaretlenmiş Date nesnelerini geri yükler
   */
  private restoreDataFromBackup(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    // Özel tarih nesnesini kontrol et (format: { __isDate: true, value: "ISO-string" })
    if (
      data &&
      typeof data === "object" &&
      data.__isDate === true &&
      data.value
    ) {
      try {
        const date = new Date(data.value);
        // Debug için log
        console.log(`Tarih dönüştürüldü: ${data.value} -> ${date}`);
        return date;
      } catch (e) {
        console.error(`Tarih dönüştürme hatası:`, e, data);
        return new Date(); // Fallback - geçerli tarih döndür
      }
    }

    // Dizi kontrolü
    if (Array.isArray(data)) {
      return data.map((item) => this.restoreDataFromBackup(item));
    }

    // Nesne kontrolü
    if (typeof data === "object") {
      const result: any = {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          result[key] = this.restoreDataFromBackup(data[key]);
        }
      }
      return result;
    }

    // Diğer tip değerleri doğrudan döndür
    return data;
  }

  /**
   * Sıkıştırılmış veriyi açar
   */
  decompressData(compressedData: string): string {
    return CompressionUtils.decompress(compressedData);
  }

  /**
   * Veri bütünlüğünü kontrol eder
   */
  verifyChecksum(data: string, expectedChecksum: string): boolean {
    return ChecksumUtils.verifyChecksum(data, expectedChecksum);
  }
}
