// discountService.ts
import { DiscountInfo, DiscountType } from "../types/sales";

/**
 * İndirim hesaplama ve yönetim işlevlerini içeren modüler servis sınıfı.
 * Bu servis, uygulamanın farklı bölümlerinden erişilerek tutarlı indirim
 * hesaplamaları yapmayı sağlar.
 */
class DiscountService {
  /**
   * Belirli bir tutar üzerinden indirim hesaplar
   * @param amount Toplam tutar
   * @param type İndirim tipi (percentage veya amount)
   * @param value İndirim değeri (yüzde olarak veya sabit tutar)
   * @returns Hesaplanan indirim tutarı
   */
  calculateDiscountAmount(amount: number, type: DiscountType, value: number): number {
    if (type === "percentage") {
      return amount * (value / 100);
    } else {
      return Math.min(amount, value); // İndirim tutarı, ana tutardan fazla olamaz
    }
  }

  /**
   * Bir tutar üzerinden indirimli toplam tutarı hesaplar
   * @param amount Toplam tutar
   * @param type İndirim tipi (percentage veya amount)
   * @param value İndirim değeri (yüzde olarak veya sabit tutar)
   * @returns İndirimli toplam tutar
   */
  calculateDiscountedTotal(amount: number, type: DiscountType, value: number): number {
    const discountAmount = this.calculateDiscountAmount(amount, type, value);
    return Math.max(0, amount - discountAmount);
  }

  /**
   * İndirim bilgisi nesnesi oluşturur
   * @param amount Toplam tutar
   * @param type İndirim tipi
   * @param value İndirim değeri
   * @returns DiscountInfo nesnesi
   */
  createDiscountInfo(amount: number, type: DiscountType, value: number): DiscountInfo {
    const discountedTotal = this.calculateDiscountedTotal(amount, type, value);
    return {
      type,
      value,
      discountedTotal
    };
  }

  /**
   * Verilerin görüntülenmesi için indirim bilgisi formatlar
   * @param discount İndirim bilgisi nesnesi
   * @param originalTotal Orijinal toplam tutar
   * @returns Formatted discount text (e.g. "%10 İndirim (-₺50.00)")
   */
  formatDiscountInfo(discount: DiscountInfo, originalTotal?: number): string {
    if (!discount) return "";
    const total = originalTotal || 0;
    const discountAmount = total - discount.discountedTotal;
    
    if (discount.type === "percentage") {
      return `%${discount.value} İndirim (-₺${discountAmount.toFixed(2)})`;
    } else {
      return `₺${discount.value.toFixed(2)} İndirim`;
    }
  }

  /**
   * İndirimli ve indirimsiz fiyatı karşılaştırır ve indirim yüzdesini hesaplar
   * @param originalPrice Orijinal fiyat
   * @param discountedPrice İndirimli fiyat
   * @returns İndirim yüzdesi
   */
  getDiscountPercentage(originalPrice: number, discountedPrice: number): number {
    if (originalPrice <= 0) return 0;
    const discountPercentage = ((originalPrice - discountedPrice) / originalPrice) * 100;
    return Math.round(discountPercentage * 10) / 10; // 1 ondalık basamağa yuvarla
  }

  /**
   * Toplam tutar üzerinden indirim uygula
   * @param total Toplam tutar
   * @param discountInfo İndirim bilgisi
   * @returns İndirim uygulanmış toplam
   */
  applyDiscountToTotal(total: number, discountInfo?: DiscountInfo): number {
    if (!discountInfo) return total;
    return discountInfo.discountedTotal;
  }
}

// Singleton örnek olarak dışa aktar
export const discountService = new DiscountService();