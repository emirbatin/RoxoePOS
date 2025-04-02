import { Sale } from "../types/sales";
import ExcelJS from "exceljs";
import { getPaymentMethodDisplay } from "../helpers/paymentMethodDisplay";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  CashTransaction,
  CashTransactionType,
  CashRegisterSession,
} from "../types/cashRegister";

// Fiş bazlı rapor için interface
interface SaleReportData {
  "Fiş No": string;
  Tarih: Date;
  Tutar: number;
  Ödeme: string;
  Durum: string;
  "Ürün Sayısı": number;
  Ürünler: string;
}

// Ürün bazlı rapor için interface
interface ProductReportData {
  "Ürün Adı": string;
  Kategori: string;
  "Satış Adedi": number;
  "Birim Alış": number;
  "Birim Satış (KDV'siz)": number;
  "Birim Satış (KDV'li)": number;
  "Toplam Ciro": number;
  "Toplam Kâr": number;
  "Kâr Marjı (%)": number;
}

// Kasa verileri için geliştirilmiş interface
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
    description?: string;
  }>;
  closedSessions: CashRegisterSession[];
  transactions: CashTransaction[];
  veresiyeTransactions?: CashTransaction[]; // Veresiye tahsilatları
  salesData?: Sale[]; // Satış verileri
  productSummary?: Array<{
    productName: string;
    category: string;
    totalSales: number;
    totalRevenue: number;
    totalProfit: number;
    profitMargin: number;
  }>;
}

type ReportType = "sale" | "product" | "cash";

class ExportService {
  // Fiş bazlı veri hazırlama
  private prepareSaleData(sales: Sale[]): SaleReportData[] {
    return sales.map((sale) => ({
      "Fiş No": sale.receiptNo,
      Tarih: new Date(sale.date),
      Tutar: sale.total,
      Ödeme: getPaymentMethodDisplay(sale.paymentMethod),
      Durum:
        sale.status === "completed"
          ? "Tamamlandı"
          : sale.status === "cancelled"
          ? "İptal Edildi"
          : "İade Edildi",
      "Ürün Sayısı": sale.items.reduce((sum, item) => sum + item.quantity, 0),
      Ürünler: sale.items
        .map((item) => `${item.name} (${item.quantity} adet)`)
        .join(", "),
    }));
  }

  // Ürün bazlı veri hazırlama
  private prepareProductData(sales: Sale[]): ProductReportData[] {
    const productStats = sales.reduce((acc, sale) => {
      if (sale.status !== "completed") return acc; // Sadece tamamlanan satışları dahil et

      sale.items.forEach((item) => {
        if (!acc[item.name]) {
          acc[item.name] = {
            "Ürün Adı": item.name,
            Kategori: item.category,
            "Satış Adedi": 0,
            "Birim Alış": item.purchasePrice,
            "Birim Satış (KDV'siz)": item.salePrice,
            "Birim Satış (KDV'li)": item.priceWithVat,
            "Toplam Ciro": 0,
            "Toplam Kâr": 0,
            "Kâr Marjı (%)": 0,
          };
        }

        acc[item.name]["Satış Adedi"] += item.quantity;
        acc[item.name]["Toplam Ciro"] += item.priceWithVat * item.quantity;
        // KDV'li fiyat ile alış fiyatı arasındaki fark üzerinden kar hesaplanmalı
        acc[item.name]["Toplam Kâr"] +=
          (item.priceWithVat - item.purchasePrice) * item.quantity;
      });
      return acc;
    }, {} as Record<string, ProductReportData>);

    return Object.values(productStats).map((product) => ({
      ...product,
      "Kâr Marjı (%)": Number(
        ((product["Toplam Kâr"] / product["Toplam Ciro"]) * 100).toFixed(2)
      ),
    }));
  }

  // Kasa verilerini Excel formatına export etme - GELİŞTİRİLMİŞ VERSİYON
  async exportCashDataToExcel(data: CashExportData, title: string) {
    // Eksik verilere karşı koruma
    if (!data.dailyData || !Array.isArray(data.dailyData)) data.dailyData = [];
    if (!data.transactions || !Array.isArray(data.transactions))
      data.transactions = [];
    if (!data.closedSessions || !Array.isArray(data.closedSessions))
      data.closedSessions = [];
    if (!data.veresiyeTransactions || !Array.isArray(data.veresiyeTransactions))
      data.veresiyeTransactions = [];
    if (!data.salesData || !Array.isArray(data.salesData)) data.salesData = [];
    if (!data.productSummary || !Array.isArray(data.productSummary))
      data.productSummary = [];

    console.log("Excel'e aktarılacak veri boyutları:");
    console.log("- Günlük veriler:", data.dailyData.length);
    console.log("- İşlemler:", data.transactions.length);
    console.log("- Kapanan oturumlar:", data.closedSessions.length);
    console.log("- Veresiye işlemleri:", data.veresiyeTransactions.length);
    console.log("- Satış verileri:", data.salesData.length);
    console.log("- Ürün özeti:", data.productSummary.length);

    const workbook = new ExcelJS.Workbook();

    // Ortak stil tanımlamaları
    const headerStyle = {
      font: { size: 12, bold: true, color: { argb: "FFFFFF" } },
      fill: {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: "4472C4" },
      },
      alignment: {
        horizontal: "center" as const,
        vertical: "middle" as const,
      },
      border: {
        top: { style: "thin" as const, color: { argb: "B2B2B2" } },
        left: { style: "thin" as const, color: { argb: "B2B2B2" } },
        bottom: { style: "thin" as const, color: { argb: "B2B2B2" } },
        right: { style: "thin" as const, color: { argb: "B2B2B2" } },
      },
    };

    const titleStyle = {
      font: { size: 16, bold: true, color: { argb: "4472C4" } },
      alignment: { horizontal: "center" as const },
      border: {
        bottom: { style: "medium" as const, color: { argb: "4472C4" } },
      },
    };

    const subtitleStyle = {
      font: { size: 12, italic: true, color: { argb: "595959" } },
      alignment: { horizontal: "center" as const },
    };

    const totalRowStyle = {
      font: { bold: true, color: { argb: "000000" } },
      fill: {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: "D9E1F2" },
      },
      border: {
        top: { style: "thin" as const, color: { argb: "B2B2B2" } },
        bottom: { style: "double" as const, color: { argb: "4472C4" } },
      },
    };

    // Standart kenarlık
    const standardBorder = {
      top: { style: "thin" as const, color: { argb: "D9D9D9" } },
      left: { style: "thin" as const, color: { argb: "D9D9D9" } },
      bottom: { style: "thin" as const, color: { argb: "D9D9D9" } },
      right: { style: "thin" as const, color: { argb: "D9D9D9" } },
    };

    // ============== 1. ÖZET SAYFASI ==============
    const summarySheet = workbook.addWorksheet("Kasa Özeti");

    // Sayfa ayarları
    summarySheet.pageSetup.margins = {
      left: 0.7,
      right: 0.7,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3,
    };

    // Başlık
    summarySheet.mergeCells("A1:C1");
    summarySheet.getCell("A1").value = "KASA RAPORU ÖZETİ";
    summarySheet.getCell("A1").style = titleStyle;

    // Alt başlık (Tarih aralığı)
    const titleParts = title.split(" ");
    if (titleParts.length > 2) {
      const dateRange = titleParts.slice(2).join(" ");
      summarySheet.mergeCells("A2:C2");
      summarySheet.getCell("A2").value = dateRange;
      summarySheet.getCell("A2").style = subtitleStyle;
    }

    // Boşluk
    summarySheet.addRow([]);

    // Özet tablo başlık satırı - Doğrudan dizi olarak ekle
    const summaryHeaderRow = summarySheet.addRow([
      "Açıklama",
      "Tutar",
      "Birim",
    ]);
    summaryHeaderRow.eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Sütun genişliklerini ayarla
    summarySheet.getColumn(1).width = 30;
    summarySheet.getColumn(2).width = 15;
    summarySheet.getColumn(3).width = 10;

    // Özet veriler
    const summaryData = [
      ["Açılış Bakiyesi", data.summary.openingBalance, "₺"],
      ["Güncel Bakiye", data.summary.currentBalance, "₺"],
      ["Toplam Nakit Girişler", data.summary.totalDeposits, "₺"],
      ["Toplam Nakit Çıkışlar", data.summary.totalWithdrawals, "₺"],
      ["Veresiye Tahsilatları", data.summary.veresiyeCollections, "₺"],
      ["Nakit Satış Toplamı", data.summary.cashSalesTotal, "₺"],
      ["Kredi Kartı Satış Toplamı", data.summary.cardSalesTotal, "₺"],
      [
        "Toplam Satış Tutarı",
        data.summary.cashSalesTotal + data.summary.cardSalesTotal,
        "₺",
      ],
    ];

    // Veri satırlarını ekle
    summaryData.forEach((row, index) => {
      const dataRow = summarySheet.addRow(row);
      dataRow.getCell(2).numFmt = "#,##0.00";

      // Alternatif satır renklendirme
      if (index % 2 === 0) {
        dataRow.eachCell((cell) => {
          cell.fill = {
            type: "pattern" as const,
            pattern: "solid" as const,
            fgColor: { argb: "F2F2F2" },
          };
        });
      }

      // Tüm hücrelere kenarlık ekle
      dataRow.eachCell((cell) => {
        cell.border = standardBorder;
      });

      // Birinci sütun hücreleri sol hizalı ve kalın
      dataRow.getCell(1).alignment = { horizontal: "left" as const };
      dataRow.getCell(1).font = { bold: true };

      // Tutar sağa hizalı
      dataRow.getCell(2).alignment = { horizontal: "right" as const };

      // Birim merkeze hizalı
      dataRow.getCell(3).alignment = { horizontal: "center" as const };
    });

    // Son satırı görsel olarak belirginleştir (Toplam)
    const lastRow = summarySheet.lastRow;
    if (lastRow) {
      lastRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: "D9E1F2" },
        };
        cell.border = {
          top: { style: "thin" as const, color: { argb: "B2B2B2" } },
          left: { style: "thin" as const, color: { argb: "B2B2B2" } },
          bottom: { style: "double" as const, color: { argb: "4472C4" } },
          right: { style: "thin" as const, color: { argb: "B2B2B2" } },
        };
      });
    }

    // ============== 2. GÜNLÜK VERİLER SAYFASI ==============
    const dailySheet = workbook.addWorksheet("Günlük Veriler");

    // Aynı sayfa ayarları
    dailySheet.pageSetup.margins = {
      left: 0.7,
      right: 0.7,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3,
    };

    // Başlık
    dailySheet.mergeCells("A1:F1");
    dailySheet.getCell("A1").value = "GÜNLÜK KASA HAREKETLERİ";
    dailySheet.getCell("A1").style = titleStyle;

    // Alt başlık (tarih aralığı)
    if (titleParts.length > 2) {
      const dateRange = titleParts.slice(2).join(" ");
      dailySheet.mergeCells("A2:F2");
      dailySheet.getCell("A2").value = dateRange;
      dailySheet.getCell("A2").style = subtitleStyle;
    }

    // Boşluk
    dailySheet.addRow([]);

    // Sütun genişlikleri
    dailySheet.getColumn(1).width = 15; // Tarih
    dailySheet.getColumn(2).width = 15; // Nakit Girişler
    dailySheet.getColumn(3).width = 15; // Nakit Çıkışlar
    dailySheet.getColumn(4).width = 20; // Veresiye Tahsilatları
    dailySheet.getColumn(5).width = 15; // Günlük Toplam
    dailySheet.getColumn(6).width = 40; // Açıklama

    // Başlık satırı - Doğrudan satır olarak ekle
    const dailyHeaders = [
      "Tarih",
      "Nakit Girişler",
      "Nakit Çıkışlar",
      "Veresiye Tahsilatları",
      "Günlük Toplam",
      "Açıklama",
    ];
    const dailyHeaderRow = dailySheet.addRow(dailyHeaders);

    // Başlık stilini ayarla
    dailyHeaderRow.eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Günlük verileri ekle
    data.dailyData.forEach((day, index) => {
      const row = dailySheet.addRow([
        day.date,
        day.deposits,
        day.withdrawals,
        day.veresiye,
        day.total,
        day.description ||
          `${
            day.deposits > 0
              ? "Nakit Giriş: " + day.deposits.toFixed(2) + "₺"
              : ""
          } ${
            day.withdrawals > 0
              ? "Nakit Çıkış: " + day.withdrawals.toFixed(2) + "₺"
              : ""
          } ${
            day.veresiye > 0
              ? "Veresiye Tahsilatı: " + day.veresiye.toFixed(2) + "₺"
              : ""
          }`.trim(),
      ]);

      // Alternatif satır stilizasyonu
      if (index % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern" as const,
            pattern: "solid" as const,
            fgColor: { argb: "F2F2F2" },
          };
        });
      }

      // Tüm hücrelere kenarlık ekle
      row.eachCell((cell) => {
        cell.border = standardBorder;
      });

      // Hücre hizalamaları
      row.getCell(1).alignment = { horizontal: "center" as const };
      row.getCell(2).alignment = { horizontal: "right" as const };
      row.getCell(2).numFmt = "#,##0.00 ₺";
      row.getCell(3).alignment = { horizontal: "right" as const };
      row.getCell(3).numFmt = "#,##0.00 ₺";
      row.getCell(4).alignment = { horizontal: "right" as const };
      row.getCell(4).numFmt = "#,##0.00 ₺";
      row.getCell(5).alignment = { horizontal: "right" as const };
      row.getCell(5).numFmt = "#,##0.00 ₺";
      row.getCell(6).alignment = {
        horizontal: "left" as const,
        wrapText: true,
      };
    });

    // Toplamlar satırı
    const totalRow = dailySheet.addRow([
      "TOPLAM",
      data.dailyData.reduce((sum, day) => sum + day.deposits, 0),
      data.dailyData.reduce((sum, day) => sum + day.withdrawals, 0),
      data.dailyData.reduce((sum, day) => sum + day.veresiye, 0),
      data.dailyData.reduce((sum, day) => sum + day.total, 0),
      "Toplam değerler",
    ]);

    // Toplam satırının stil ve formatını ayarla
    totalRow.eachCell((cell) => {
      cell.style = totalRowStyle;
    });

    totalRow.getCell(2).numFmt = "#,##0.00 ₺";
    totalRow.getCell(3).numFmt = "#,##0.00 ₺";
    totalRow.getCell(4).numFmt = "#,##0.00 ₺";
    totalRow.getCell(5).numFmt = "#,##0.00 ₺";

    // ============== 3. İŞLEM GEÇMİŞİ SAYFASI ==============
    const transactionsSheet = workbook.addWorksheet("İşlem Geçmişi");

    // Sayfa ayarları
    transactionsSheet.pageSetup.margins = {
      left: 0.7,
      right: 0.7,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3,
    };

    // Başlık
    transactionsSheet.mergeCells("A1:G1");
    transactionsSheet.getCell("A1").value = "TÜM KASA İŞLEMLERİ";
    transactionsSheet.getCell("A1").style = titleStyle;

    // Alt başlık
    if (titleParts.length > 2) {
      const dateRange = titleParts.slice(2).join(" ");
      transactionsSheet.mergeCells("A2:G2");
      transactionsSheet.getCell("A2").value = dateRange;
      transactionsSheet.getCell("A2").style = subtitleStyle;
    }

    // Boşluk
    transactionsSheet.addRow([]);

    // Sütun genişlikleri
    transactionsSheet.getColumn(1).width = 20; // Tarih
    transactionsSheet.getColumn(2).width = 20; // Oturum
    transactionsSheet.getColumn(3).width = 15; // İşlem Türü
    transactionsSheet.getColumn(4).width = 15; // Tutar
    transactionsSheet.getColumn(5).width = 30; // Açıklama
    transactionsSheet.getColumn(6).width = 15; // Kategori
    transactionsSheet.getColumn(7).width = 30; // İşlem Detayı

    // Başlık satırını oluştur
    const transactionHeaders = [
      "Tarih",
      "Oturum",
      "İşlem Türü",
      "Tutar",
      "Açıklama",
      "Kategori",
      "İşlem Detayı",
    ];
    const transactionHeaderRow = transactionsSheet.addRow(transactionHeaders);

    // Başlık stilini ayarla
    transactionHeaderRow.eachCell((cell) => {
      cell.style = headerStyle;
    });

    // İşlem verilerini ekle
    if (data.transactions && data.transactions.length > 0) {
      data.transactions.forEach((transaction, index) => {
        const isVeresiye = transaction.description
          ?.toLowerCase()
          .includes("veresiye");

        // İşlem kategorisi belirleme
        let category = "";
        if (transaction.type === CashTransactionType.DEPOSIT) {
          category = isVeresiye ? "Veresiye Tahsilatı" : "Nakit Giriş";
        } else {
          category = "Nakit Çıkış";
        }

        // Detay bilgisi çıkarma (Müşteri adı vs.)
        let details = "";
        if (isVeresiye) {
          const match = transaction.description?.match(
            /Veresiye Tahsilatı - (.+)/
          );
          if (match && match[1]) {
            details = `Müşteri: ${match[1]}`;
          }
        }

        // Geçici özellikleri kontrol et ve kullan
        const formattedDate =
          (transaction as any).formattedDate ||
          new Date(transaction.date).toLocaleString("tr-TR");
        const sessionName =
          (transaction as any).sessionName || "Oturum Bilgisi Yok";

        // Satır oluştur
        const row = transactionsSheet.addRow([
          formattedDate,
          sessionName,
          transaction.type === CashTransactionType.DEPOSIT ? "Giriş" : "Çıkış",
          transaction.amount,
          transaction.description || "",
          category,
          details,
        ]);

        // İşlem türüne göre satır rengini ayarla
        if (transaction.type === CashTransactionType.DEPOSIT) {
          if (isVeresiye) {
            // Veresiye tahsilatları için açık mor
            row.eachCell((cell) => {
              cell.fill = {
                type: "pattern" as const,
                pattern: "solid" as const,
                fgColor: { argb: "E3DFFD" },
              };
            });
          } else {
            // Diğer nakit girişleri için açık yeşil
            row.eachCell((cell) => {
              cell.fill = {
                type: "pattern" as const,
                pattern: "solid" as const,
                fgColor: { argb: "DCFCE7" },
              };
            });
          }
        } else {
          // Nakit çıkışları için açık kırmızı
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern" as const,
              pattern: "solid" as const,
              fgColor: { argb: "FECACA" },
            };
          });
        }

        // Tüm hücrelere kenarlık ekle
        row.eachCell((cell) => {
          cell.border = standardBorder;
        });

        // Hücre hizalamaları ve formatları
        row.getCell(1).alignment = { horizontal: "center" as const };
        row.getCell(2).alignment = { horizontal: "center" as const };
        row.getCell(3).alignment = { horizontal: "center" as const };
        row.getCell(4).alignment = { horizontal: "right" as const };
        row.getCell(4).numFmt = "#,##0.00 ₺";
        row.getCell(5).alignment = {
          horizontal: "left" as const,
          wrapText: true,
        };
        row.getCell(6).alignment = { horizontal: "center" as const };
        row.getCell(7).alignment = {
          horizontal: "left" as const,
          wrapText: true,
        };
      });

      // İşlemler için toplam satırı
      const transactionTotals = [
        "TOPLAM",
        "",
        "",
        data.transactions.reduce((sum, tx) => {
          return tx.type === CashTransactionType.DEPOSIT
            ? sum + tx.amount
            : sum - tx.amount;
        }, 0),
        `${data.transactions.length} işlem`,
        "",
        `Girişler: ${
          data.transactions.filter(
            (t) => t.type === CashTransactionType.DEPOSIT
          ).length
        } adet / Çıkışlar: ${
          data.transactions.filter(
            (t) => t.type !== CashTransactionType.DEPOSIT
          ).length
        } adet`,
      ];

      const txTotalRow = transactionsSheet.addRow(transactionTotals);
      txTotalRow.eachCell((cell) => {
        cell.style = totalRowStyle;
      });

      txTotalRow.getCell(4).numFmt = "#,##0.00 ₺";
    } else {
      // Veri yoksa bilgi mesajı ekle
      transactionsSheet.mergeCells("A5:G5");
      transactionsSheet.getCell("A5").value =
        "Bu tarih aralığında işlem kaydı bulunmamaktadır.";
      transactionsSheet.getCell("A5").style = {
        alignment: { horizontal: "center" as const },
        font: { italic: true, color: { argb: "888888" } },
      };
    }

    // ============== 4. SATILAN ÜRÜNLER SAYFASI (KOŞULLU) ==============
    if (data.salesData && data.salesData.length > 0) {
      const productsSheet = workbook.addWorksheet("Satılan Ürünler");

      // Sayfa ayarları
      productsSheet.pageSetup.margins = {
        left: 0.7,
        right: 0.7,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3,
      };

      // Başlık satırı - Doğrudan satır olarak ekle
      const productHeaders = [
        "Ürün Adı",
        "Kategori",
        "Satış Adedi",
        "Birim Alış",
        "Birim Satış (KDV'siz)",
        "Birim Satış (KDV'li)",
        "Toplam Ciro",
        "Toplam Kâr",
        "Kâr Marjı (%)",
      ];
      const productsHeaderRow = productsSheet.addRow(productHeaders);

      // Başlık stilini ayarla
      productsHeaderRow.eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Ürün verilerini hazırla
      const productsData = this.prepareProductData(data.salesData);

      // Ürün verilerini ekle
      productsData.forEach((product, index) => {
        const row = productsSheet.addRow([
          product["Ürün Adı"],
          product["Kategori"],
          product["Satış Adedi"],
          product["Birim Alış"],
          product["Birim Satış (KDV'siz)"],
          product["Birim Satış (KDV'li)"],
          product["Toplam Ciro"],
          product["Toplam Kâr"],
          product["Kâr Marjı (%)"],
        ]);

        // Alternatif satır stilizasyonu
        if (index % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern" as const,
              pattern: "solid" as const,
              fgColor: { argb: "F2F2F2" },
            };
          });
        }

        // Kâr marjına göre satır renklendirme
        const profitMargin = product["Kâr Marjı (%)"];
        if (profitMargin < 0) {
          // Negatif kâr marjı için farklı renk
          row.getCell(9).font = { color: { argb: "FF0000" } }; // Kırmızı
          row.getCell(8).font = { color: { argb: "FF0000" } }; // Kırmızı
        } else if (profitMargin > 30) {
          // Yüksek kâr marjı için farklı renk
          row.getCell(9).font = { color: { argb: "008000" } }; // Yeşil
          row.getCell(8).font = { color: { argb: "008000" } }; // Yeşil
        }

        // Tüm hücrelere kenarlık ekle
        row.eachCell((cell) => {
          cell.border = standardBorder;
        });

        // Hücre hizalamaları ve formatları
        row.getCell(1).alignment = {
          horizontal: "left" as const,
          wrapText: true,
        };
        row.getCell(2).alignment = { horizontal: "center" as const };
        row.getCell(3).alignment = { horizontal: "center" as const };
        row.getCell(4).alignment = { horizontal: "right" as const };
        row.getCell(4).numFmt = "#,##0.00 ₺";
        row.getCell(5).alignment = { horizontal: "right" as const };
        row.getCell(5).numFmt = "#,##0.00 ₺";
        row.getCell(6).alignment = { horizontal: "right" as const };
        row.getCell(6).numFmt = "#,##0.00 ₺";
        row.getCell(7).alignment = { horizontal: "right" as const };
        row.getCell(7).numFmt = "#,##0.00 ₺";
        row.getCell(8).alignment = { horizontal: "right" as const };
        row.getCell(8).numFmt = "#,##0.00 ₺";
        row.getCell(9).alignment = { horizontal: "right" as const };
        row.getCell(9).numFmt = "#,##0.00";
      });

      // Toplam satırı
      const productTotals = [
        "TOPLAM",
        "",
        productsData.reduce((sum, row) => sum + row["Satış Adedi"], 0),
        null,
        null,
        null,
        productsData.reduce((sum, row) => sum + row["Toplam Ciro"], 0),
        productsData.reduce((sum, row) => sum + row["Toplam Kâr"], 0),
        productsData.length > 0
          ? Number(
              (
                (productsData.reduce((sum, row) => sum + row["Toplam Kâr"], 0) /
                  productsData.reduce(
                    (sum, row) => sum + row["Toplam Ciro"],
                    0
                  )) *
                100
              ).toFixed(2)
            )
          : 0,
      ];

      const productsTotalRow = productsSheet.addRow(productTotals);
      productsTotalRow.eachCell((cell) => {
        cell.style = totalRowStyle;
      });

      // Toplam satırı formatları
      productsTotalRow.getCell(7).numFmt = "#,##0.00 ₺";
      productsTotalRow.getCell(8).numFmt = "#,##0.00 ₺";
      productsTotalRow.getCell(9).numFmt = "#,##0.00";
    }

    // ============== 5. VERESİYE TAHSİLATLARI SAYFASI (KOŞULLU) ==============
    if (data.veresiyeTransactions && data.veresiyeTransactions.length > 0) {
      const veresiyeSheet = workbook.addWorksheet("Veresiye Tahsilatları");

      // Sayfa ayarları
      veresiyeSheet.pageSetup.margins = {
        left: 0.7,
        right: 0.7,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3,
      };

      // Başlık
      veresiyeSheet.mergeCells("A1:F1");
      veresiyeSheet.getCell("A1").value = "VERESİYE TAHSİLATLARI RAPORU";
      veresiyeSheet.getCell("A1").style = titleStyle;

      // Alt başlık (tarih aralığı)
      if (titleParts.length > 2) {
        const dateRange = titleParts.slice(2).join(" ");
        veresiyeSheet.mergeCells("A2:F2");
        veresiyeSheet.getCell("A2").value = dateRange;
        veresiyeSheet.getCell("A2").style = subtitleStyle;
      }

      // Boşluk
      veresiyeSheet.addRow([]);

      // Sütun genişlikleri
      veresiyeSheet.getColumn(1).width = 20; // Tarih
      veresiyeSheet.getColumn(2).width = 30; // Müşteri Adı
      veresiyeSheet.getColumn(3).width = 18; // Tahsilat Tutarı
      veresiyeSheet.getColumn(4).width = 35; // Açıklama
      veresiyeSheet.getColumn(5).width = 20; // İşlem ID
      veresiyeSheet.getColumn(6).width = 20; // Session ID

      // Başlık satırı - Doğrudan satır olarak ekle
      const veresiyeHeaders = [
        "Tarih",
        "Müşteri Adı",
        "Tahsilat Tutarı",
        "Açıklama",
        "İşlem ID",
        "Session ID",
      ];
      const veresiyeHeaderRow = veresiyeSheet.addRow(veresiyeHeaders);

      // Başlık stilini ayarla
      veresiyeHeaderRow.eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Veresiye işlemlerini ekle
      data.veresiyeTransactions.forEach((transaction, index) => {
        let customerName = "Bilinmiyor";
        const match = transaction.description?.match(
          /Veresiye Tahsilatı - (.+)/
        );
        if (match && match[1]) {
          customerName = match[1];
        }

        // Geçici özellikleri kontrol et ve kullan
        const formattedDate =
          (transaction as any).formattedDate ||
          new Date(transaction.date).toLocaleString("tr-TR");

        // Satır oluştur
        const row = veresiyeSheet.addRow([
          formattedDate,
          customerName,
          transaction.amount,
          transaction.description || "",
          transaction.id,
          transaction.sessionId,
        ]);

        // Alternatif satır stilizasyonu
        if (index % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern" as const,
              pattern: "solid" as const,
              fgColor: { argb: "F2F2F2" },
            };
          });
        }

        // Tüm hücrelere kenarlık ekle
        row.eachCell((cell) => {
          cell.border = standardBorder;
        });

        // Hücre hizalamaları ve formatları
        row.getCell(1).alignment = { horizontal: "center" as const };
        row.getCell(2).alignment = { horizontal: "left" as const };
        row.getCell(3).alignment = { horizontal: "right" as const };
        row.getCell(3).numFmt = "#,##0.00 ₺";
        row.getCell(4).alignment = {
          horizontal: "left" as const,
          wrapText: true,
        };
        row.getCell(5).alignment = { horizontal: "center" as const };
        row.getCell(6).alignment = { horizontal: "center" as const };
      });

      // Toplam satırı
      const veresiyeTotals = [
        "TOPLAM",
        "",
        data.veresiyeTransactions.reduce((sum, tx) => sum + tx.amount, 0),
        `${data.veresiyeTransactions.length} adet tahsilat`,
        "",
        "",
      ];

      const veresiyeTotalRow = veresiyeSheet.addRow(veresiyeTotals);
      veresiyeTotalRow.eachCell((cell) => {
        cell.style = totalRowStyle;
      });

      veresiyeTotalRow.getCell(3).numFmt = "#,##0.00 ₺";

      // Boşluk
      veresiyeSheet.addRow([]);
      veresiyeSheet.addRow([]);

      // Müşteri Bazlı Özet Başlığı - geliştirilmiş tasarım
      const summaryTitle = veresiyeSheet.addRow(["MÜŞTERİ BAZLI ÖZET"]);
      summaryTitle.getCell(1).style = {
        font: { size: 14, bold: true, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: "4472C4" }, // Aynı mavi renk
        },
        alignment: { horizontal: "center" as const },
      };
      veresiyeSheet.mergeCells(
        `A${veresiyeSheet.rowCount}:F${veresiyeSheet.rowCount}`
      );

      // Müşteri özet tablo başlıkları
      const customerHeaders = [
        "Müşteri Adı",
        "Tahsilat Sayısı",
        "Toplam Tahsilat",
      ];
      const customerHeaderRow = veresiyeSheet.addRow(customerHeaders);

      // Müşteri başlık satırını formatla
      customerHeaderRow.getCell(1).style = headerStyle;
      customerHeaderRow.getCell(2).style = headerStyle;
      customerHeaderRow.getCell(3).style = headerStyle;
      veresiyeSheet.mergeCells(
        `D${veresiyeSheet.rowCount}:F${veresiyeSheet.rowCount}`
      );

      // Müşterileri grupla
      const customerSummary = data.veresiyeTransactions.reduce(
        (summary, tx) => {
          let customerName = "Bilinmiyor";
          const match = tx.description?.match(/Veresiye Tahsilatı - (.+)/);
          if (match && match[1]) {
            customerName = match[1];
          }

          if (!summary[customerName]) {
            summary[customerName] = {
              count: 0,
              total: 0,
            };
          }

          summary[customerName].count++;
          summary[customerName].total += tx.amount;

          return summary;
        },
        {} as Record<string, { count: number; total: number }>
      );

      // Müşteri özet satırları
      Object.entries(customerSummary).forEach(([customer, data], index) => {
        const row = veresiyeSheet.addRow([customer, data.count, data.total]);

        // Sayı formatı
        row.getCell(3).numFmt = "#,##0.00 ₺";

        // Hizalama
        row.getCell(1).alignment = { horizontal: "left" as const };
        row.getCell(2).alignment = { horizontal: "center" as const };
        row.getCell(3).alignment = { horizontal: "right" as const };

        // Birleştirme
        veresiyeSheet.mergeCells(
          `D${veresiyeSheet.rowCount}:F${veresiyeSheet.rowCount}`
        );

        // Alternatif satır renklendirme
        if (index % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern" as const,
              pattern: "solid" as const,
              fgColor: { argb: "F2F2F2" },
            };
          });
        }

        // Tüm hücrelere kenarlık ekle
        row.eachCell((cell, colNumber) => {
          if (colNumber <= 3) {
            // İlk 3 sütun için kenarlık
            cell.border = standardBorder;
          }
        });
      });

      // Müşteri toplamları
      const customerTotal = veresiyeSheet.addRow([
        "TOPLAM",
        Object.values(customerSummary).reduce((sum, d) => sum + d.count, 0),
        Object.values(customerSummary).reduce((sum, d) => sum + d.total, 0),
      ]);

      // Sayı formatı
      customerTotal.getCell(3).numFmt = "#,##0.00 ₺";

      // Toplam satırı stili
      customerTotal.eachCell((cell, colNumber) => {
        if (colNumber <= 3) {
          cell.style = totalRowStyle;
        }
      });

      // Birleştirme
      veresiyeSheet.mergeCells(
        `D${veresiyeSheet.rowCount}:F${veresiyeSheet.rowCount}`
      );
    }

    // Excel'i indir
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/ /g, "_")}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);

    return true;
  }

  async exportToExcel(
    sales: Sale[],
    dateRange: string,
    type: ReportType = "product"
  ) {
    // Eğer kasa raporu isteniyorsa uyarı göster ve fonksiyondan çık
    if (type === "cash") {
      console.error(
        "Kasa verileri için exportCashDataToExcel fonksiyonunu kullanın."
      );
      throw new Error(
        "Kasa verileri için exportCashDataToExcel fonksiyonunu kullanın."
      );
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(
      type === "product" ? "Ürün Satışları" : "Satışlar"
    );

    if (type === "product") {
      const data = this.prepareProductData(sales);

      worksheet.columns = [
        { header: "Ürün Adı", key: "Ürün Adı", width: 30 },
        { header: "Kategori", key: "Kategori", width: 20 },
        { header: "Satış Adedi", key: "Satış Adedi", width: 15 },
        {
          header: "Birim Alış",
          key: "Birim Alış",
          width: 15,
          style: { numFmt: "#,##0.00 ₺" },
        },
        {
          header: "Birim Satış (KDV'siz)",
          key: "Birim Satış (KDV'siz)",
          width: 20,
          style: { numFmt: "#,##0.00 ₺" },
        },
        {
          header: "Birim Satış (KDV'li)",
          key: "Birim Satış (KDV'li)",
          width: 20,
          style: { numFmt: "#,##0.00 ₺" },
        },
        {
          header: "Toplam Ciro",
          key: "Toplam Ciro",
          width: 15,
          style: { numFmt: "#,##0.00 ₺" },
        },
        {
          header: "Toplam Kâr",
          key: "Toplam Kâr",
          width: 15,
          style: { numFmt: "#,##0.00 ₺" },
        },
        {
          header: "Kâr Marjı (%)",
          key: "Kâr Marjı (%)",
          width: 15,
          style: { numFmt: "#,##0.00" },
        },
      ];

      data.forEach((row) => worksheet.addRow(row));

      // Toplam satırı
      const totals = {
        "Ürün Adı": "TOPLAM",
        Kategori: "",
        "Satış Adedi": data.reduce((sum, row) => sum + row["Satış Adedi"], 0),
        "Birim Alış": null,
        "Birim Satış (KDV'siz)": null,
        "Birim Satış (KDV'li)": null,
        "Toplam Ciro": data.reduce((sum, row) => sum + row["Toplam Ciro"], 0),
        "Toplam Kâr": data.reduce((sum, row) => sum + row["Toplam Kâr"], 0),
        "Kâr Marjı (%)": Number(
          (
            (data.reduce((sum, row) => sum + row["Toplam Kâr"], 0) /
              data.reduce((sum, row) => sum + row["Toplam Ciro"], 0)) *
            100
          ).toFixed(2)
        ),
      };
      worksheet.addRow(totals);
    } else {
      const data = this.prepareSaleData(sales);

      worksheet.columns = [
        { header: "Fiş No", key: "Fiş No", width: 15 },
        {
          header: "Tarih",
          key: "Tarih",
          width: 20,
          style: { numFmt: "dd.mm.yyyy hh:mm" },
        },
        {
          header: "Tutar",
          key: "Tutar",
          width: 15,
          style: { numFmt: "#,##0.00 ₺" },
        },
        { header: "Ödeme", key: "Ödeme", width: 15 },
        { header: "Durum", key: "Durum", width: 15 },
        { header: "Ürün Sayısı", key: "Ürün Sayısı", width: 15 },
        { header: "Ürünler", key: "Ürünler", width: 50 },
      ];

      data.forEach((row) => worksheet.addRow(row));
    }

    // Başlık stili
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = {
        font: { size: 12, bold: true, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "2980B9" },
        } as ExcelJS.FillPattern,
        alignment: { horizontal: "center" },
      };
    });

    // Rapor başlığı
    const title = type === "product" ? "Ürün Satış Raporu" : "Satış Raporu";
    worksheet.insertRow(1, []);
    worksheet.insertRow(1, [`${title} - ${dateRange}`]);
    worksheet.mergeCells("A1:I1"); // KDV'li ve KDV'siz sütunlar eklendiği için A1:I1 olarak güncelledim
    worksheet.getCell("A1").style = {
      font: { size: 14, bold: true },
      alignment: { horizontal: "center" },
    };

    // Excel'i indir
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${
      type === "product" ? "Ürün_Satış_Raporu" : "Satış_Raporu"
    }_${dateRange}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  async exportToPDF(
    sales: Sale[],
    dateRange: string,
    type: ReportType = "product"
  ) {
    // Eğer kasa raporu isteniyorsa uyarı göster
    if (type === "cash") {
      console.error("Kasa raporları için PDF export henüz desteklenmiyor!");
      throw new Error("Kasa raporları için PDF export henüz desteklenmiyor!");
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
    const columnWidth = (width - margin * 2) / (type === "product" ? 8 : 6); // KDV'li ve KDV'siz kolonlar için 8'e çıkardım

    // Rapor Başlığı
    page.drawText(type === "product" ? "Ürün Satış Raporu" : "Satış Raporu", {
      x:
        width / 2 -
        helveticaBold.widthOfTextAtSize("Ürün Satış Raporu", 16) / 2,
      y: height - margin,
      size: 16,
      font: helveticaBold,
    });

    // Tarih Aralığı
    page.drawText(dateRange, {
      x: width / 2 - helvetica.widthOfTextAtSize(dateRange, 10) / 2,
      y: height - margin - 20,
      size: 10,
      font: helvetica,
    });

    // Tablo başlıkları için Y pozisyonu
    let y = height - margin - 50;

    // Tablo oluşturma fonksiyonu - Yardımcı metot
    const drawTableHeader = (columns: string[], y: number) => {
      // Tablo başlık arka planı
      page.drawRectangle({
        x: margin,
        y: y - 15,
        width: width - margin * 2,
        height: 20,
        color: rgb(0.16, 0.5, 0.73), // #2980B9
      });

      // Tablo başlıkları
      columns.forEach((title, i) => {
        page.drawText(title, {
          x: margin + columnWidth * i + 5,
          y: y - 10,
          size: 10,
          font: helveticaBold,
          color: rgb(1, 1, 1), // white
        });
      });

      return y - 25; // Bir sonraki satır için Y pozisyonu
    };

    if (type === "product") {
      const data = this.prepareProductData(sales);
      const columns = [
        "Ürün Adı",
        "Kategori",
        "Adet",
        "Alış",
        "Satış (KDV'siz)",
        "Satış (KDV'li)",
        "Ciro",
        "Kâr",
      ];

      y = drawTableHeader(columns, y);

      // Tablo satırları
      data.forEach((item, i) => {
        // Her ikinci satır için arka plan
        if (i % 2 === 0) {
          page.drawRectangle({
            x: margin,
            y: y - 15,
            width: width - margin * 2,
            height: 20,
            color: rgb(0.95, 0.95, 0.95), // Light gray
          });
        }

        // Ürün adı (kısaltılmış)
        let productName = item["Ürün Adı"];
        if (productName.length > 25) {
          productName = productName.substring(0, 22) + "...";
        }

        page.drawText(productName, {
          x: margin + 5,
          y: y - 10,
          size: 9,
          font: helvetica,
        });

        // Kategori
        let category = item["Kategori"] || "";
        if (category.length > 15) {
          category = category.substring(0, 12) + "...";
        }

        page.drawText(category, {
          x: margin + columnWidth + 5,
          y: y - 10,
          size: 9,
          font: helvetica,
        });

        // Satış Adedi
        page.drawText(item["Satış Adedi"].toString(), {
          x: margin + columnWidth * 2 + 5,
          y: y - 10,
          size: 9,
          font: helvetica,
        });

        // Birim Alış
        page.drawText(`₺${item["Birim Alış"].toFixed(2)}`, {
          x: margin + columnWidth * 3 + 5,
          y: y - 10,
          size: 9,
          font: helvetica,
        });

        // Birim Satış (KDV'siz)
        page.drawText(`₺${item["Birim Satış (KDV'siz)"].toFixed(2)}`, {
          x: margin + columnWidth * 4 + 5,
          y: y - 10,
          size: 9,
          font: helvetica,
        });

        // Birim Satış (KDV'li)
        page.drawText(`₺${item["Birim Satış (KDV'li)"].toFixed(2)}`, {
          x: margin + columnWidth * 5 + 5,
          y: y - 10,
          size: 9,
          font: helvetica,
        });

        // Toplam Ciro
        page.drawText(`₺${item["Toplam Ciro"].toFixed(2)}`, {
          x: margin + columnWidth * 6 + 5,
          y: y - 10,
          size: 9,
          font: helvetica,
        });

        // Toplam Kâr
        page.drawText(`₺${item["Toplam Kâr"].toFixed(2)}`, {
          x: margin + columnWidth * 7 + 5,
          y: y - 10,
          size: 9,
          font: helvetica,
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
        width: width - margin * 2,
        height: 25,
        color: rgb(0.9, 0.9, 0.9), // Biraz daha koyu gri
      });

      // TOPLAM yazısı
      page.drawText("TOPLAM", {
        x: margin + 5,
        y: y - 10,
        size: 10,
        font: helveticaBold,
      });

      // Toplam Satış Adedi
      const totalQuantity = data.reduce(
        (sum, row) => sum + row["Satış Adedi"],
        0
      );
      page.drawText(totalQuantity.toString(), {
        x: margin + columnWidth * 2 + 5,
        y: y - 10,
        size: 10,
        font: helveticaBold,
      });

      // Birim alış ve satış için boş değerler

      // Toplam Ciro
      const totalRevenue = data.reduce(
        (sum, row) => sum + row["Toplam Ciro"],
        0
      );
      page.drawText(`₺${totalRevenue.toFixed(2)}`, {
        x: margin + columnWidth * 6 + 5,
        y: y - 10,
        size: 10,
        font: helveticaBold,
      });

      // Toplam Kâr
      const totalProfit = data.reduce((sum, row) => sum + row["Toplam Kâr"], 0);
      page.drawText(`₺${totalProfit.toFixed(2)}`, {
        x: margin + columnWidth * 7 + 5,
        y: y - 10,
        size: 10,
        font: helveticaBold,
      });
    } else {
      // Satış raporu
      const data = this.prepareSaleData(sales);
      const columns = ["Fiş No", "Tarih", "Tutar", "Ödeme", "Durum", "Adet"];

      y = drawTableHeader(columns, y);

      // Tablo satırları
      data.forEach((item, i) => {
        // Her ikinci satır için arka plan
        if (i % 2 === 0) {
          page.drawRectangle({
            x: margin,
            y: y - 15,
            width: width - margin * 2,
            height: 20,
            color: rgb(0.95, 0.95, 0.95), // Light gray
          });
        }

        // Fiş No
        page.drawText(item["Fiş No"], {
          x: margin + 5,
          y: y - 10,
          size: 9,
          font: helvetica,
        });

        // Tarih
        const dateString =
          item["Tarih"] instanceof Date
            ? item["Tarih"].toLocaleString("tr-TR", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : new Date(item["Tarih"]).toLocaleString("tr-TR");

        page.drawText(dateString, {
          x: margin + columnWidth + 5,
          y: y - 10,
          size: 9,
          font: helvetica,
        });

        // Tutar
        page.drawText(`₺${item["Tutar"].toFixed(2)}`, {
          x: margin + columnWidth * 2 + 5,
          y: y - 10,
          size: 9,
          font: helvetica,
        });

        // Ödeme
        page.drawText(item["Ödeme"], {
          x: margin + columnWidth * 3 + 5,
          y: y - 10,
          size: 9,
          font: helvetica,
        });

        // Durum
        page.drawText(item["Durum"], {
          x: margin + columnWidth * 4 + 5,
          y: y - 10,
          size: 9,
          font: helvetica,
        });

        // Ürün Sayısı
        page.drawText(item["Ürün Sayısı"].toString(), {
          x: margin + columnWidth * 5 + 5,
          y: y - 10,
          size: 9,
          font: helvetica,
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
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${
      type === "product" ? "Ürün_Satış_Raporu" : "Satış_Raporu"
    }_${dateRange}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Kasa verileri için PDF export fonksiyonu (gelecekte geliştirilebilir)
  async exportCashDataToPDF(data: CashExportData, title: string) {
    // Bu özellik henüz desteklenmiyor
    throw new Error("Kasa raporları için PDF export henüz desteklenmiyor!");
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
          end.setDate(
            new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate()
          );
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
      return date.toLocaleDateString("tr-TR");
    };
    return `${formatDate(start)}_${formatDate(end)}`;
  }
}

export const exportService = new ExportService();
