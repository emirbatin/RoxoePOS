import { Sale } from '../types/sales';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import ExcelJS from 'exceljs';

interface ReportData {
  'Fiş No': string;
  'Tarih': Date;
  'Tutar': number;
  'Ödeme': string;
  'Durum': string;
  'Ürün Sayısı': number;
  'Ürünler': string;
}

class ExportService {
  private prepareData(sales: Sale[]): ReportData[] {
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

  async exportToExcel(sales: Sale[], dateRange: string) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Satışlar');

    // Başlık stilini tanımla
    const titleStyle: Partial<ExcelJS.Style> = {
      font: { size: 12, bold: true, color: { argb: 'FFFFFF' } },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '2980B9' }
      } as ExcelJS.FillPattern,
      alignment: { horizontal: 'center' }
    };

    // Para birimi stili
    const currencyStyle: Partial<ExcelJS.Style> = {
      numFmt: '#,##0.00 ₺'
    };

    // Tarih stili
    const dateStyle: Partial<ExcelJS.Style> = {
      numFmt: 'dd.mm.yyyy hh:mm'
    };

    // Verileri hazırla
    const data = this.prepareData(sales);
    const headers = Object.keys(data[0] || {}) as (keyof ReportData)[];

    // Sütunları ayarla
    worksheet.columns = headers.map(header => ({
      header,
      key: header,
      width: header === 'Ürünler' ? 50 : 15,
      style: header === 'Tutar' ? currencyStyle : 
             header === 'Tarih' ? dateStyle : {}
    }));

    // Başlık stilini uygula
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = titleStyle;
    });

    // Verileri ekle
    data.forEach(row => {
      worksheet.addRow(row as any);
    });

    // Alternatif satır renklendirmesi
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Başlık hariç
        const rowStyle: Partial<ExcelJS.Style> = {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: rowNumber % 2 === 0 ? 'F3F6F9' : 'FFFFFF' }
          } as ExcelJS.FillPattern
        };
        
        row.eachCell((cell) => {
          cell.style = rowStyle;
        });
      }
    });

    // Tüm sütunlar için ince kenarlık
    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'E2E8F0' } },
      left: { style: 'thin', color: { argb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
      right: { style: 'thin', color: { argb: 'E2E8F0' } }
    };

    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = borderStyle;
      });
    });

    // Rapor bilgilerini ekle
    worksheet.insertRow(1, []);
    worksheet.insertRow(1, [`Satış Raporu - ${dateRange}`]);
    worksheet.mergeCells('A1:G1');
    worksheet.getCell('A1').style = {
      font: { size: 14, bold: true },
      alignment: { horizontal: 'center' }
    };

    // Alt toplam
    const lastRow = worksheet.rowCount + 1;
    worksheet.mergeCells(`A${lastRow}:B${lastRow}`);
    worksheet.getCell(`A${lastRow}`).value = 'TOPLAM';
    worksheet.getCell(`A${lastRow}`).style = {
      font: { bold: true },
      alignment: { horizontal: 'right' }
    };
    
    // Toplam formülü
    worksheet.getCell(`C${lastRow}`).value = {
      formula: `SUM(C4:C${lastRow-1})`,
      date1904: false
    };
    worksheet.getCell(`C${lastRow}`).style = {
      font: { bold: true },
      numFmt: '#,##0.00 ₺'
    };

    // Excel dosyasını indir
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Satış_Raporu_${dateRange}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  async exportToPDF(sales: Sale[], dateRange: string) {
    const data = this.prepareData(sales);
    const columns = (Object.keys(data[0] || {}) as (keyof ReportData)[])
      .filter(col => col !== 'Ürünler'); // Ürünler sütununu PDF'te gösterme
    
    const doc = new jsPDF();
    
    // Başlık
    doc.setFontSize(16);
    doc.text("Satış Raporu", 14, 15);
    doc.setFontSize(10);
    doc.text(dateRange, 14, 22);
    
    // Tablo
    const tableData = data.map(item => 
      columns.map(col => col === 'Tutar' ? `₺${item[col].toFixed(2)}` : item[col].toString())
    );

    (doc as any).autoTable({
      head: [columns],
      body: tableData,
      startY: 25,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      alternateRowStyles: { fillColor: [242, 242, 242] },
    });

    // Dosyayı indir
    doc.save(`Satış_Raporu_${dateRange}.pdf`);
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