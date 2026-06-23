const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "ไม่พบ Token กรุณา Login ใหม่",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: "Token หมดอายุหรือไม่ถูกต้อง",
    });
  }
};

const verifyAdmin = (req, res, next) => {
  if (req.user && (req.user.role_id === 1 || req.user.role_id === 2)) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: "คุณไม่มีสิทธิ์เข้าถึง (สำหรับ Admin เท่านั้น)",
    });
  }
};

module.exports = { verifyToken, verifyAdmin };
