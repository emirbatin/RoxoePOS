import React, { useState, useEffect, useRef } from "react";
import { Calendar, ChevronDown, RefreshCw, ArrowLeft, ArrowRight, CheckCircle, Calendar as CalendarIcon } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isValid, isBefore } from 'date-fns';
import { tr } from 'date-fns/locale';

// Düzeltilmiş Popover bileşeni için hook (toggle butonunu dikkate alır)
const useClickOutside = (handler: () => void, excludeRef?: React.RefObject<HTMLElement>) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Eğer tıklama popup dışında VE hariç tutulan buton dışında ise kapat
      const clickedOnExcludedElement = excludeRef?.current?.contains(event.target as Node);
      
      if (ref.current && 
          !ref.current.contains(event.target as Node) && 
          !clickedOnExcludedElement) {
        handler();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [handler, excludeRef]);

  return ref;
};

// DateFilter bileşeni
type DateFilterProps = {
  startDate: Date;
  endDate: Date;
  period: "day" | "week" | "month" | "year" | "custom";
  onPeriodChange: (period: "day" | "week" | "month" | "year" | "custom") => void;
  onDateChange: (startDate: Date, endDate: Date) => void;
  isLoading: boolean;
  onRefresh: () => void;
  exportButton?: React.ReactNode; // Dışa aktarma butonu için slot
};

const DateFilter: React.FC<DateFilterProps> = ({
  startDate,
  endDate,
  period,
  onPeriodChange,
  onDateChange,
  isLoading,
  onRefresh,
  exportButton
}) => {
  // State
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [tempStartDate, setTempStartDate] = useState<Date>(startDate);
  const [tempEndDate, setTempEndDate] = useState<Date>(endDate);
  const [dateError, setDateError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<string>(period);
  
  // Takvim toggle butonu için ref
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  
  // Ref for click outside detection (now excluding toggle button)
  const datePickerRef = useClickOutside(() => setShowDatePicker(false), toggleButtonRef);

  // Reset temp dates when real dates change
  useEffect(() => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
  }, [startDate, endDate]);

  // Tarih format yardımcıları
  const formatDateDisplay = (date: Date) => {
    if (!isValid(date)) return "-";
    return format(date, 'd MMM yyyy', { locale: tr });
  };
  
  const formatDateInput = (date: Date) => {
    if (!isValid(date)) return "";
    return format(date, 'yyyy-MM-dd');
  };

  // Tarih aralığı değişince loading state'ini göster
  useEffect(() => {
    if (localLoading) {
      const timer = setTimeout(() => {
        setLocalLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [localLoading]);

  // Tarih değiştirme işlemleri
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    if (isValid(newDate)) {
      setTempStartDate(newDate);
      setDateError(null);
      
      // End date is before start date, update end date
      if (isBefore(tempEndDate, newDate)) {
        setTempEndDate(newDate);
      }
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    if (isValid(newDate)) {
      // Validate that end date is not before start date
      if (isBefore(newDate, tempStartDate)) {
        setDateError("Bitiş tarihi, başlangıç tarihinden önce olamaz");
      } else {
        setTempEndDate(newDate);
        setDateError(null);
      }
    }
  };

  const applyCustomDates = () => {
    if (!isValid(tempStartDate) || !isValid(tempEndDate)) {
      setDateError("Lütfen geçerli tarihler girin");
      return;
    }
    
    if (isBefore(tempEndDate, tempStartDate)) {
      setDateError("Bitiş tarihi, başlangıç tarihinden önce olamaz");
      return;
    }
    
    // Apply dates and close picker
    setLocalLoading(true);
    onDateChange(tempStartDate, tempEndDate);
    onPeriodChange("custom");
    setActivePreset("custom");
    setShowDatePicker(false);
    setDateError(null);
  };

  // Tarih presetlerini uygulama
  const applyPreset = (preset: "day" | "week" | "month" | "year") => {
    setLocalLoading(true);
    setActivePreset(preset);
    
    let newStartDate: Date;
    let newEndDate: Date;
    
    const today = new Date();
    
    switch (preset) {
      case "day":
        // Bugün
        newStartDate = today;
        newEndDate = today;
        break;
      case "week":
        // Bu hafta (Pazartesi-Pazar)
        newStartDate = startOfWeek(today, { weekStartsOn: 1 });
        newEndDate = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case "month":
        // Bu ay
        newStartDate = startOfMonth(today);
        newEndDate = endOfMonth(today);
        break;
      case "year":
        // Bu yıl
        newStartDate = startOfYear(today);
        newEndDate = endOfYear(today);
        break;
      default:
        return;
    }
    
    onDateChange(newStartDate, newEndDate);
    onPeriodChange(preset);
    setShowDatePicker(false);
  };
  
  // Hızlı tarih navigasyonu
  const moveDateRange = (direction: 'prev' | 'next') => {
    setLocalLoading(true);
    
    let newStartDate: Date;
    let newEndDate: Date;
    
    // Mevcut tarih aralığının uzunluğunu hesapla
    const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    if (direction === 'prev') {
      // Önceki aralık
      newEndDate = new Date(startDate);
      newEndDate.setDate(newEndDate.getDate() - 1);
      newStartDate = new Date(newEndDate);
      newStartDate.setDate(newStartDate.getDate() - (daysDiff - 1));
    } else {
      // Sonraki aralık
      newStartDate = new Date(endDate);
      newStartDate.setDate(newStartDate.getDate() + 1);
      newEndDate = new Date(newStartDate);
      newEndDate.setDate(newEndDate.getDate() + (daysDiff - 1));
    }
    
    onDateChange(newStartDate, newEndDate);
    // Custom moduna geç, çünkü preset dışına çıkıyoruz
    if (activePreset !== 'custom') {
      onPeriodChange('custom');
      setActivePreset('custom');
    }
  };

  // Tarih presetlerini render et
  const renderPresetButtons = () => (
    <div className="flex bg-gray-50 rounded-lg p-1 shadow-sm">
      <button
        onClick={() => applyPreset("day")}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
          activePreset === "day"
            ? "bg-white text-indigo-600 shadow-sm"
            : "text-gray-600 hover:text-indigo-600 hover:bg-gray-100"
        }`}
      >
        Bugün
      </button>
      <button
        onClick={() => applyPreset("week")}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
          activePreset === "week"
            ? "bg-white text-indigo-600 shadow-sm"
            : "text-gray-600 hover:text-indigo-600 hover:bg-gray-100"
        }`}
      >
        Bu Hafta
      </button>
      <button
        onClick={() => applyPreset("month")}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
          activePreset === "month"
            ? "bg-white text-indigo-600 shadow-sm"
            : "text-gray-600 hover:text-indigo-600 hover:bg-gray-100"
        }`}
      >
        Bu Ay
      </button>
      <button
        onClick={() => applyPreset("year")}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
          activePreset === "year"
            ? "bg-white text-indigo-600 shadow-sm"
            : "text-gray-600 hover:text-indigo-600 hover:bg-gray-100"
        }`}
      >
        Bu Yıl
      </button>
    </div>
  );

  // Tarih aralığı navigasyon butonları
  const renderDateNavigation = () => (
    <div className="flex items-center space-x-2">
      <button 
        onClick={() => moveDateRange('prev')}
        className="flex items-center justify-center w-8 h-8 text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        aria-label="Önceki dönem"
      >
        <ArrowLeft size={16} />
      </button>
      
      <button 
        onClick={() => moveDateRange('next')}
        className="flex items-center justify-center w-8 h-8 text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        aria-label="Sonraki dönem"
      >
        <ArrowRight size={16} />
      </button>
    </div>
  );

  // Tarih seçici popup
  const renderDatePickerPopup = () => (
    <div 
      ref={datePickerRef}
      className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl z-20 border border-gray-100 animate-in fade-in slide-in-from-top-5 duration-200"
    >
      <div className="p-4 w-80">
        <div className="text-sm font-semibold text-gray-800 mb-3 flex justify-between items-center">
          <span>Özel Tarih Aralığı</span>
          {dateError && (
            <span className="text-xs text-red-500 font-normal">{dateError}</span>
          )}
        </div>

        {/* Başlangıç Tarihi */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Başlangıç Tarihi
          </label>
          <div className="relative">
            <input
              type="date"
              value={formatDateInput(tempStartDate)}
              onChange={handleStartDateChange}
              className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            <CalendarIcon size={16} className="absolute left-3 top-2.5 text-gray-400" />
          </div>
        </div>

        {/* Bitiş Tarihi */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bitiş Tarihi
          </label>
          <div className="relative">
            <input
              type="date"
              value={formatDateInput(tempEndDate)}
              onChange={handleEndDateChange}
              className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              min={formatDateInput(tempStartDate)}
            />
            <CalendarIcon size={16} className="absolute left-3 top-2.5 text-gray-400" />
          </div>
        </div>

        {/* Hızlı tarih seçimleri */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button 
            onClick={() => {
              const today = new Date();
              setTempStartDate(today);
              setTempEndDate(today);
              setDateError(null);
            }}
            className="px-2 py-1.5 text-xs bg-gray-50 rounded border border-gray-200 text-gray-700 hover:bg-gray-100"
          >
            Bugün
          </button>
          <button 
            onClick={() => {
              const today = new Date();
              const yesterday = addDays(today, -1);
              setTempStartDate(yesterday);
              setTempEndDate(yesterday);
              setDateError(null);
            }}
            className="px-2 py-1.5 text-xs bg-gray-50 rounded border border-gray-200 text-gray-700 hover:bg-gray-100"
          >
            Dün
          </button>
          <button 
            onClick={() => {
              const today = new Date();
              setTempStartDate(addDays(today, -7));
              setTempEndDate(today);
              setDateError(null);
            }}
            className="px-2 py-1.5 text-xs bg-gray-50 rounded border border-gray-200 text-gray-700 hover:bg-gray-100"
          >
            Son 7 Gün
          </button>
          <button 
            onClick={() => {
              const today = new Date();
              setTempStartDate(addDays(today, -30));
              setTempEndDate(today);
              setDateError(null);
            }}
            className="px-2 py-1.5 text-xs bg-gray-50 rounded border border-gray-200 text-gray-700 hover:bg-gray-100"
          >
            Son 30 Gün
          </button>
        </div>

        <button
          onClick={applyCustomDates}
          className="w-full py-2 mt-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all flex justify-center items-center gap-2"
        >
          <CheckCircle size={16} />
          <span>Tarihleri Uygula</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="mb-3 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-3 space-y-4">
        {/* Tarih Filtreleme Özeti - Her zaman görünür */}
        <div className="flex items-center justify-between bg-indigo-50 p-2 px-4 rounded-lg">
          <div className="flex items-center gap-2">
            <Calendar className="text-indigo-600" size={20} />
            <div>
              <h3 className="text-sm font-medium text-indigo-900">
                {activePreset === "day" 
                  ? "Bugün" 
                  : activePreset === "week" 
                  ? "Bu Hafta" 
                  : activePreset === "month" 
                  ? "Bu Ay" 
                  : activePreset === "year" 
                  ? "Bu Yıl" 
                  : "Özel Tarih Aralığı"}
              </h3>
              <p className="text-xs text-indigo-800">
                {formatDateDisplay(startDate)} - {formatDateDisplay(endDate)}
              </p>
            </div>
          </div>
          {renderDateNavigation()}
        </div>
        
        {/* Filtreler */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          {/* Sol Taraf - Hızlı Filtreler */}
          <div className="flex items-center">
            {renderPresetButtons()}
          </div>

          {/* Sağ Taraf - Butonlar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Özel Tarih Seçici */}
            <div className="relative">
              <button
                ref={toggleButtonRef} // Toggle butonu referansını ekledik
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={`flex items-center gap-2 py-2 px-3 rounded-md border transition-all ${
                  showDatePicker || activePreset === "custom"
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 bg-white text-gray-700 hover:border-indigo-200 hover:bg-indigo-50/50"
                }`}
              >
                <Calendar
                  size={16}
                  className={
                    activePreset === "custom" ? "text-indigo-600" : "text-gray-500"
                  }
                />
                <span className="font-medium text-sm">
                  {formatDateDisplay(startDate)} - {formatDateDisplay(endDate)}
                </span>
                <ChevronDown
                  size={14}
                  className={
                    activePreset === "custom" ? "text-indigo-600" : "text-gray-400"
                  }
                />
              </button>

              {/* Tarih Seçici Popup */}
              {showDatePicker && renderDatePickerPopup()}
            </div>

            {/* Dışa Aktarma Butonu (prop olarak geçilirse) */}
            {exportButton}

            {/* Yenileme Butonu */}
            <button
              onClick={onRefresh}
              className={`flex items-center gap-2 py-2 px-3 rounded-md border border-gray-200 bg-white hover:border-indigo-300 transition-all ${
                isLoading || localLoading ? "cursor-not-allowed opacity-75" : ""
              }`}
              disabled={isLoading || localLoading}
            >
              <RefreshCw
                size={16}
                className={`text-gray-500 ${isLoading || localLoading ? "animate-spin" : ""}`}
              />
              <span className="text-gray-700 font-medium text-sm">
                {isLoading || localLoading ? "Yükleniyor" : "Yenile"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateFilter;