import { ReceiptInfo } from '../types/receipt';
import { formatCurrency, formatVatRate } from '../utils/vatUtils';

class PrintService {
  private storeName = 'MARKET ADI';
  private storeAddress = ['Adres Satırı 1', 'Adres Satırı 2'];
  private storePhone = '(123) 456-7890';
  private taxNumber = '1234567890';

  // Termal yazıcı için fiş formatı
  async printReceipt(receipt: ReceiptInfo): Promise<boolean> {
    try {
      // Window.print() yerine termal yazıcı için HTML oluştur
      const printWindow = window.open('', 'print', 'height=800,width=400');
      if (!printWindow) return false;

      // Fiş stili
      const style = `
        <style>
          @page { size: 80mm auto; margin: 0; }
          @media print {
            body { 
              font-family: 'Courier New', monospace;
              width: 80mm;
              margin: 0;
              padding: 10px;
              font-size: 12px;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .text-sm { font-size: 10px; }
            .mb { margin-bottom: 10px; }
            .border-top { border-top: 1px dashed #000; padding-top: 10px; }
            .border-bottom { border-bottom: 1px dashed #000; padding-bottom: 10px; }
            .flex { display: flex; justify-content: space-between; }
            .items > div { margin-bottom: 5px; }
          }
        </style>
      `;

      // Fiş içeriği
      const content = `
        <div class="center mb">
          <div class="bold" style="font-size: 16px;">${this.storeName}</div>
          ${this.storeAddress.map(line => `<div>${line}</div>`).join('')}
          <div>Tel: ${this.storePhone}</div>
          <div class="text-sm">Vergi No: ${this.taxNumber}</div>
        </div>

        <div class="border-bottom mb">
          <div>Fiş No: ${receipt.receiptNo}</div>
          <div>Tarih: ${receipt.date.toLocaleString('tr-TR')}</div>
        </div>

        <div class="items mb">
          ${receipt.items.map(item => `
            <div>
              <div class="flex">
                <div>${item.name}</div>
                <div>${formatCurrency(item.price)}</div>
              </div>
              <div class="flex text-sm">
                <div>${item.quantity} x ${formatCurrency(item.price)} (${formatVatRate(item.vatRate)} KDV)</div>
                <div>${formatCurrency(item.price * item.quantity)}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="border-top mb">
          <div class="flex">
            <div>Ara Toplam:</div>
            <div>${formatCurrency(receipt.subtotal)}</div>
          </div>
          ${receipt.vatBreakdown?.map(vat => `
            <div class="flex">
              <div>KDV ${formatVatRate(vat.rate)}:</div>
              <div>${formatCurrency(vat.vatAmount)}</div>
            </div>
          `).join('')}
          <div class="flex bold">
            <div>TOPLAM:</div>
            <div>${formatCurrency(receipt.total)}</div>
          </div>
        </div>

        <div class="mb">
          <div>Ödeme Şekli: ${receipt.paymentMethod === 'nakit' ? 'Nakit' : 'Kredi Kartı'}</div>
          ${receipt.paymentMethod === 'nakit' && receipt.cashReceived ? `
            <div class="flex">
              <div>Alınan:</div>
              <div>${formatCurrency(receipt.cashReceived)}</div>
            </div>
            <div class="flex">
              <div>Para Üstü:</div>
              <div>${formatCurrency(receipt.changeAmount || 0)}</div>
            </div>
          ` : ''}
        </div>

        <div class="center text-sm border-top">
          <div style="margin-top: 10px;">*** Bizi tercih ettiğiniz için teşekkür ederiz ***</div>
          <div>${receipt.date.toLocaleString('tr-TR')}</div>
        </div>
      `;

      // Yazdırma sayfasını oluştur
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            ${style}
          </head>
          <body>
            ${content}
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                }
              }
            </script>
          </body>
        </html>
      `);

      printWindow.document.close();
      return true;
    } catch (error) {
      console.error('Yazdırma hatası:', error);
      return false;
    }
  }

  // PDF çıktısı alma (gelecekte eklenecek)
  async exportToPDF(receipt: ReceiptInfo): Promise<boolean> {
    // TODO: PDF export işlemleri
    return false;
  }
}

export const printService = new PrintService();