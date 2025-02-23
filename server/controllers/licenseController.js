const { v4: uuidv4 } = require("uuid");
const LicenseKey = require("../models/LicenseKey");
const { createLicenseToken } = require("../services/licenseService");

async function createLicenseKey(req, res) {
  try {
    const { maxActivations, expires, companyName } = req.body;
    // Rastgele key oluşturuluyor
    const newKey = uuidv4().toUpperCase();

    let expirationDate = null;
    if (expires) {
      // Eğer expires değeri sayı veya sayı içeren bir stringse gün olarak yorumla
      if (!isNaN(Number(expires))) {
        const days = Number(expires);
        expirationDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      } else {
        // Aksi halde tarih stringi olarak gönderilmişse
        const parsedExpires = new Date(expires);
        if (!isNaN(parsedExpires.getTime()) && parsedExpires > new Date()) {
          expirationDate = parsedExpires;
        }
      }
    }
    // Eğer expires gönderilmezse veya geçerli değilse, expirationDate null kalır (sınırsız)

    const newLicense = await LicenseKey.create({
      key: newKey,
      maxActivations: maxActivations || 1,
      expires: expirationDate,
      usedBy: companyName || null,
    });

    return res.json({
      success: true,
      message: "Lisans oluşturuldu",
      licenseKey: newLicense.key,
      expires: newLicense.expires,
    });
  } catch (error) {
    console.error("Lisans oluşturma hatası:", error);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
}

async function verifyLicenseKey(req, res) {
  try {
    const { licenseKey, companyInfo, machineId } = req.body;
    const record = await LicenseKey.findOne({ key: licenseKey });
    if (!record) {
      return res.status(400).json({ error: "Geçersiz lisans key" });
    }
    if (record.isRevoked) {
      return res
        .status(400)
        .json({ error: "Bu lisans iptal edilmiş (revoked)" });
    }
    // Sadece expires değeri varsa kontrol et
    if (record.expires && record.expires < new Date()) {
      return res.status(400).json({ error: "Lisans süresi dolmuş." });
    }
    if (record.activationsCount >= record.maxActivations) {
      return res.status(400).json({ error: "Lisans aktivasyon limiti doldu." });
    }
    record.isUsed = true;
    record.usedBy = record.usedBy || companyInfo?.name || "Bilinmeyen Firma";
    record.usedAt = new Date();
    record.activationsCount += 1;
    await record.save();

    return res.json({
      success: true,
      token: createLicenseToken(record),
      licenseKey: record.key,
      expires: record.expires,
    });
  } catch (error) {
    console.error("verifyLicenseKey hatası:", error);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
}

async function getLicenseStatus(req, res) {
  try {
    const { key } = req.params;
    const license = await LicenseKey.findOne({ key });
    if (!license) {
      return res.status(404).json({ error: "Lisans bulunamadı" });
    }
    return res.json({
      success: true,
      key: license.key,
      usedBy: license.usedBy || "Henüz kullanılmamış",
      usedAt: license.usedAt,
      activations: `${license.activationsCount}/${license.maxActivations}`,
      expires: license.expires || "Süresiz",
      isRevoked: license.isRevoked,
      createdAt: license.createdAt,
    });
  } catch (error) {
    console.error("Lisans durumu getirme hatası:", error);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
}

async function revokeLicenseKey(req, res) {
  try {
    const { key } = req.params;
    const license = await LicenseKey.findOne({ key });
    if (!license) {
      return res.status(404).json({ error: "Lisans bulunamadı" });
    }
    license.isRevoked = true;
    await license.save();
    return res.json({ success: true, message: "Lisans iptal edildi." });
  } catch (error) {
    console.error("Lisans iptal hatası:", error);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
}

async function deleteLicenseKey(req, res) {
  try {
    const { key } = req.params;
    const deleted = await LicenseKey.findOneAndDelete({ key });
    if (!deleted) {
      return res.status(404).json({ error: "Lisans bulunamadı" });
    }
    return res.json({ success: true, message: "Lisans silindi" });
  } catch (error) {
    console.error("Lisans silme hatası:", error);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
}

module.exports = {
  createLicenseKey,
  verifyLicenseKey,
  getLicenseStatus,
  revokeLicenseKey,
  deleteLicenseKey,
};
