const rateLimit = require("express-rate-limit");
require("dotenv").config();

const windowMs = (process.env.RATE_LIMIT_WINDOW || 60) * 1000; // default 60 saniye
const maxRequests = process.env.RATE_LIMIT_MAX || 20;         // default 20 istek

const limiter = rateLimit({
  windowMs,
  max: maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Çok fazla istek atıyorsunuz, biraz bekleyin."
  }
});

module.exports = limiter;