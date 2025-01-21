import React from 'react';
import { StatCardProps } from "../types/card";

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon,
  trend,
  trendLabel,
  color = "primary",
}) => (
  <div className="bg-white p-6 rounded-lg border">
    <div className="flex justify-between">
      <div>
        <div className="text-sm font-medium text-gray-500">{title}</div>
        <div className="mt-2 text-3xl font-semibold">{value}</div>
        {description && (
          <div className="mt-1 text-sm text-gray-500">{description}</div>
        )}
        {trend !== undefined && (
          <div
            className={`mt-2 text-sm ${
              trend >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
            {trendLabel && (
              <span className="text-gray-500 ml-1">{trendLabel}</span>
            )}
          </div>
        )}
      </div>
      <div className={`text-${color}-600`}>{icon}</div>
    </div>
  </div>
);
