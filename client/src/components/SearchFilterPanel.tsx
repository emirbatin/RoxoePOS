// components/SearchFilterPanel.tsx
import React from "react";
import { Search, Filter, RefreshCw } from "lucide-react";

interface SearchFilterPanelProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onReset: () => void;
  showFilter: boolean;
  toggleFilter: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}

const SearchFilterPanel: React.FC<SearchFilterPanelProps> = ({
  searchTerm,
  onSearchTermChange,
  onReset,
  showFilter,
  toggleFilter,
  inputRef,
}) => {
  return (
    <div className="flex gap-2 mb-4">
      <div className="flex-1 relative">
        <input
          ref={inputRef} // inputRef'i input'a bağladık
          type="text"
          placeholder="Ara..."
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
      </div>
      <button
        onClick={toggleFilter}
        className={`p-2 border rounded-lg hover:bg-gray-50 ${
          showFilter ? "bg-primary-50 border-primary-500" : ""
        }`}
        title="Filtreleri Göster/Gizle"
      >
        <Filter size={20} className="text-gray-600" />
      </button>
      <button
        onClick={onReset}
        className="p-2 border rounded-lg hover:bg-gray-50"
        title="Filtreleri Sıfırla"
      >
        <RefreshCw size={20} className="text-gray-600" />
      </button>
    </div>
  );
};

export default SearchFilterPanel;