require("dotenv").config();

function adminCheck(req, res, next) {
  const adminApiKey = process.env.ADMIN_API_KEY;
  if (!adminApiKey) {
    return res
      .status(500)
      .json({ error: "Server config error: ADMIN_API_KEY missing" });
  }
  const clientKey = req.header("X-Admin-Key");
  if (!clientKey || clientKey !== adminApiKey) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
}

module.exports = adminCheck;
