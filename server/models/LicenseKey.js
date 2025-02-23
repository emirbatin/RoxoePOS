const mongoose = require("mongoose");

const licenseKeySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  isUsed: { type: Boolean, default: false },
  usedBy: { type: String, default: null },
  usedAt: { type: Date, default: null },
  maxActivations: { type: Number, default: 1 },
  activationsCount: { type: Number, default: 0 },
  expires: { 
    type: Date, 
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 gün sonrası
  },
  createdAt: { type: Date, default: Date.now },
  isRevoked: { type: Boolean, default: false }
});

module.exports = mongoose.model("LicenseKey", licenseKeySchema);