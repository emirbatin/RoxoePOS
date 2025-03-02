const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const compression = require('compression'); // Yeni eklenen

const licenseRoutes = require("./routes/licenseRoutes");
const adminRoutes = require("./routes/adminRoutes"); // Admin panel

const rateLimiter = require("./middlewares/rateLimit"); // Opsiyonel

const app = express();

// Proxy ayarı - Render.com gibi platformlarda gerekli
app.set('trust proxy', 1);

// Temel güvenlik header'ları
app.use(helmet());
// Sıkıştırma middleware'i
app.use(compression());
// JSON parse
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }))
// CORS
app.use(cors());

// Rate limiting
app.use(rateLimiter);

// EJS ayarları
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Test endpoint
app.get("/", (req, res) => {
  res.send("Lisans Sunucusu Çalışıyor!");
});

// API rotaları
app.use("/api/licenses", licenseRoutes);

// Admin panel rotaları (EJS)
app.use("/admin", adminRoutes);

module.exports = app;