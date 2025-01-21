import React from "react";
import { Calendar, Download } from "lucide-react";

interface DashboardFiltersProps {
  startDate: Date;
  endDate: Date;
  onDateChange: (start: Date, end: Date) => void;
  onExport: (type: 'excel' | 'pdf') => void;  // csv yerine excel
  period: "day" | "week" | "month" | "year";
  onPeriodChange: (period: "day" | "week" | "month" | "year") => void;
}

const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  startDate,
  endDate,
  onDateChange,
  onExport,
  period,
  onPeriodChange,
}) => {
  // Tarih formatı
  const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  // Hızlı tarih seçimleri
  const quickDates = [
    { label: "Bugün", value: "day" },
    { label: "Bu Hafta", value: "week" },
    { label: "Bu Ay", value: "month" },
    { label: "Bu Yıl", value: "year" },
  ];

  return (
    <div className="bg-white p-4 rounded-lg border mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Sol taraf - Tarih Filtreleri */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-gray-500" />
            <input
              type="date"
              value={formatDate(startDate)}
              onChange={(e) => onDateChange(new Date(e.target.value), endDate)}
              className="border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <span className="text-gray-500">-</span>
            <input
              type="date"
              value={formatDate(endDate)}
              onChange={(e) =>
                onDateChange(startDate, new Date(e.target.value))
              }
              className="border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {quickDates.map((option) => (
              <button
                key={option.value}
                onClick={() => onPeriodChange(option.value as any)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  period === option.value
                    ? "bg-primary-100 text-primary-700 font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sağ taraf - Export Butonları */}
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => onExport("excel")}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
            title="Excel İndir"
          >
            <Download size={20} />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button
            onClick={() => onExport("pdf")}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
            title="PDF İndir"
          >
            <Download size={20} />
            <span className="hidden sm:inline">PDF</span>
          </button>
          
        </div>
      </div>

      {/* Mobil görünüm için responsive tasarım */}
      <style>{`
  @media (max-width: 640px) {
    .flex-wrap {
      justify-content: center;
    }
    .ml-auto {
      margin-left: 0;
      margin-top: 1rem;
    }
  }
`}</style>
    </div>
  );
};

export default DashboardFilters;
