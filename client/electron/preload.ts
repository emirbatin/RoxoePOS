import { ipcRenderer, contextBridge } from 'electron';

// --------- Expose IPC Renderer API ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  }
});

// --------- Web Serial API'yi Renderer Sürecine Expose Edelim ---------
contextBridge.exposeInMainWorld('serialAPI', {
  requestPort: async () => {
    const nav = navigator as unknown as { serial?: any }; // TypeScript için manuel tanımlama
    if (nav.serial) {
      return await nav.serial.requestPort();
    } else {
      throw new Error("Web Serial API desteklenmiyor!");
    }
  },
  getPorts: async () => {
    const nav = navigator as unknown as { serial?: any };
    if (nav.serial) {
      return await nav.serial.getPorts();
    } else {
      throw new Error("Web Serial API desteklenmiyor!");
    }
  }
});