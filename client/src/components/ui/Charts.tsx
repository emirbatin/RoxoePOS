import React from "react";
import { ResponsiveContainer } from "recharts";

interface ChartsProps {
  children: React.ReactElement; // React.ReactElement olarak değiştirildi
  width?: number | string;
  height?: number | string;
}

const Charts: React.FC<ChartsProps> = ({ children, width = "100%", height = "100%" }) => {
  return (
    <ResponsiveContainer width={width} height={height}>
      {children}
    </ResponsiveContainer>
  );
};

export default Charts;