import { Sale } from '../types/sales';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import ExcelJS from 'exceljs';

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

type ReportType = 'sale' | 'product';

class ExportService {
  // Fiş bazlı veri hazırlama
  private prepareSaleData(sales: Sale[]): SaleReportData[] {
    return sales.map(sale => ({
      'Fiş No': sale.receiptNo,
      'Tarih': new Date(sale.date),
      'Tutar': sale.total,
      'Ödeme': sale.paymentMethod === 'nakit' ? 'Nakit' : 'Kredi Kartı',
      'Durum': sale.status === 'completed' ? 'Tamamlandı' : 
               sale.status === 'cancelled' ? 'İptal Edildi' : 'İade Edildi',
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

  async exportToExcel(sales: Sale[], dateRange: string, type: ReportType = 'product') {
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
    const doc = new jsPDF();
    
    if (type === 'product') {
      const data = this.prepareProductData(sales);
      
      doc.setFontSize(16);
      doc.text("Ürün Satış Raporu", 14, 15);
      doc.setFontSize(10);
      doc.text(dateRange, 14, 22);
      
      const columns = [
        'Ürün Adı',
        'Kategori',
        'Satış Adedi',
        'Toplam Ciro',
        'Toplam Kâr'
      ];

      const tableData = data.map(item => [
        item['Ürün Adı'],
        item['Kategori'],
        item['Satış Adedi'].toString(),
        `₺${item['Toplam Ciro'].toFixed(2)}`,
        `₺${item['Toplam Kâr'].toFixed(2)}`
      ]);

      (doc as any).autoTable({
        head: [columns],
        body: tableData,
        startY: 25,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
        alternateRowStyles: { fillColor: [242, 242, 242] },
      });

    } else {
      const data = this.prepareSaleData(sales);
      
      doc.setFontSize(16);
      doc.text("Satış Raporu", 14, 15);
      doc.setFontSize(10);
      doc.text(dateRange, 14, 22);
      
      const columns = ['Fiş No', 'Tarih', 'Tutar', 'Ödeme', 'Durum'];
      const tableData = data.map(item => [
        item['Fiş No'],
        new Date(item['Tarih']).toLocaleString('tr-TR'),
        `₺${item['Tutar'].toFixed(2)}`,
        item['Ödeme'],
        item['Durum']
      ]);

      (doc as any).autoTable({
        head: [columns],
        body: tableData,
        startY: 25,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
        alternateRowStyles: { fillColor: [242, 242, 242] },
      });
    }

    doc.save(`${type === 'product' ? 'Ürün_Satış_Raporu' : 'Satış_Raporu'}_${dateRange}.pdf`);
  }

  getDateRange(
    period: "day" | "week" | "month" | "year",
    isPrevious: boolean = false
  ): [Date, Date] {
    const end = new Date();
    const start = new Date();
  
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