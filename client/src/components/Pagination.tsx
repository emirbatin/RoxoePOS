import React from "react";

// components/Pagination/index.tsx
interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
  }
  
  export const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    className = ''
  }) => {
    return (
      <div className={`flex items-center justify-between ${className}`}>
        <div className="text-sm text-gray-500">
          Sayfa {currentPage} / {totalPages}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`px-3 py-1 rounded-lg text-sm ${
              currentPage === 1
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Önceki
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(
              (num) =>
                num === 1 ||
                num === totalPages ||
                (num >= currentPage - 1 && num <= currentPage + 1)
            )
            .map((number) => (
              <React.Fragment key={number}>
                {number !== 1 &&
                  number !== currentPage - 1 &&
                  number > 2 &&
                  "..."}
                <button
                  onClick={() => onPageChange(number)}
                  className={`px-3 py-1 rounded-lg text-sm ${
                    currentPage === number
                      ? "bg-primary-100 text-primary-600 font-medium"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {number}
                </button>
              </React.Fragment>
            ))}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`px-3 py-1 rounded-lg text-sm ${
              currentPage === totalPages
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Sonraki
          </button>
        </div>
      </div>
    );
  };