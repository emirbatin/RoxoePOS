import React from 'react';
import { Calendar, FileText, Download, ChevronDown } from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

interface DashboardFiltersProps {
  startDate: Date;
  endDate: Date;
  onDateChange: (start: Date, end: Date) => void;
  period: "day" | "week" | "month" | "year";
  onPeriodChange: (period: "day" | "week" | "month" | "year") => void;
  onExport: (type: "excel" | "pdf", reportType: "sale" | "product") => void;
}

const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  startDate,
  endDate,
  onDateChange,
  period,
  onPeriodChange,
  onExport,
}) => {
  return (
    <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
      {/* Dönem Seçimi - Yeni Tasarım */}
      <div className="flex flex-wrap gap-3">
        {[
          { value: 'day', label: 'Bugün' },
          { value: 'week', label: 'Bu Hafta' },
          { value: 'month', label: 'Bu Ay' },
          { value: 'year', label: 'Bu Yıl' },
        ].map((item) => (
          <button
            key={item.value}
            onClick={() => onPeriodChange(item.value as "day" | "week" | "month" | "year")}
            className={`
              px-4 py-2 rounded-lg font-medium transition-all duration-200
              ${period === item.value
                ? "bg-primary-100 text-primary-700 ring-2 ring-primary-500 ring-opacity-50"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }
            `}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Alt Bölüm - Tarih ve Export */}
      <div className="flex flex-wrap items-center justify-between gap-6 pt-4 border-t">
        {/* Tarih Seçici Grubu */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-lg">
              <Calendar size={18} className="text-gray-500" />
              <DatePicker
                selected={startDate}
                onChange={(date: Date | null) => date && onDateChange(date, endDate)}
                dateFormat="dd.MM.yyyy"
                className="bg-transparent w-28 focus:outline-none text-gray-700"
                placeholderText="Başlangıç"
              />
            </div>
            <span className="text-gray-400">-</span>
            <div className="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-lg">
              <Calendar size={18} className="text-gray-500" />
              <DatePicker
                selected={endDate}
                onChange={(date: Date | null) => date && onDateChange(startDate, date)}
                dateFormat="dd.MM.yyyy"
                className="bg-transparent w-28 focus:outline-none text-gray-700"
                placeholderText="Bitiş"
              />
            </div>
          </div>
        </div>

        {/* Export Butonları */}
        <div className="flex gap-3">
          {/* Excel Dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
              <FileText size={18} />
              <span className="font-medium">Excel</span>
              <ChevronDown size={16} className="ml-1 group-hover:rotate-180 transition-transform duration-200" />
            </button>
            <div className="absolute right-0 mt-2 w-44 bg-white border rounded-lg shadow-lg transform opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
              <button
                onClick={() => onExport("excel", "product")}
                className="flex items-center w-full px-4 py-2.5 text-left hover:bg-gray-50 text-gray-700 first:rounded-t-lg"
              >
                Ürün Raporu
              </button>
              <button
                onClick={() => onExport("excel", "sale")}
                className="flex items-center w-full px-4 py-2.5 text-left hover:bg-gray-50 text-gray-700 last:rounded-b-lg"
              >
                Satış Raporu
              </button>
            </div>
          </div>

          {/* PDF Dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors">
              <Download size={18} />
              <span className="font-medium">PDF</span>
              <ChevronDown size={16} className="ml-1 group-hover:rotate-180 transition-transform duration-200" />
            </button>
            <div className="absolute right-0 mt-2 w-44 bg-white border rounded-lg shadow-lg transform opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
              <button
                onClick={() => onExport("pdf", "product")}
                className="flex items-center w-full px-4 py-2.5 text-left hover:bg-gray-50 text-gray-700 first:rounded-t-lg"
              >
                Ürün Raporu
              </button>
              <button
                onClick={() => onExport("pdf", "sale")}
                className="flex items-center w-full px-4 py-2.5 text-left hover:bg-gray-50 text-gray-700 last:rounded-b-lg"
              >
                Satış Raporu
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardFilters;