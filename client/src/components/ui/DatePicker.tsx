// components/ui/date-picker.tsx

import React, { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = "Tarih seçin",
  className = "",
  disabled = false,
  error
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [month, setMonth] = useState(value.getMonth());
  const [year, setYear] = useState(value.getFullYear());
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Tarih formatını yapılandır
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Dışarı tıklama olayını yönet
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Ay ve yıl değiştiğinde calendar'ı güncelle
  useEffect(() => {
    setMonth(value.getMonth());
    setYear(value.getFullYear());
  }, [value]);

  // Ay ve yıl navigasyon fonksiyonları
  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  // Ay isimlerini al
  const monthNames = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  // Günlerin adları
  const dayNames = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

  // Calendar oluşturma
  const generateCalendar = () => {
    const days = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Ayın ilk gününün hangi gün olduğunu bul (0=Pazar, 1=Pazartesi, ...)
    let firstDayOfWeek = firstDay.getDay();
    // Pazartesi'yi 0 olarak almak için düzenleme
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    // Önceki ayın son günlerini hesapla
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayValue = prevMonthLastDay - i;
      const tempDate = new Date(year, month - 1, dayValue);
      days.push({
        date: tempDate,
        day: dayValue,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false
      });
    }
    
    // Geçerli ayın günlerini hesapla
    const today = new Date();
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const tempDate = new Date(year, month, i);
      days.push({
        date: tempDate,
        day: i,
        isCurrentMonth: true,
        isToday: 
          today.getDate() === i && 
          today.getMonth() === month && 
          today.getFullYear() === year,
        isSelected: 
          value.getDate() === i && 
          value.getMonth() === month && 
          value.getFullYear() === year
      });
    }
    
    // Sonraki ayın ilk günlerini hesapla
    const daysNeeded = 42 - days.length; // 6x7 grid için
    for (let i = 1; i <= daysNeeded; i++) {
      const tempDate = new Date(year, month + 1, i);
      days.push({
        date: tempDate,
        day: i,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false
      });
    }
    
    return days;
  };

  // Tarih seçildiğinde
  const handleSelectDate = (date: Date) => {
    onChange(date);
    setIsOpen(false);
  };

  // Tarih girdisini temizle
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    onChange(today);
  };

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      <div 
        className={`
          relative flex items-center cursor-pointer
          ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
        `}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className={`
          group w-full px-3 py-2 border rounded-lg transition-all
          ${error ? 'border-red-500' : 'border-gray-300'} 
          ${isOpen ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}
          ${disabled ? 'bg-gray-100' : 'bg-white hover:border-indigo-300'}
        `}>
          <div className="flex items-center">
            <Calendar className="h-4 w-4 text-gray-400 group-hover:text-indigo-500 mr-2" />
            <span className={`flex-grow ${value ? 'text-gray-900' : 'text-gray-500'}`}>
              {value ? formatDate(value) : placeholder}
            </span>
            {value && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        
        {error && (
          <div className="absolute mt-1 text-xs text-red-500">{error}</div>
        )}
      </div>
      
      {isOpen && !disabled && (
        <div className="absolute z-10 mt-1 w-72 bg-white rounded-lg shadow-lg p-3 border border-gray-200 animate-fadeIn">
          {/* Ay/Yıl Navigasyonu */}
          <div className="flex justify-between items-center mb-3">
            <button 
              onClick={prevMonth}
              className="p-1 rounded-full hover:bg-gray-100 text-gray-600"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            
            <div className="text-sm font-medium">
              {monthNames[month]} {year}
            </div>
            
            <button 
              onClick={nextMonth}
              className="p-1 rounded-full hover:bg-gray-100 text-gray-600"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          
          {/* Gün Başlıkları */}
          <div className="grid grid-cols-7 mb-1">
            {dayNames.map((day) => (
              <div key={day} className="text-xs text-gray-500 font-medium text-center py-1">
                {day}
              </div>
            ))}
          </div>
          
          {/* Günler */}
          <div className="grid grid-cols-7 gap-1">
            {generateCalendar().map((day, index) => (
              <button
                key={index}
                onClick={() => handleSelectDate(day.date)}
                disabled={!day.isCurrentMonth}
                className={`
                  text-center py-1 text-sm rounded-full
                  ${day.isCurrentMonth ? 'hover:bg-indigo-50' : 'text-gray-400'} 
                  ${day.isSelected && day.isCurrentMonth ? 'bg-indigo-500 text-white hover:bg-indigo-600' : ''}
                  ${day.isToday && !day.isSelected ? 'border border-indigo-500 text-indigo-700' : ''}
                  ${!day.isCurrentMonth ? 'opacity-40' : ''}
                `}
              >
                {day.day}
              </button>
            ))}
          </div>
          
          {/* Hızlı Seçimler */}
          <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-xs">
            <button 
              onClick={() => handleSelectDate(new Date())}
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Bugün
            </button>
            <button
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + 7);
                handleSelectDate(d);
              }}
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              1 Hafta Sonra
            </button>
            <button
              onClick={() => {
                const d = new Date();
                d.setMonth(d.getMonth() + 1);
                handleSelectDate(d);
              }}
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              1 Ay Sonra
            </button>
          </div>
        </div>
      )}
    </div>
  );
};