// components/ui/select.tsx

import React, { useState, useRef, useEffect } from "react";

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({ value, onValueChange, children }) => {
  return (
    <div className="relative inline-block w-full">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, { value, onValueChange });
        }
        return child;
      })}
    </div>
  );
};

interface SelectTriggerProps {
  children: React.ReactNode;
  className?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export const SelectTrigger: React.FC<SelectTriggerProps> = ({ children, className = "" }) => {
  return (
    <button
      type="button"
      className={`flex items-center justify-between w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
    >
      {children}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 ml-2"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );
};

export const SelectValue: React.FC<{ placeholder: string }> = ({ placeholder }) => {
  return <span className="text-sm">{placeholder}</span>;
};

interface SelectContentProps {
  children: React.ReactNode;
}

export const SelectContent: React.FC<SelectContentProps> = ({ children }) => {
  return (
    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
      <div className="py-1">{children}</div>
    </div>
  );
};

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  onValueChange?: (value: string) => void;
}

export const SelectItem: React.FC<SelectItemProps> = ({ value, children, onValueChange }) => {
  const handleClick = () => {
    if (onValueChange) {
      onValueChange(value);
    }
  };

  return (
    <div
      className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer"
      onClick={handleClick}
    >
      {children}
    </div>
  );
};