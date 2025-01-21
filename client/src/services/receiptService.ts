import { ReceiptInfo } from '../types/receipt';
import jsPDF from 'jspdf';

class ReceiptService {
  async generatePDF(receipt: ReceiptInfo): Promise<void> {
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 200] // Tipik termal fiş boyutu
    });

    // Font ayarları
    doc.setFontSize(10);
    let y = 10; // Y pozisyonu

    // Başlık
    doc.setFont("helvetica", "bold");
    doc.text("TEST MARKET", 40, y, { align: "center" });
    y += 5;

    // Adres
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Test Caddesi No:123", 40, y, { align: "center" });
    y += 4;
    doc.text("Tel: 0212 123 45 67", 40, y, { align: "center" });
    y += 6;

    // Çizgi
    doc.line(5, y, 75, y);
    y += 5;

    // Fiş detayları
    doc.text(`Fiş No: ${receipt.receiptNo}`, 5, y);
    y += 4;
    doc.text(`Tarih: ${receipt.date.toLocaleString('tr-TR')}`, 5, y);
    y += 6;

    // Çizgi
    doc.line(5, y, 75, y);
    y += 5;

    // Başlıklar
    doc.setFont("helvetica", "bold");
    doc.text("Ürün", 5, y);
    doc.text("Miktar", 45, y);
    doc.text("Tutar", 65, y);
    y += 4;

    // Ürünler
    doc.setFont("helvetica", "normal");
    receipt.items.forEach(item => {
      // Ürün adı
      doc.text(item.name, 5, y);
      // Miktar
      doc.text(item.quantity.toString(), 45, y);
      // Tutar
      doc.text(`₺${(item.quantity * item.price).toFixed(2)}`, 65, y);
      y += 4;
    });

    y += 2;
    // Çizgi
    doc.line(5, y, 75, y);
    y += 5;

    // Toplam
    doc.setFont("helvetica", "bold");
    doc.text("TOPLAM:", 45, y);
    doc.text(`₺${receipt.total.toFixed(2)}`, 65, y);
    y += 6;

    // Ödeme bilgileri
    doc.setFont("helvetica", "normal");
    doc.text(`Ödeme Şekli: ${receipt.paymentMethod === 'nakit' ? 'Nakit' : 'Kredi Kartı'}`, 5, y);
    y += 4;

    if (receipt.paymentMethod === 'nakit' && receipt.cashReceived) {
      doc.text(`Alınan: ₺${receipt.cashReceived.toFixed(2)}`, 5, y);
      y += 4;
      doc.text(`Para Üstü: ₺${(receipt.cashReceived - receipt.total).toFixed(2)}`, 5, y);
      y += 4;
    }

    // Alt bilgi
    y += 4;
    doc.setFontSize(8);
    doc.text("Bizi tercih ettiğiniz için teşekkür ederiz", 40, y, { align: "center" });

    // PDF'i indir
    doc.save(`fis-${receipt.receiptNo}.pdf`);
  }

  async printReceipt(receipt: ReceiptInfo): Promise<boolean> {
    try {
      await this.generatePDF(receipt);
      return true;
    } catch (error) {
      console.error('PDF oluşturma hatası:', error);
      return false;
    }
  }

  async checkPrinterStatus(): Promise<boolean> {
    return true; // PDF oluşturma her zaman mümkün olduğu için true dönüyoruz
  }
}

export const receiptService = new ReceiptService();