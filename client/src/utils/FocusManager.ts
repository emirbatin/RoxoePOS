// src/utils/FocusManager.ts
type FocusableElement = HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement;

class FocusManager {
  private static instance: FocusManager;
  private currentFocus: FocusableElement | null = null;

  private constructor() {}

  static getInstance(): FocusManager {
    if (!FocusManager.instance) {
      FocusManager.instance = new FocusManager();
    }
    return FocusManager.instance;
  }

  setFocus(element: FocusableElement | null) {
    this.currentFocus = element;
    if (element) {
      setTimeout(() => {
        element.focus();
      }, 0);
    }
  }

  clearFocus() {
    if (this.currentFocus) {
      this.currentFocus.blur();
      this.currentFocus = null;
    }
  }

  getCurrentFocus() {
    return this.currentFocus;
  }
}

export const focusManager = FocusManager.getInstance();