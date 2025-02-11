import React from "react";
import clsx from "clsx";
import { AlertTriangle, Tag } from "lucide-react";

export type CardVariant = "default" | "stat" | "shadow" | "bordered" | "product";

export interface CardProps {
  variant?: CardVariant;
  title?: string;
  value?: string | number;
  description?: string;
  trend?: number;
  trendLabel?: string;
  icon?: React.ReactNode;
  color?: "primary" | "red" | "green" | "blue" | "orange";
  imageUrl?: string;
  category?: string;
  price?: string;
  vatRate?: string;
  stock?: number;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

const Card: React.FC<CardProps> = ({
  variant = "default",
  title,
  value,
  description,
  trend,
  trendLabel,
  icon,
  color = "primary",
  imageUrl,
  category,
  price,
  vatRate,
  stock,
  onClick,
  disabled,
  className,
}) => {
  if (variant === "product") {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={clsx(
          "p-4 border rounded-lg hover:shadow-md transition-shadow text-left relative",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        {/* Ürün Görseli */}
        {imageUrl && (
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-32 object-cover rounded mb-2"
          />
        )}

        {/* Ürün Bilgileri */}
        <div className="font-medium text-gray-900 truncate">{title}</div>

        {category && (
          <div className="text-sm text-gray-500 flex items-center gap-1">
            <Tag size={14} />
            {category}
          </div>
        )}

        {/* Fiyat ve KDV */}
        <div className="mt-2">
          {price && <div className="font-semibold text-primary-600">{price}</div>}
          {vatRate && (
            <div className="text-xs text-gray-500">+{vatRate} KDV</div>
          )}
        </div>

        {/* Stok Durumu */}
        {stock !== undefined && (
          <div
            className={clsx(
              "text-sm mt-1",
              stock < 5 ? "text-red-500" : "text-gray-500"
            )}
          >
            Stok: {stock}
            {stock < 5 && <AlertTriangle size={14} className="inline ml-1" />}
          </div>
        )}
      </button>
    );
  }

  // Diğer varyantlar için temel stil
  const baseStyle = clsx(
    "bg-white rounded-lg p-4 transition-all duration-200",
    {
      "shadow-lg hover:shadow-xl": variant === "shadow",
      "border border-gray-200": variant === "bordered",
      "shadow-sm": variant === "default",
    },
    className
  );

  return (
    <div className={baseStyle}>
      {title && (
        <div className="mb-4 flex items-center gap-2">
          {icon && <div>{icon}</div>}
          <h3 className="text-xl font-semibold">{title}</h3>
        </div>
      )}
      {description && <div className="mb-4 text-gray-800">{description}</div>}
      {value && <div className="text-lg font-bold">{value}</div>}
    </div>
  );
};

export default Card;