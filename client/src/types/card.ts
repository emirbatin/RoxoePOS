export interface StatCardProps {
  title: string;
  value: string;
  description?: string;
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  color?: string;
}