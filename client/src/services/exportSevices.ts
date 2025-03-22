  import { Sale } from '../types/sales';
  import ExcelJS from 'exceljs';
  import { getPaymentMethodDisplay } from '../helpers/paymentMethodDisplay';
  import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';


  // Fiş bazlı rapor için interface
  interface SaleReportData {
    'Fiş No': string;
    'Tarih': Date;
    'Tutar': number;
    'Ödeme': string;
    'Durum': string;
    'Ürün Sayısı': number;
    'Ürünler': string;
  }

  // Ürün bazlı rapor için interface
  interface ProductReportData {
    'Ürün Adı': string;
    'Kategori': string;
    'Satış Adedi': number;
    'Birim Alış': number;
    'Birim Satış': number;
    'Toplam Ciro': number;
    'Toplam Kâr': number;
    'Kâr Marjı (%)': number;
  }

  // Kasa verileri için interface
  interface CashExportData {
    summary: {
      openingBalance: number;
      currentBalance: number;
      totalDeposits: number;
      totalWithdrawals: number;
      veresiyeCollections: number;
      cashSalesTotal: number;
      cardSalesTotal: number;
    };
    dailyData: Array<{
      date: string;
      deposits: number;
      withdrawals: number;
      veresiye: number;
      total: number;
    }>;
  }

  type ReportType = 'sale' | 'product' | 'cash';

  class ExportService {
    // Fiş bazlı veri hazırlama
    private prepareSaleData(sales: Sale[]): SaleReportData[] {
      return sales.map(sale => ({
        'Fiş No': sale.receiptNo,
        'Tarih': new Date(sale.date),
        'Tutar': sale.total,
        'Ödeme': getPaymentMethodDisplay(sale.paymentMethod),
        'Durum': sale.status === 'completed' 
                  ? 'Tamamlandı' 
                  : sale.status === 'cancelled' 
                    ? 'İptal Edildi' 
                    : 'İade Edildi',
        'Ürün Sayısı': sale.items.reduce((sum, item) => sum + item.quantity, 0),
        'Ürünler': sale.items.map(item => `${item.name} (${item.quantity} adet)`).join(', ')
      }));
    }
    
    // Ürün bazlı veri hazırlama
    private prepareProductData(sales: Sale[]): ProductReportData[] {
      const productStats = sales.reduce((acc, sale) => {
        if (sale.status !== 'completed') return acc; // Sadece tamamlanan satışları dahil et

        sale.items.forEach(item => {
          if (!acc[item.name]) {
            acc[item.name] = {
              'Ürün Adı': item.name,
              'Kategori': item.category,
              'Satış Adedi': 0,
              'Birim Alış': item.purchasePrice,
              'Birim Satış': item.salePrice,
              'Toplam Ciro': 0,
              'Toplam Kâr': 0,
              'Kâr Marjı (%)': 0
            };
          }

          acc[item.name]['Satış Adedi'] += item.quantity;
          acc[item.name]['Toplam Ciro'] += item.priceWithVat * item.quantity;
          acc[item.name]['Toplam Kâr'] += (item.salePrice - item.purchasePrice) * item.quantity;
        });
        return acc;
      }, {} as Record<string, ProductReportData>);

      return Object.values(productStats).map(product => ({
        ...product,
        'Kâr Marjı (%)': Number(((product['Toplam Kâr'] / product['Toplam Ciro']) * 100).toFixed(2))
      }));
    }

    // Kasa verilerini Excel formatına export etme
    async exportCashDataToExcel(data: CashExportData, title: string) {
      const workbook = new ExcelJS.Workbook();
      
      // Özet Sayfası
      const summarySheet = workbook.addWorksheet('Kasa Özeti');
      
      // Başlık
      summarySheet.mergeCells('A1:C1');
      summarySheet.getCell('A1').value = 'KASA RAPORU ÖZETİ';
      summarySheet.getCell('A1').style = {
        font: { size: 14, bold: true },
        alignment: { horizontal: 'center' }
      };
      
      // Alt başlık (Tarih aralığı)
      const titleParts = title.split(' ');
      if (titleParts.length > 2) {
        const dateRange = titleParts.slice(2).join(' ');
        summarySheet.mergeCells('A2:C2');
        summarySheet.getCell('A2').value = dateRange;
        summarySheet.getCell('A2').style = {
          font: { size: 10 },
          alignment: { horizontal: 'center' }
        };
      }
      
      // Özet veriler
      const summaryData = [
        ['Açılış Bakiyesi', data.summary.openingBalance, '₺'],
        ['Güncel Bakiye', data.summary.currentBalance, '₺'],
        ['Toplam Nakit Girişler', data.summary.totalDeposits, '₺'],
        ['Toplam Nakit Çıkışlar', data.summary.totalWithdrawals, '₺'],
        ['Veresiye Tahsilatları', data.summary.veresiyeCollections, '₺'],
        ['Nakit Satış Toplamı', data.summary.cashSalesTotal, '₺'],
        ['Kredi Kartı Satış Toplamı', data.summary.cardSalesTotal, '₺']
      ];
      
      // Boşluk ve başlık ekleme
      summarySheet.addRow([]);
      
      // Tablo başlığı
      const headerRow = summarySheet.addRow(['Açıklama', 'Tutar', 'Birim']);
      headerRow.eachCell((cell) => {
        cell.style = {
          font: { size: 12, bold: true, color: { argb: 'FFFFFF' } },
          fill: {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '2980B9' }
          } as ExcelJS.FillPattern,
          alignment: { horizontal: 'center' }
        };
      });
      
      // Özet verilerini ekle
      summaryData.forEach(row => {
        const dataRow = summarySheet.addRow(row);
        dataRow.getCell(2).numFmt = '#,##0.00';
      });
      
      // Sütun genişliklerini ayarla
      summarySheet.getColumn('A').width = 30;
      summarySheet.getColumn('B').width = 15;
      summarySheet.getColumn('C').width = 10;
      
      // Günlük Veriler Sayfası
      const dailySheet = workbook.addWorksheet('Günlük Veriler');
      
      // Başlık
      dailySheet.mergeCells('A1:E1');
      dailySheet.getCell('A1').value = 'GÜNLÜK KASA HAREKETLERİ';
      dailySheet.getCell('A1').style = {
        font: { size: 14, bold: true },
        alignment: { horizontal: 'center' }
      };
      
      // Alt başlık (tarih aralığı)
      if (titleParts.length > 2) {
        const dateRange = titleParts.slice(2).join(' ');
        dailySheet.mergeCells('A2:E2');
        dailySheet.getCell('A2').value = dateRange;
        dailySheet.getCell('A2').style = {
          font: { size: 10 },
          alignment: { horizontal: 'center' }
        };
      }
      
      // Boşluk ve tablo başlığı
      dailySheet.addRow([]);
      
      // Tablo sütun tanımları
      dailySheet.columns = [
        { header: 'Tarih', key: 'date', width: 15 },
        { header: 'Nakit Girişler', key: 'deposits', width: 15, style: { numFmt: '#,##0.00 ₺' } },
        { header: 'Nakit Çıkışlar', key: 'withdrawals', width: 15, style: { numFmt: '#,##0.00 ₺' } },
        { header: 'Veresiye Tahsilatları', key: 'veresiye', width: 20, style: { numFmt: '#,##0.00 ₺' } },
        { header: 'Günlük Toplam', key: 'total', width: 15, style: { numFmt: '#,##0.00 ₺' } }
      ];
      
      // Tablo başlık stilini ayarla
      dailySheet.getRow(4).eachCell((cell) => {
        cell.style = {
          font: { size: 12, bold: true, color: { argb: 'FFFFFF' } },
          fill: {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '2980B9' }
          } as ExcelJS.FillPattern,
          alignment: { horizontal: 'center' }
        };
      });
      
      // Günlük verileri ekle
      data.dailyData.forEach(day => {
        dailySheet.addRow({
          date: day.date,
          deposits: day.deposits,
          withdrawals: day.withdrawals,
          veresiye: day.veresiye,
          total: day.total
        });
      });
      
      // Toplamlar satırı
      const totals = {
        date: 'TOPLAM',
        deposits: data.dailyData.reduce((sum, day) => sum + day.deposits, 0),
        withdrawals: data.dailyData.reduce((sum, day) => sum + day.withdrawals, 0),
        veresiye: data.dailyData.reduce((sum, day) => sum + day.veresiye, 0),
        total: data.dailyData.reduce((sum, day) => sum + day.total, 0)
      };
      
      const totalRow = dailySheet.addRow(totals);
      totalRow.eachCell((cell) => {
        cell.style = { font: { bold: true } };
      });
      
      // Excel'i indir
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/ /g, '_')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      return true;
    }

    async exportToExcel(sales: Sale[], dateRange: string, type: ReportType = 'product') {
      // Eğer kasa raporu isteniyorsa uyarı göster ve fonksiyondan çık
      if (type === 'cash') {
        console.error('Kasa verileri için exportCashDataToExcel fonksiyonunu kullanın.');
        throw new Error('Kasa verileri için exportCashDataToExcel fonksiyonunu kullanın.');
      }
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(type === 'product' ? 'Ürün Satışları' : 'Satışlar');

      if (type === 'product') {
        const data = this.prepareProductData(sales);

        worksheet.columns = [
          { header: 'Ürün Adı', key: 'Ürün Adı', width: 30 },
          { header: 'Kategori', key: 'Kategori', width: 20 },
          { header: 'Satış Adedi', key: 'Satış Adedi', width: 15 },
          { header: 'Birim Alış', key: 'Birim Alış', width: 15, style: { numFmt: '#,##0.00 ₺' } },
          { header: 'Birim Satış', key: 'Birim Satış', width: 15, style: { numFmt: '#,##0.00 ₺' } },
          { header: 'Toplam Ciro', key: 'Toplam Ciro', width: 15, style: { numFmt: '#,##0.00 ₺' } },
          { header: 'Toplam Kâr', key: 'Toplam Kâr', width: 15, style: { numFmt: '#,##0.00 ₺' } },
          { header: 'Kâr Marjı (%)', key: 'Kâr Marjı (%)', width: 15, style: { numFmt: '#,##0.00' } }
        ];

        data.forEach(row => worksheet.addRow(row));

        // Toplam satırı
        const totals = {
          'Ürün Adı': 'TOPLAM',
          'Kategori': '',
          'Satış Adedi': data.reduce((sum, row) => sum + row['Satış Adedi'], 0),
          'Birim Alış': null,
          'Birim Satış': null,
          'Toplam Ciro': data.reduce((sum, row) => sum + row['Toplam Ciro'], 0),
          'Toplam Kâr': data.reduce((sum, row) => sum + row['Toplam Kâr'], 0),
          'Kâr Marjı (%)': Number(((data.reduce((sum, row) => sum + row['Toplam Kâr'], 0) / 
                                data.reduce((sum, row) => sum + row['Toplam Ciro'], 0)) * 100).toFixed(2))
        };
        worksheet.addRow(totals);

      } else {
        const data = this.prepareSaleData(sales);

        worksheet.columns = [
          { header: 'Fiş No', key: 'Fiş No', width: 15 },
          { header: 'Tarih', key: 'Tarih', width: 20, style: { numFmt: 'dd.mm.yyyy hh:mm' } },
          { header: 'Tutar', key: 'Tutar', width: 15, style: { numFmt: '#,##0.00 ₺' } },
          { header: 'Ödeme', key: 'Ödeme', width: 15 },
          { header: 'Durum', key: 'Durum', width: 15 },
          { header: 'Ürün Sayısı', key: 'Ürün Sayısı', width: 15 },
          { header: 'Ürünler', key: 'Ürünler', width: 50 }
        ];

        data.forEach(row => worksheet.addRow(row));
      }

      // Başlık stili
      worksheet.getRow(1).eachCell((cell) => {
        cell.style = {
          font: { size: 12, bold: true, color: { argb: 'FFFFFF' } },
          fill: {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '2980B9' }
          } as ExcelJS.FillPattern,
          alignment: { horizontal: 'center' }
        };
      });

      // Rapor başlığı
      const title = type === 'product' ? 'Ürün Satış Raporu' : 'Satış Raporu';
      worksheet.insertRow(1, []);
      worksheet.insertRow(1, [`${title} - ${dateRange}`]);
      worksheet.mergeCells('A1:H1');
      worksheet.getCell('A1').style = {
        font: { size: 14, bold: true },
        alignment: { horizontal: 'center' }
      };

      // Excel'i indir
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type === 'product' ? 'Ürün_Satış_Raporu' : 'Satış_Raporu'}_${dateRange}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    }

    async exportToPDF(sales: Sale[], dateRange: string, type: ReportType = 'product') {
      // Eğer kasa raporu isteniyorsa uyarı göster
      if (type === 'cash') {
        console.error('Kasa raporları için PDF export henüz desteklenmiyor!');
        throw new Error('Kasa raporları için PDF export henüz desteklenmiyor!');
      }
      
      // Yeni bir PDF dokümanı oluştur
      const pdfDoc = await PDFDocument.create();
      
      // Font ekle
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      // Sayfa oluştur (A4)
      // "let" kullanarak değişkene atama yaptık - artık sabit değil
      let page = pdfDoc.addPage([595, 842]); // A4 boyutu
      const { width, height } = page.getSize();
      
      // Değişkenler
      const margin = 50;
      const columnWidth = (width - (margin * 2)) / (type === 'product' ? 5 : 6);
      
      // Rapor Başlığı
      page.drawText(type === 'product' ? 'Ürün Satış Raporu' : 'Satış Raporu', {
        x: width / 2 - helveticaBold.widthOfTextAtSize('Ürün Satış Raporu', 16) / 2,
        y: height - margin,
        size: 16,
        font: helveticaBold
      });
      
      // Tarih Aralığı
      page.drawText(dateRange, {
        x: width / 2 - helvetica.widthOfTextAtSize(dateRange, 10) / 2,
        y: height - margin - 20,
        size: 10,
        font: helvetica
      });
      
      // Tablo başlıkları için Y pozisyonu
      let y = height - margin - 50;
      
      // Tablo oluşturma fonksiyonu - Yardımcı metot
      const drawTableHeader = (columns: string[], y: number) => {
        // Tablo başlık arka planı
        page.drawRectangle({
          x: margin,
          y: y - 15,
          width: width - (margin * 2),
          height: 20,
          color: rgb(0.16, 0.5, 0.73), // #2980B9
        });
        
        // Tablo başlıkları
        columns.forEach((title, i) => {
          page.drawText(title, {
            x: margin + (columnWidth * i) + 5,
            y: y - 10,
            size: 10,
            font: helveticaBold,
            color: rgb(1, 1, 1) // white
          });
        });
        
        return y - 25; // Bir sonraki satır için Y pozisyonu
      };
      
      if (type === 'product') {
        const data = this.prepareProductData(sales);
        const columns = ['Ürün Adı', 'Kategori', 'Adet', 'Ciro', 'Kâr'];
        
        y = drawTableHeader(columns, y);
        
        // Tablo satırları
        data.forEach((item, i) => {
          // Her ikinci satır için arka plan
          if (i % 2 === 0) {
            page.drawRectangle({
              x: margin,
              y: y - 15,
              width: width - (margin * 2),
              height: 20,
              color: rgb(0.95, 0.95, 0.95), // Light gray
            });
          }
          
          // Ürün adı (kısaltılmış)
          let productName = item['Ürün Adı'];
          if (productName.length > 25) {
            productName = productName.substring(0, 22) + '...';
          }
          
          page.drawText(productName, {
            x: margin + 5,
            y: y - 10,
            size: 9,
            font: helvetica
          });
          
          // Kategori
          let category = item['Kategori'] || '';
          if (category.length > 15) {
            category = category.substring(0, 12) + '...';
          }
          
          page.drawText(category, {
            x: margin + columnWidth + 5,
            y: y - 10,
            size: 9,
            font: helvetica
          });
          
          // Satış Adedi
          page.drawText(item['Satış Adedi'].toString(), {
            x: margin + (columnWidth * 2) + 5,
            y: y - 10,
            size: 9,
            font: helvetica
          });
          
          // Toplam Ciro
          page.drawText(`₺${item['Toplam Ciro'].toFixed(2)}`, {
            x: margin + (columnWidth * 3) + 5,
            y: y - 10,
            size: 9,
            font: helvetica
          });
          
          // Toplam Kâr
          page.drawText(`₺${item['Toplam Kâr'].toFixed(2)}`, {
            x: margin + (columnWidth * 4) + 5,
            y: y - 10,
            size: 9,
            font: helvetica
          });
          
          y -= 20;
          
          // Sayfa sınırını aştık mı?
          if (y < margin + 50) {
            // Yeni sayfa ekle
            page = pdfDoc.addPage([595, 842]);
            y = height - margin - 30;
            
            // Yeni sayfada başlıkları tekrarla
            y = drawTableHeader(columns, y);
          }
        });
        
        // Toplam satırı
        page.drawRectangle({
          x: margin,
          y: y - 15,
          width: width - (margin * 2),
          height: 25,
          color: rgb(0.9, 0.9, 0.9), // Biraz daha koyu gri
        });
        
        // TOPLAM yazısı
        page.drawText('TOPLAM', {
          x: margin + 5,
          y: y - 10,
          size: 10,
          font: helveticaBold
        });
        
        // Toplam Satış Adedi
        const totalQuantity = data.reduce((sum, row) => sum + row['Satış Adedi'], 0);
        page.drawText(totalQuantity.toString(), {
          x: margin + (columnWidth * 2) + 5,
          y: y - 10,
          size: 10,
          font: helveticaBold
        });
        
        // Toplam Ciro
        const totalRevenue = data.reduce((sum, row) => sum + row['Toplam Ciro'], 0);
        page.drawText(`₺${totalRevenue.toFixed(2)}`, {
          x: margin + (columnWidth * 3) + 5,
          y: y - 10,
          size: 10,
          font: helveticaBold
        });
        
        // Toplam Kâr
        const totalProfit = data.reduce((sum, row) => sum + row['Toplam Kâr'], 0);
        page.drawText(`₺${totalProfit.toFixed(2)}`, {
          x: margin + (columnWidth * 4) + 5,
          y: y - 10,
          size: 10,
          font: helveticaBold
        });
        
      } else {
        // Satış raporu
        const data = this.prepareSaleData(sales);
        const columns = ['Fiş No', 'Tarih', 'Tutar', 'Ödeme', 'Durum', 'Adet'];
        
        y = drawTableHeader(columns, y);
        
        // Tablo satırları
        data.forEach((item, i) => {
          // Her ikinci satır için arka plan
          if (i % 2 === 0) {
            page.drawRectangle({
              x: margin,
              y: y - 15,
              width: width - (margin * 2),
              height: 20,
              color: rgb(0.95, 0.95, 0.95), // Light gray
            });
          }
          
          // Fiş No
          page.drawText(item['Fiş No'], {
            x: margin + 5,
            y: y - 10,
            size: 9,
            font: helvetica
          });
          
          // Tarih
          const dateString = item['Tarih'] instanceof Date 
            ? item['Tarih'].toLocaleString('tr-TR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit', 
                minute: '2-digit'
              })
            : new Date(item['Tarih']).toLocaleString('tr-TR');
          
          page.drawText(dateString, {
            x: margin + columnWidth + 5,
            y: y - 10,
            size: 9,
            font: helvetica
          });
          
          // Tutar
          page.drawText(`₺${item['Tutar'].toFixed(2)}`, {
            x: margin + (columnWidth * 2) + 5,
            y: y - 10,
            size: 9,
            font: helvetica
          });
          
          // Ödeme
          page.drawText(item['Ödeme'], {
            x: margin + (columnWidth * 3) + 5,
            y: y - 10,
            size: 9,
            font: helvetica
          });
          
          // Durum
          page.drawText(item['Durum'], {
            x: margin + (columnWidth * 4) + 5,
            y: y - 10,
            size: 9,
            font: helvetica
          });
          
          // Ürün Sayısı
          page.drawText(item['Ürün Sayısı'].toString(), {
            x: margin + (columnWidth * 5) + 5,
            y: y - 10,
            size: 9,
            font: helvetica
          });
          
          y -= 20;
          
          // Sayfa sınırını aştık mı?
          if (y < margin + 50) {
            // Yeni sayfa ekle
            page = pdfDoc.addPage([595, 842]);
            y = height - margin - 30;
            
            // Yeni sayfada başlıkları tekrarla
            y = drawTableHeader(columns, y);
          }
        });
      }
      
      // PDF'i kaydet ve indir
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type === 'product' ? 'Ürün_Satış_Raporu' : 'Satış_Raporu'}_${dateRange}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }

    // Kasa verileri için PDF export fonksiyonu (gelecekte geliştirilebilir)
    async exportCashDataToPDF(data: CashExportData, title: string) {
      // Bu özellik henüz desteklenmiyor
      throw new Error('Kasa raporları için PDF export henüz desteklenmiyor!');
    }

    getDateRange(
      period: "day" | "week" | "month" | "year" | "custom",
      isPrevious: boolean = false
    ): [Date, Date] {
      const end = new Date();
      const start = new Date();
    
      // "custom" periyodu için mevcut tarihleri koru
      if (period === "custom") {
        return [start, end];
      }
    
      if (isPrevious) {
        switch (period) {
          case "day":
            start.setDate(start.getDate() - 1);
            end.setDate(end.getDate() - 1);
            break;
          case "week":
            start.setDate(start.getDate() - 7 - start.getDay());
            end.setDate(end.getDate() - 7 - end.getDay());
            break;
          case "month":
            start.setMonth(start.getMonth() - 1);
            start.setDate(1);
            end.setMonth(end.getMonth() - 1);
            end.setDate(new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate());
            break;
          case "year":
            start.setFullYear(start.getFullYear() - 1);
            start.setMonth(0, 1);
            end.setFullYear(end.getFullYear() - 1);
            end.setMonth(11, 31);
            break;
        }
      } else {
        switch (period) {
          case "day":
            start.setHours(0, 0, 0, 0);
            break;
          case "week":
            start.setDate(start.getDate() - start.getDay());
            start.setHours(0, 0, 0, 0);
            break;
          case "month":
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            break;
          case "year":
            start.setMonth(0, 1);
            start.setHours(0, 0, 0, 0);
            break;
        }
      }
    
      return [start, end];
    }

    formatDateRange(start: Date, end: Date): string {
      const formatDate = (date: Date) => {
        return date.toLocaleDateString('tr-TR');
      };
      return `${formatDate(start)}_${formatDate(end)}`;
    }
  }

  export const exportService = new ExportService();