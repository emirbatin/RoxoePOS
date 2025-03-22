import React from 'react';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

const Switch: React.FC<SwitchProps> = ({ 
  checked, 
  onCheckedChange,
  disabled = false 
}) => {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onCheckedChange(!checked)}
      disabled={disabled}
      className={`
        relative 
        inline-flex 
        h-5 
        w-9 
        shrink-0 
        cursor-pointer 
        items-center 
        rounded-full 
        border-2 
        border-transparent 
        transition-colors 
        focus:outline-none 
        focus:ring-2 
        focus:ring-indigo-500 
        focus:ring-offset-2 
        ${checked ? 'bg-indigo-600' : 'bg-gray-200'} 
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`
      }
    >
      <span
        className={`
          pointer-events-none 
          block 
          h-4 
          w-4 
          rounded-full 
          bg-white 
          shadow-lg 
          ring-0 
          transition-transform 
          ${checked ? 'translate-x-4' : 'translate-x-0'}
        `}
      />
    </button>
  );
};

export { Switch };