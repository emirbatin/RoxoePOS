export interface HotkeyConfig {
  key: string;
  callback: (e?: KeyboardEvent) => void;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

export interface UseHotkeysProps {
  hotkeys: HotkeyConfig[];
  onQuantityUpdate?: (quantity: number) => void;
}

export interface SpecialHotkeySettings {
  id: string;
  description: string;
  type: 'quantity' | 'numpad';
  defaultTrigger: string;
  currentTrigger: string;
  defaultTerminator?: string;
  currentTerminator?: string;
}

export interface UseHotkeysReturn {
  quantityMode: boolean;
  tempQuantity: string;
}
