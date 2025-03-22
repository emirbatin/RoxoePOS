// src/utils/EventBus.ts
type EventCallback = (data?: any) => void;

interface EventMap {
  [eventName: string]: EventCallback[];
}

class EventBus {
  private events: EventMap = {};

  // Olay dinleyicisi ekle
  on(eventName: string, callback: EventCallback): void {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);
  }

  // Olay dinleyicisini kaldır
  off(eventName: string, callback: EventCallback): void {
    if (!this.events[eventName]) return;
    this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
  }

  // Olay yayınla (emit)
  emit(eventName: string, data?: any): void {
    if (!this.events[eventName]) return;
    this.events[eventName].forEach(callback => callback(data));
  }
}

// Tek bir global olay yayıncısı oluştur
const eventBus = new EventBus();
export default eventBus;