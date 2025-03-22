import React from "react";
import clsx from "clsx";
import {
  AlertTriangle,
  Tag,
  Plus,
  Minus,
  Image,
  ShoppingCart,
  Percent,
} from "lucide-react";

export type CardVariant =
  | "default"
  | "stat"
  | "shadow"
  | "bordered"
  | "product"
  | "addProduct"
  | "summary"; // Yeni varyant

export interface CardProps {
  variant?: CardVariant;
  title?: string;
  value?: string | number;
  description?: string;
  trend?: number;
  trendLabel?: string;
  icon?: React.ReactNode;
  color?:
    | "primary"
    | "red"
    | "green"
    | "blue"
    | "orange"
    | "gray"
    | "indigo"
    | "purple";
  imageUrl?: string;
  category?: string;
  price?: string;
  vatRate?: string;
  stock?: number;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  onAddToGroup?: () => void;
  onRemoveFromGroup?: () => void;
  size?: "normal" | "small";
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
  onAddToGroup,
  onRemoveFromGroup,
  size = "normal",
}) => {
  // === SUMMARY VARYANTI ===
  if (variant === "summary") {
    const themeClass = {
      indigo: {
        bg: "bg-indigo-50",
        text: "text-indigo-700",
      },
      blue: {
        bg: "bg-blue-50",
        text: "text-blue-700",
      },
      green: {
        bg: "bg-green-50",
        text: "text-green-700",
      },
      purple: {
        bg: "bg-purple-50",
        text: "text-purple-700",
      },
      red: {
        bg: "bg-red-50",
        text: "text-red-700",
      },
      orange: {
        bg: "bg-orange-50",
        text: "text-orange-700",
      },
      gray: {
        bg: "bg-gray-100",
        text: "text-gray-700",
      },
      primary: {
        bg: "bg-primary-50",
        text: "text-primary-700",
      },
    }[color || "indigo"];

    return (
      <div
        className={clsx(
          "bg-white rounded-lg shadow-sm overflow-hidden",
          className
        )}
      >
        <div className={`px-5 py-3 ${themeClass.bg}`}>
          <h3 className={`text-sm font-medium ${themeClass.text}`}>{title}</h3>
        </div>
        <div className="px-5 py-4">
          <div
            className="text-xl font-semibold text-gray-800 truncate"
            title={String(value)}
          >
            {value}
          </div>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>
      </div>
    );
  }

  // === ADD PRODUCT ===
  if (variant === "addProduct") {
    return (
      <button
        onClick={onClick}
        className={clsx(
          "flex flex-col items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 hover:border-indigo-500 hover:bg-indigo-50 transition-colors group h-full",
          className
        )}
      >
        {icon || (
          <Plus
            size={size === "small" ? 24 : 28}
            className="text-gray-400 group-hover:text-indigo-500 mb-2"
          />
        )}
        <span
          className={clsx(
            "font-medium text-gray-600 group-hover:text-indigo-600",
            size === "small" ? "text-sm" : "text-sm"
          )}
        >
          {title || "Ürün Ekle"}
        </span>
      </button>
    );
  }

  // === PRODUCT ===
  if (variant === "product") {
    const stockStatusColor =
      stock === undefined
        ? "bg-gray-400"
        : stock === 0
        ? "bg-red-500"
        : stock < 5
        ? "bg-orange-500"
        : "bg-green-500";

    return (
      <div
        className={clsx(
          "relative group overflow-hidden rounded-xl transition-all duration-300 h-full flex flex-col",
          "border border-gray-100 hover:border-indigo-200 bg-white hover:shadow-md",
          disabled && "opacity-50 cursor-not-allowed grayscale",
          className
        )}
      >
        {(onAddToGroup || onRemoveFromGroup) && (
          <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            {onAddToGroup && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToGroup();
                }}
                className="bg-indigo-500 text-white rounded-full hover:bg-indigo-600 shadow-sm p-1.5"
                title="Gruba Ekle"
              >
                <Plus size={12} />
              </button>
            )}
            {onRemoveFromGroup && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFromGroup();
                }}
                className="bg-red-500 text-white rounded-full hover:bg-red-600 shadow-sm p-1.5"
                title="Gruptan Çıkar"
              >
                <Minus size={12} />
              </button>
            )}
          </div>
        )}

        <div
          className={clsx(
            "absolute top-0 right-0 rounded-full",
            stockStatusColor,
            "w-2 h-2 m-2"
          )}
          title={`Stok: ${stock ?? "Belirtilmemiş"}`}
        />

        <button
          onClick={onClick}
          disabled={disabled}
          className="w-full h-full text-left outline-none focus:outline-none flex flex-col"
        >
          <div className="w-full overflow-hidden bg-gray-50 relative aspect-square">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={title || "Ürün"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full">
                <Image size={36} className="text-gray-300" strokeWidth={1} />
              </div>
            )}

            {vatRate && (
              <div className="absolute bottom-1 left-1 bg-gray-800 bg-opacity-70 text-white rounded-md px-2 py-0.5 text-xs">
                {vatRate} KDV
              </div>
            )}

            {category && (
              <div className="absolute top-1 left-1 bg-indigo-100 text-indigo-700 rounded-md px-2 py-0.5 text-xs">
                {category}
              </div>
            )}
          </div>

          <div className="p-3 flex-1 flex flex-col">
            <h3 className="font-medium text-gray-800 line-clamp-2 text-sm">
              {title || "İsimsiz Ürün"}
            </h3>

            {stock !== undefined && (
              <div className="text-gray-500 flex items-center gap-1 mt-1 text-xs">
                Stok:{" "}
                <span
                  className={clsx(
                    stock === 0
                      ? "text-red-500 font-medium"
                      : stock < 5
                      ? "text-orange-500 font-medium"
                      : "text-gray-600"
                  )}
                >
                  {stock}
                </span>
                {stock < 5 && stock > 0 && (
                  <AlertTriangle size={10} className="text-orange-500" />
                )}
                {stock === 0 && (
                  <span className="text-red-500 font-medium">Tükendi</span>
                )}
              </div>
            )}

            <div className="flex justify-between items-center mt-2">
              <div className="font-bold text-indigo-700 text-lg">
                {price || "Fiyat belirtilmemiş"}
              </div>
            </div>
          </div>
        </button>
      </div>
    );
  }

  // === STAT ===
  if (variant === "stat") {
    return (
      <div
        className={clsx(
          "bg-white rounded-xl p-6 border hover:border-gray-200 transition-colors h-full shadow-sm",
          className
        )}
      >
        <div className="flex items-center gap-3 mb-3">
          {icon && (
            <div
              className={clsx("p-2 rounded-lg", {
                "bg-blue-50 text-blue-600": color === "blue",
                "bg-red-50 text-red-600": color === "red",
                "bg-green-50 text-green-600": color === "green",
                "bg-orange-50 text-orange-600": color === "orange",
                "bg-indigo-50 text-indigo-600": color === "indigo",
              })}
            >
              {icon}
            </div>
          )}
          <span className="text-md font-medium text-gray-600">{title}</span>
        </div>

        <div className="flex items-baseline gap-3">
          <div className="text-2xl font-bold text-gray-900">{value}</div>

          {trend !== undefined && (
            <div
              className={clsx(
                "text-sm font-medium",
                trend > 0 ? "text-green-600" : "text-red-600"
              )}
            >
              {trend > 0 ? "+" : ""}
              {trend}%
            </div>
          )}
        </div>

        {description && (
          <div className="mt-1 text-sm text-gray-500">{description}</div>
        )}
      </div>
    );
  }

  // === DEFAULT ===
  const baseStyle = clsx(
    "bg-white rounded-xl p-4 transition-all duration-200 h-full",
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
