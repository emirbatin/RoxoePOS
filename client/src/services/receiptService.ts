import { ReceiptInfo } from '../types/receipt';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

class ReceiptService {
  async generatePDF(receipt: ReceiptInfo): Promise<void> {
    // Yeni bir PDF dokümanı oluştur
    const pdfDoc = await PDFDocument.create();
    
    // Helvetica fontunu ekle
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Sayfa oluştur (80x200mm fiş boyutu)
    const page = pdfDoc.addPage([80 * 2.83, 200 * 2.83]); // mm -> point çevirimi (1mm ≈ 2.83pt)
    const { width, height } = page.getSize();
    
    // Değişkenler
    let y = height - 30; // Başlangıç y pozisyonu (üstten aşağı)
    const centerX = width / 2;
    const margin = 15;
    const lineHeight = 12;
    const smallLineHeight = 10;

    // Başlık
    page.drawText("TEST MARKET", {
      x: centerX - helveticaBold.widthOfTextAtSize("TEST MARKET", 12) / 2,
      y,
      font: helveticaBold,
      size: 12
    });
    y -= lineHeight + 3;
    
    // Adres
    const address = "Test Caddesi No:123";
    page.drawText(address, {
      x: centerX - helveticaFont.widthOfTextAtSize(address, 9) / 2,
      y,
      font: helveticaFont,
      size: 9
    });
    y -= smallLineHeight;
    
    const tel = "Tel: 0212 123 45 67";
    page.drawText(tel, {
      x: centerX - helveticaFont.widthOfTextAtSize(tel, 9) / 2,
      y,
      font: helveticaFont,
      size: 9
    });
    y -= lineHeight + 3;
    
    // Çizgi
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: rgb(0, 0, 0)
    });
    y -= lineHeight;
    
    // Fiş detayları
    page.drawText(`Fiş No: ${receipt.receiptNo}`, {
      x: margin,
      y,
      font: helveticaFont,
      size: 9
    });
    y -= smallLineHeight;
    
    const dateString = receipt.date instanceof Date 
      ? receipt.date.toLocaleString('tr-TR')
      : new Date(receipt.date).toLocaleString('tr-TR');
      
    page.drawText(`Tarih: ${dateString}`, {
      x: margin,
      y,
      font: helveticaFont,
      size: 9
    });
    y -= lineHeight + 3;
    
    // Çizgi
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: rgb(0, 0, 0)
    });
    y -= lineHeight;
    
    // Başlıklar
    page.drawText("Ürün", {
      x: margin,
      y,
      font: helveticaBold,
      size: 9
    });
    
    page.drawText("Miktar", {
      x: width - margin - 30,
      y,
      font: helveticaBold,
      size: 9
    });
    
    page.drawText("Tutar", {
      x: width - margin - 10,
      y,
      font: helveticaBold,
      size: 9
    });
    y -= smallLineHeight + 2;
    
    // Ürünler
    for (const item of receipt.items) {
      // Ürün adını kısalt (gerekirse)
      let itemName = item.name;
      if (itemName.length > 20) {
        itemName = itemName.substring(0, 17) + "...";
      }
      
      page.drawText(itemName, {
        x: margin,
        y,
        font: helveticaFont,
        size: 9
      });
      
      page.drawText(item.quantity.toString(), {
        x: width - margin - 25,
        y,
        font: helveticaFont,
        size: 9
      });
      
      const priceText = `₺${(item.quantity * item.priceWithVat).toFixed(2)}`;
      page.drawText(priceText, {
        x: width - margin - helveticaFont.widthOfTextAtSize(priceText, 9),
        y,
        font: helveticaFont,
        size: 9
      });
      
      y -= smallLineHeight;
    }
    
    y -= 8;
    // Çizgi
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: rgb(0, 0, 0)
    });
    y -= lineHeight;
    
    // Toplam
    page.drawText("TOPLAM:", {
      x: width - margin - 60,
      y,
      font: helveticaBold,
      size: 10
    });
    
    const totalText = `₺${receipt.total.toFixed(2)}`;
    page.drawText(totalText, {
      x: width - margin - helveticaFont.widthOfTextAtSize(totalText, 10),
      y,
      font: helveticaBold,
      size: 10
    });
    y -= lineHeight + 3;
    
    // Ödeme bilgileri
    const paymentMethod = receipt.paymentMethod === 'nakit' ? 'Nakit' : 'Kredi Kartı';
    page.drawText(`Ödeme Şekli: ${paymentMethod}`, {
      x: margin,
      y,
      font: helveticaFont,
      size: 9
    });
    y -= smallLineHeight;
    
    if (receipt.paymentMethod === 'nakit' && receipt.cashReceived) {
      page.drawText(`Alınan: ₺${receipt.cashReceived.toFixed(2)}`, {
        x: margin,
        y,
        font: helveticaFont,
        size: 9
      });
      y -= smallLineHeight;
      
      const changeAmount = receipt.cashReceived - receipt.total;
      page.drawText(`Para Üstü: ₺${changeAmount.toFixed(2)}`, {
        x: margin,
        y,
        font: helveticaFont,
        size: 9
      });
      y -= smallLineHeight;
    }
    
    // Alt bilgi
    y -= lineHeight;
    const thanks = "Bizi tercih ettiğiniz için teşekkür ederiz";
    page.drawText(thanks, {
      x: centerX - helveticaFont.widthOfTextAtSize(thanks, 8) / 2,
      y,
      font: helveticaFont,
      size: 8
    });
    
    // PDF içeriğini byte array olarak al
    const pdfBytes = await pdfDoc.save();
    
    // PDF'i indir
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fis-${receipt.receiptNo}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
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