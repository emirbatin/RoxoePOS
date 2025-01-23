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

export interface HotkeysHelperProps {
    className?: string;
  }
