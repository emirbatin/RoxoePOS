// types/filter.ts
export interface SalesFilter {
    startDate?: Date;
    endDate?: Date;
    status?: string;
    paymentMethod?: string;
    minAmount?: number;
    maxAmount?: number;
    hasDiscount?: boolean;
    [key: string]: any;
  }
  
  export interface ActiveFilter {
    key: string;
    label: string;
    value: string;
    color?: string;
    icon?: React.ReactNode;
  }
  
  export type FilterPanelMode = 'sales' | 'pos' | 'basic';