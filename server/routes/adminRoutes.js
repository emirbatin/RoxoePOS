const express = require("express");
const session = require("express-session");
const router = express.Router();

const { getAllLicenses, createLicense, deleteLicense } = require("../controllers/adminController");
const adminSession = require("../middlewares/adminSession");

// Session Middleware
router.use(session({
  secret: "super-secret-key", // Bunu .env'den de alabilirsin
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // HTTPS kullanıyorsan true yap
}));

// 1) Admin Key Girişi Ekranı
router.get("/login", (req, res) => {
  res.render("adminLogin", { error: null });
});

// 2) Admin Key Girişi POST
router.post("/login", (req, res) => {
  const enteredKey = req.body.adminKey; // Formdan gelen key
  const correctKey = process.env.ADMIN_API_KEY; // .env'deki key

  if (enteredKey === correctKey) {
    // Doğru key -> session.isAdmin = true
    req.session.isAdmin = true;
    return res.redirect("/admin");
  }

  // Yanlış key -> hata mesajı
  res.render("adminLogin", { error: "Hatalı Admin Key" });
});

// 3) Admin Panel (Koruma: adminSession)
router.get("/", adminSession, getAllLicenses);

// Lisans oluşturma
router.post("/create", adminSession, createLicense);

// Lisans silme
router.post("/delete/:key", adminSession, deleteLicense);

// 4) Logout
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin/login");
  });
});

module.exports = router;