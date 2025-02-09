import { POSConfig, SerialPort } from "../types/pos";

export class POSService {
  private port: SerialPort | null = null;
  private currentConfig: POSConfig | null = null;
  private readonly DEFAULT_CONFIGS: Record<string, POSConfig> = {
    Ingenico: {
      type: "Ingenico",
      baudRate: 9600,
      protocol: "OPOS",
      commandSet: {
        payment: "0x02payment0x03",
        cancel: "0x02cancel0x03",
        status: "0x02status0x03",
      },
      manualMode: false,
    },
    Verifone: {
      type: "Verifone",
      baudRate: 115200,
      protocol: "JavaPOS",
      commandSet: {
        payment: "0x02PAY0x03",
        cancel: "0x02CAN0x03",
        status: "0x02STA0x03",
      },
      manualMode: false,
    },
  };

  // Manuel mod kontrolü için localStorage'dan config okuma
  private loadConfig(): POSConfig | null {
    const savedConfig = localStorage.getItem("posConfig");
    if (savedConfig) {
      return JSON.parse(savedConfig);
    }
    return null;
  }

  // Manuel mod kontrolü
  async isManualMode(): Promise<boolean> {
    const config = this.loadConfig();
    return config?.manualMode || false;
  }

  async connect(posType: string): Promise<boolean> {
    try {
      // Manuel mod kontrolü
      const savedConfig = this.loadConfig();
      if (savedConfig?.manualMode) {
        this.currentConfig = savedConfig;
        return true;
      }

      const config = this.DEFAULT_CONFIGS[posType];
      if (!config) throw new Error(`POS tipi desteklenmiyor: ${posType}`);

      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: config.baudRate });
      this.port = port;
      this.currentConfig = config;
      return true;
    } catch (error) {
      console.error("POS bağlantı hatası:", error);
      return false;
    }
  }

  async processPayment(
    amount: number
  ): Promise<{ success: boolean; message: string }> {
    // Manuel mod kontrolü
    if (await this.isManualMode()) {
      return { success: true, message: "Ödeme başarılı (Manuel Mod)" };
    }

    if (!this.port || !this.currentConfig) {
      return { success: false, message: "POS bağlantısı yok" };
    }

    try {
      const writer = this.port.writable.getWriter();
      const command = this.formatPaymentCommand(amount);
      await writer.write(command);
      writer.releaseLock();
      const response = await this.waitForResponse();
      return this.parseResponse(response);
    } catch (error) {
      console.error("Ödeme işlemi hatası:", error);
      return { success: false, message: "Ödeme işlemi başarısız" };
    }
  }

  async cancelTransaction(): Promise<boolean> {
    // Manuel modda iptal işlemi her zaman başarılı
    if (await this.isManualMode()) {
      return true;
    }

    if (!this.port || !this.currentConfig) return false;
    try {
      const writer = this.port.writable.getWriter();
      const command = new TextEncoder().encode(
        this.currentConfig.commandSet.cancel
      );
      await writer.write(command);
      writer.releaseLock();
      return true;
    } catch (error) {
      console.error("İptal işlemi hatası:", error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // Manuel modda bağlantı kesme işlemi gerekmiyor
    if (await this.isManualMode()) {
      return;
    }

    if (this.port) {
      await this.port.close();
      this.port = null;
      this.currentConfig = null;
    }
  }

  private formatPaymentCommand(amount: number): Uint8Array {
    if (!this.currentConfig) throw new Error("POS yapılandırması yok");
    const amountStr = amount.toFixed(2).replace(".", "");
    const command = `${this.currentConfig.commandSet.payment}${amountStr}`;
    return new TextEncoder().encode(command);
  }

  private async waitForResponse(): Promise<Uint8Array> {
    if (!this.port) throw new Error("POS bağlantısı yok");
    const reader = this.port.readable.getReader();
    const { value, done } = await reader.read();
    reader.releaseLock();
    if (done || !value) throw new Error("POS yanıt vermedi");
    return value;
  }

  private parseResponse(response: Uint8Array): {
    success: boolean;
    message: string;
  } {
    // POS cihazından gelen yanıtı işle
    const responseText = new TextDecoder().decode(response);
    // Başarılı işlem kontrolü (cihaza göre özelleştirilebilir)
    if (responseText.includes("approved") || responseText.includes("success")) {
      return { success: true, message: "Ödeme başarılı" };
    }
    return { success: false, message: "Ödeme reddedildi" };
  }
}

export const posService = new POSService();