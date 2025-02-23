const express = require("express");
const router = express.Router();
const { createLicenseKey, verifyLicenseKey } = require("../controllers/licenseController");
// opsiyonel: adminCheck
// const adminCheck = require("../middlewares/adminCheck");

// /api/licenses/create (json)
router.post("/create", /* adminCheck, */ createLicenseKey);
// /api/licenses/verify
router.post("/verify", verifyLicenseKey);

module.exports = router;