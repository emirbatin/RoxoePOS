import React, { useState, useEffect, useRef } from "react";
import {
  Calendar,
  ChevronDown,
  FileText,
  XCircle,
  Filter,
  RefreshCw,
  Search,
  CheckCircle,
  Tag,
  DollarSign,
  CreditCard,
  Percent,
  X,
  CalendarRange
} from "lucide-react";
import { SalesFilter } from "../types/sales";

// Dışa tıklama hook'u
const useClickOutside = (handler: () => void) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [handler]);

  return ref;
};

interface SalesFilterPanelProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  filter: SalesFilter;
  onFilterChange: (filter: SalesFilter) => void;
  onReset: () => void;
  isLoading?: boolean;
  onRefresh?: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}

const SalesFilterPanel: React.FC<SalesFilterPanelProps> = ({
  searchTerm,
  onSearchTermChange,
  filter,
  onFilterChange,
  onReset,
  isLoading = false,
  onRefresh,
  inputRef
}) => {
  // State
  const [showFilter, setShowFilter] = useState<boolean>(false);
  const [tempFilter, setTempFilter] = useState<SalesFilter>(filter);
  
  // Referans noktaları
  const filterRef = useClickOutside(() => setShowFilter(false));
  
  // Aktif filtreleme durumunu takip et
  const hasActiveFilters = 
    Object.keys(filter).length > 0 && 
    Object.values(filter).some(value => value !== undefined && value !== "");

  // Temp filter'ı güncel filtre ile senkronize et
  useEffect(() => {
    setTempFilter(filter);
  }, [filter]);

  // Tarih formatı
  const formatDateDisplay = (date: Date | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // ÖNEMLİ: Günün başlangıcı ve sonu için yardımcı fonksiyonlar
  const startOfDay = (date: Date): Date => {
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
  };

  const endOfDay = (date: Date): Date => {
    const newDate = new Date(date);
    newDate.setHours(23, 59, 59, 999);
    return newDate;
  };

  // Filtre değişikliklerini anında uygula
  const handleFilterChange = (key: string, value: any) => {
    // Yeni filtreyi oluştur
    const newFilter = {
      ...filter,
      [key]: value === "" ? undefined : value
    };
    
    // Anında değişikliği uygula
    onFilterChange(newFilter);
  };

  // Tarih değişimlerini anında uygula - DÜZELTME: Tam gün aralığı için
  const handleDateChange = (type: 'startDate' | 'endDate', date: Date | null) => {
    if (date) {
      let adjustedDate = date;
      
      // DÜZELTME: Başlangıç ve bitiş tarihlerini tam gün olarak ayarla
      if (type === 'startDate') {
        adjustedDate = startOfDay(date);
      } else if (type === 'endDate') {
        adjustedDate = endOfDay(date);
      }
      
      // Değişikliği anında uygula
      onFilterChange({
        ...filter,
        [type]: adjustedDate
      });
    } else {
      // Tarih silindiyse undefined olarak ayarla
      const newFilter = {...filter};
      delete newFilter[type];
      onFilterChange(newFilter);
    }
  };
  
  // Tarih aralığı seçimlerini hızlıca uygula - DÜZELTME: Tam gün aralığı için
  const applyDatePreset = (preset: 'today' | 'yesterday' | 'last7days' | 'last30days') => {
    const today = new Date();
    let startDate: Date, endDate: Date;
    
    switch (preset) {
      case 'today':
        // 10 Nisan için 10 Nisan 00:00:00 - 10 Nisan 23:59:59
        startDate = startOfDay(today);
        endDate = endOfDay(today);
        break;
      case 'yesterday':
        // Dün için dün 00:00:00 - dün 23:59:59
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = startOfDay(yesterday);
        endDate = endOfDay(yesterday);
        break;
      case 'last7days':
        // Son 7 gün (bugün dahil)
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        startDate = startOfDay(sevenDaysAgo);
        endDate = endOfDay(today);
        break;
      case 'last30days':
        // Son 30 gün (bugün dahil)
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
        startDate = startOfDay(thirtyDaysAgo);
        endDate = endOfDay(today);
        break;
    }
    
    // Konsola log ekleyerek kontrol edelim
    console.log(`${preset} seçildi:`, 
      `${startDate.toLocaleString()} - ${endDate.toLocaleString()}`);
    
    // Tarih aralığını doğrudan uygula
    onFilterChange({
      ...filter,
      startDate,
      endDate
    });
  };

  // Tarih aralığını gösterme
  const displayDateRange = () => {
    if (filter.startDate && filter.endDate) {
      const start = formatDateDisplay(filter.startDate);
      const end = formatDateDisplay(filter.endDate);
      
      // Aynı gün ise tek tarih göster
      if (start === end) {
        return start;
      }
      
      return `${start} - ${end}`;
    }
    
    return "Tarih";
  };

  // Aktif filtrelerin sayısı
  const getActiveFilterCount = () => {
    let count = 0;
    
    // Tarihleri tek filtre olarak say
    if (filter.startDate && filter.endDate) {
      count++;
    }
    
    // Diğer filtreleri say
    if (filter.status) count++;
    if (filter.paymentMethod) count++;
    if (filter.hasDiscount !== undefined) count++;
    if (filter.minAmount !== undefined || filter.maxAmount !== undefined) count++;
    
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className="mb-3 transition-all">
      {/* Arama ve Filtre Araç Çubuğu */}
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          {/* Sol: Arama */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Fiş numarası veya ID ara..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              ref={inputRef}
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-500"
            />
            {searchTerm && (
              <button
                onClick={() => onSearchTermChange("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          {/* Sağ: Butonlar */}
          <div className="flex space-x-3">
            {/* Filtre Butonu - Dropdown */}
            <div className="relative inline-block">
              <button
                onClick={() => setShowFilter(prev => !prev)}
                className={`flex items-center gap-2 py-2.5 px-4 rounded-lg border transition-all font-medium text-sm ${
                  showFilter || activeFilterCount > 0
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-gray-300 hover:border-indigo-300 text-gray-700"
                }`}
              >
                <Filter 
                  size={18} 
                  className={activeFilterCount > 0 ? "text-indigo-600" : "text-gray-500"} 
                />
                <span>
                  {activeFilterCount > 0 ? `Filtreler (${activeFilterCount})` : "Filtrele"}
                </span>
                <ChevronDown size={16} className={showFilter ? "rotate-180 transition-transform" : "transition-transform"} />
              </button>
              
              {/* Tek Filtre Popup'ı - Tarih ve diğer tüm seçenekler tek yerde */}
              {showFilter && (
                <div 
                  ref={filterRef}
                  className="absolute right-0 mt-2 bg-white rounded-xl shadow-xl z-20 border border-gray-100 w-80 p-4 animate-in fade-in slide-in-from-top-5 duration-200"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium text-gray-800">Filtreler</h3>
                    <button 
                      onClick={onReset}
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      Tümünü Temizle
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Tarih Aralığı */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tarih Aralığı
                      </label>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                          type="date"
                          value={filter.startDate ? new Date(filter.startDate).toISOString().split('T')[0] : ""}
                          onChange={(e) => handleDateChange('startDate', e.target.value ? new Date(e.target.value) : null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Başlangıç"
                        />
                        <input
                          type="date"
                          value={filter.endDate ? new Date(filter.endDate).toISOString().split('T')[0] : ""}
                          onChange={(e) => handleDateChange('endDate', e.target.value ? new Date(e.target.value) : null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Bitiş"
                        />
                      </div>
                      
                      {/* Hızlı tarih seçimleri */}
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <button 
                          onClick={() => applyDatePreset('today')}
                          className="px-2 py-1.5 text-xs bg-gray-50 rounded border border-gray-200 text-gray-700 hover:bg-gray-100"
                        >
                          Bugün
                        </button>
                        <button 
                          onClick={() => applyDatePreset('yesterday')}
                          className="px-2 py-1.5 text-xs bg-gray-50 rounded border border-gray-200 text-gray-700 hover:bg-gray-100"
                        >
                          Dün
                        </button>
                        <button 
                          onClick={() => applyDatePreset('last7days')}
                          className="px-2 py-1.5 text-xs bg-gray-50 rounded border border-gray-200 text-gray-700 hover:bg-gray-100"
                        >
                          Son 7 Gün
                        </button>
                        <button 
                          onClick={() => applyDatePreset('last30days')}
                          className="px-2 py-1.5 text-xs bg-gray-50 rounded border border-gray-200 text-gray-700 hover:bg-gray-100"
                        >
                          Son 30 Gün
                        </button>
                      </div>
                    </div>
                    
                    {/* Durum */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Durum
                      </label>
                      <select
                        value={filter.status || ""}
                        onChange={(e) => handleFilterChange("status", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">Tümü</option>
                        <option value="completed">Tamamlandı</option>
                        <option value="cancelled">İptal Edildi</option>
                        <option value="refunded">İade Edildi</option>
                      </select>
                    </div>
                    
                    {/* Ödeme Yöntemi */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ödeme Yöntemi
                      </label>
                      <select
                        value={filter.paymentMethod || ""}
                        onChange={(e) => handleFilterChange("paymentMethod", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">Tümü</option>
                        <option value="nakit">Nakit</option>
                        <option value="kart">Kredi Kartı</option>
                        <option value="veresiye">Veresiye</option>
                        <option value="nakitpos">POS (Nakit)</option>
                        <option value="mixed">Karışık (Split)</option>
                      </select>
                    </div>
                    
                    {/* Min/Max Tutar - Tek satırda */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Min. Tutar
                        </label>
                        <div className="relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">₺</span>
                          </div>
                          <input
                            type="number"
                            value={filter.minAmount || ""}
                            onChange={(e) => handleFilterChange("minAmount", e.target.value ? parseFloat(e.target.value) : "")}
                            placeholder="0.00"
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            onWheel={(e) => e.currentTarget.blur()}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Max. Tutar
                        </label>
                        <div className="relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">₺</span>
                          </div>
                          <input
                            type="number"
                            value={filter.maxAmount || ""}
                            onChange={(e) => handleFilterChange("maxAmount", e.target.value ? parseFloat(e.target.value) : "")}
                            placeholder="0.00"
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            onWheel={(e) => e.currentTarget.blur()}
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* İndirim Durumu */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        İndirim Durumu
                      </label>
                      <select
                        value={filter.hasDiscount === undefined ? "" : filter.hasDiscount ? "true" : "false"}
                        onChange={(e) => {
                          const value = e.target.value;
                          handleFilterChange("hasDiscount", value === "" ? undefined : value === "true");
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">Tümü</option>
                        <option value="true">İndirimli Satışlar</option>
                        <option value="false">İndirimsiz Satışlar</option>
                      </select>
                    </div>
                    
                    {/* Popup'ı kapatma butonu */}
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => setShowFilter(false)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-1.5"
                      >
                        <CheckCircle size={16} />
                        Kapat
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Yenile Butonu */}
            {onRefresh && (
              <button
                onClick={onRefresh}
                className={`flex items-center gap-2 py-2.5 px-4 rounded-lg border border-gray-300 hover:border-indigo-300 text-gray-700 transition-all font-medium text-sm ${
                  isLoading ? "cursor-not-allowed opacity-75" : ""
                }`}
                disabled={isLoading}
              >
                <RefreshCw
                  size={18}
                  className={`text-gray-500 ${isLoading ? "animate-spin" : ""}`}
                />
                <span>{isLoading ? "Yükleniyor" : "Yenile"}</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Aktif Filtreler */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mt-4">
            {filter.startDate && filter.endDate && (
              <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                <CalendarRange size={14} />
                {displayDateRange()}
                <button 
                  onClick={() => onFilterChange({...filter, startDate: undefined, endDate: undefined})}
                  className="text-indigo-400 hover:text-indigo-600 ml-1"
                >
                  <XCircle size={14} />
                </button>
              </span>
            )}
            
            {filter.status && (
              <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                <Tag size={14} />
                {filter.status === "completed" ? "Tamamlandı" : 
                 filter.status === "cancelled" ? "İptal Edildi" : 
                 filter.status === "refunded" ? "İade Edildi" : filter.status}
                <button 
                  onClick={() => handleFilterChange("status", "")}
                  className="text-blue-400 hover:text-blue-600 ml-1"
                >
                  <XCircle size={14} />
                </button>
              </span>
            )}
            
            {(filter.minAmount !== undefined || filter.maxAmount !== undefined) && (
              <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                <DollarSign size={14} />
                {filter.minAmount !== undefined && filter.maxAmount !== undefined
                  ? `₺${filter.minAmount} - ₺${filter.maxAmount}`
                  : filter.minAmount !== undefined
                  ? `≥ ₺${filter.minAmount}`
                  : `≤ ₺${filter.maxAmount}`}
                <button 
                  onClick={() => onFilterChange({...filter, minAmount: undefined, maxAmount: undefined})}
                  className="text-emerald-400 hover:text-emerald-600 ml-1"
                >
                  <XCircle size={14} />
                </button>
              </span>
            )}
            
            {filter.paymentMethod && (
              <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
                <CreditCard size={14} />
                {filter.paymentMethod === "nakit" ? "Nakit" :
                 filter.paymentMethod === "kart" ? "Kredi Kartı" :
                 filter.paymentMethod === "veresiye" ? "Veresiye" :
                 filter.paymentMethod === "nakitpos" ? "POS (Nakit)" :
                 filter.paymentMethod === "mixed" ? "Karışık (Split)" : filter.paymentMethod}
                <button 
                  onClick={() => handleFilterChange("paymentMethod", "")}
                  className="text-orange-400 hover:text-orange-600 ml-1"
                >
                  <XCircle size={14} />
                </button>
              </span>
            )}
            
            {filter.hasDiscount !== undefined && (
              <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                <Percent size={14} />
                {filter.hasDiscount ? "İndirimli Satışlar" : "İndirimsiz Satışlar"}
                <button 
                  onClick={() => handleFilterChange("hasDiscount", undefined)}
                  className="text-purple-400 hover:text-purple-600 ml-1"
                >
                  <XCircle size={14} />
                </button>
              </span>
            )}
            
            {hasActiveFilters && (
              <button 
                onClick={onReset}
                className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
              >
                <XCircle size={14} />
                Tüm Filtreleri Temizle
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesFilterPanel;