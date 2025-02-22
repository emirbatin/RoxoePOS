// hooks/useHotkeys.ts
import { useCallback, useEffect, useState } from 'react';
import { SpecialHotkeySettings, UseHotkeysProps, UseHotkeysReturn } from '../types/hotkey';

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

export const useHotkeys = ({
  hotkeys,
  onQuantityUpdate,
}: UseHotkeysProps): UseHotkeysReturn => {
  const [quantityMode, setQuantityMode] = useState(false);
  const [tempQuantity, setTempQuantity] = useState("");

  const loadHotkeySettings = useCallback(() => {
    try {
      const saved = localStorage.getItem('hotkeySettings');
      const savedSpecial = localStorage.getItem('specialHotkeySettings');
      return {
        normal: saved ? JSON.parse(saved) : null,
        special: savedSpecial ? JSON.parse(savedSpecial) : null
      };
    } catch {
      return { normal: null, special: null };
    }
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key.match(/^F\d+$/)) {
        event.preventDefault();
      }

      const settings = loadHotkeySettings();
      const specialSettings = settings.special as SpecialHotkeySettings[] | null;

      const starModeConfig = specialSettings?.find(s => s.id === 'star_mode');
      const quickQuantityConfig = specialSettings?.find(s => s.id === 'quick_quantity');

      const isInputActive = document.activeElement instanceof HTMLInputElement ||
                          document.activeElement instanceof HTMLTextAreaElement;

      if (isInputActive && !quantityMode) {
        if (event.key === 'Escape') {
          (document.activeElement as HTMLElement).blur();
        }
        return;
      }

      if (starModeConfig && event.key === starModeConfig.currentTrigger) {
        event.preventDefault();
        setQuantityMode(true);
        setTempQuantity("");
        return;
      }

      if (quantityMode) {
        event.preventDefault();
        if (/[0-9]/.test(event.key)) {
          setTempQuantity(prev => prev + event.key);
        }
        else if (
          starModeConfig && 
          event.key === (starModeConfig.currentTerminator || 'Enter') && 
          tempQuantity
        ) {
          const newQuantity = parseInt(tempQuantity, 10);
          if (!isNaN(newQuantity) && newQuantity > 0 && onQuantityUpdate) {
            onQuantityUpdate(newQuantity);
          }
          setQuantityMode(false);
          setTempQuantity("");
        }
        else if (event.key === 'Escape') {
          setQuantityMode(false);
          setTempQuantity("");
        }
        return;
      }

      if (
        quickQuantityConfig?.currentTrigger === '0-9' &&
        /^[0-9]$/.test(event.key) &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        !isInputActive
      ) {
        event.preventDefault();
        const quantity = parseInt(event.key, 10);
        if (!isNaN(quantity) && onQuantityUpdate) {
          onQuantityUpdate(quantity);
        }
        return;
      }

      hotkeys.forEach(({ key, callback, ctrlKey, metaKey, altKey, shiftKey }) => {
        const customHotkey = settings.normal?.find((ch: any) => 
          ch.defaultKey.toLowerCase() === key.toLowerCase() && 
          ch.defaultModifier === !!ctrlKey
        );

        let matchesKey = false;
        let matchesModifier = false;

        if (customHotkey) {
          matchesKey = event.key.toLowerCase() === customHotkey.currentKey.toLowerCase();
          matchesModifier = isMac 
            ? event.metaKey === customHotkey.currentModifier
            : event.ctrlKey === customHotkey.currentModifier;
        } else {
          matchesKey = event.key.toLowerCase() === key.toLowerCase();
          matchesModifier = isMac 
            ? (!!event.metaKey === !!ctrlKey)
            : (!!event.ctrlKey === !!ctrlKey);
        }

        const matchesAlt = !!event.altKey === !!altKey;
        const matchesShift = !!event.shiftKey === !!shiftKey;

        if (matchesKey && matchesModifier && matchesAlt && matchesShift) {
          event.preventDefault();
          callback(event);
        }
      });
    },
    [hotkeys, quantityMode, tempQuantity, onQuantityUpdate, loadHotkeySettings]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return {
    quantityMode,
    tempQuantity
  };
};