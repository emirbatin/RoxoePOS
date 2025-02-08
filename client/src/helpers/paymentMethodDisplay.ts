// helpers/paymentMethodDisplay.ts
import { PaymentMethod } from "../types/pos";

export function getPaymentMethodDisplay(method: PaymentMethod): string {
  switch (method) {
    case "nakit":
      return "Nakit";
    case "kart":
      return "Kredi Kartı";
    case "veresiye":
      return "Veresiye";
    case "nakitpos":
      return "POS (Nakit)";
    case "mixed":
      return "Karışık (Split)";
    default:
      return method; // veya "Bilinmeyen Yöntem"
  }
}