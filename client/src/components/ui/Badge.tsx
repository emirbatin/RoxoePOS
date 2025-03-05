import React from "react";

interface BadgeProps {
  variant?: "default" | "outline" | "secondary";
  className?: string;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = "default",
  className = "",
  children,
}) => {
  const variantClasses = {
    default: "bg-blue-100 text-blue-800",
    outline: "bg-transparent border border-gray-200 text-gray-800",
    secondary: "bg-gray-100 text-gray-800",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
};