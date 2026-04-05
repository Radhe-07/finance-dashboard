const jwt = require("jsonwebtoken");
const prisma = require("../config/db");

/**
 * Verifies the JWT token and attaches the user to req.user.
 * All protected routes must use this middleware first.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: "User no longer exists." });
    }

    if (user.status === "INACTIVE") {
      return res.status(403).json({ success: false, message: "Account is inactive." });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token expired." });
    }
    return res.status(401).json({ success: false, message: "Invalid token." });
  }
};

/**
 * Role hierarchy: ADMIN > ANALYST > VIEWER
 * authorize("ANALYST") means ANALYST and ADMIN can access.
 * authorize("ADMIN") means only ADMIN can access.
 */
const ROLE_HIERARCHY = { VIEWER: 1, ANALYST: 2, ADMIN: 3 };

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = Math.min(...allowedRoles.map((r) => ROLE_HIERARCHY[r] || 99));

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires one of: ${allowedRoles.join(", ")}`,
      });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
