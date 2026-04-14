const { log } = require("./securityLogger");

module.exports = function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  log("UNAUTHORISED", { ip: req.ip, method: req.method, path: req.path });
  res.status(401).json({ error: "Not authenticated" });
};
