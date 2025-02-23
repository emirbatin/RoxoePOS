const jwt = require("jsonwebtoken");
const { PRIVATE_KEY, PUBLIC_KEY } = require("../config/keys"); // .env’den okumuş olabilirsiniz

function createLicenseToken(licenseRecord) {
  const payload = {
    key: licenseRecord.key,
    usedBy: licenseRecord.usedBy,
    maxActivations: licenseRecord.maxActivations,
    activationsCount: licenseRecord.activationsCount,
    expires: licenseRecord.expires
  };

  return jwt.sign(payload, PRIVATE_KEY, {
    algorithm: "RS256",
    expiresIn: "10y" // 10 yıl geçerli
  });
}

function verifyLicenseToken(token) {
  try {
    const decoded = jwt.verify(token, PUBLIC_KEY, { algorithms: ["RS256"] });
    return decoded; // JWT geçerliyse içeriğini döndür
  } catch (err) {
    console.error("JWT doğrulama hatası:", err);
    return null; // Token geçersizse null döndür
  }
}

module.exports = {
  createLicenseToken,verifyLicenseToken
};