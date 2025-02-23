const LicenseKey = require("../models/LicenseKey");
const { v4: uuidv4 } = require("uuid");

// Admin panel sayfası
async function getAllLicenses(req, res) {
  try {
    const licenses = await LicenseKey.find().sort({ createdAt: -1 });
    // dashboard.ejs'yi render
    res.render("dashboard", { licenses });
  } catch (error) {
    console.error("getAllLicenses hatası:", error);
    res.status(500).send("Sunucu hatası");
  }
}

// Yeni lisans oluşturma
async function createLicense(req, res) {
  try {
    const { companyName, maxActivations, expires } = req.body;
    const newKey = uuidv4().toUpperCase();

    await LicenseKey.create({
      key: newKey,
      maxActivations: maxActivations || 1,
      expires: expires ? new Date(expires) : null,
      usedBy: companyName || null
    });

    res.redirect("/admin");
  } catch (error) {
    console.error("createLicense hatası:", error);
    res.status(500).send("Sunucu hatası");
  }
}

// Lisans silme
async function deleteLicense(req, res) {
  try {
    const { key } = req.params;
    await LicenseKey.findOneAndDelete({ key });
    res.redirect("/admin");
  } catch (error) {
    console.error("deleteLicense hatası:", error);
    res.status(500).send("Sunucu hatası");
  }
}

module.exports = {
  getAllLicenses,
  createLicense,
  deleteLicense
};