// components/ui/date-picker.tsx

import React, { useState } from "react";
import { Calendar } from "lucide-react";

interface DatePickerProps {
  date: Date;
  setDate: (date: Date) => void;
  placeholder?: string;
  className?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  date,
  setDate,
  placeholder = "Tarih seçin",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const newDate = new Date(value);
    if (!isNaN(newDate.getTime())) {
      setDate(newDate);
    }
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0]; // YYYY-MM-DD formatı
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          type="date"
          value={formatDate(date)}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <Calendar className="h-4 w-4 text-gray-500" />
        </div>
      </div>
    </div>
  );
};