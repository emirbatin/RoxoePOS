function adminSession(req, res, next) {
  // Eğer session isAdmin değilse, /admin/login'e yönlendir
  if (!req.session || !req.session.isAdmin) {
    return res.redirect("/admin/login");
  }
  next();
}

module.exports = adminSession;