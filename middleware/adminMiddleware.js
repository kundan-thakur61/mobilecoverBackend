/**
 * Admin middleware
 * Ensures the user is authenticated and has admin role
 */
const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required.' 
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Admin privileges required.' 
    });
  }

  next();
};

/**
 * Role-based middleware factory
 * Creates middleware for specific roles
 */
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required.' 
      });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. ${role.charAt(0).toUpperCase() + role.slice(1)} privileges required.` 
      });
    }

    next();
  };
};

module.exports = { adminMiddleware, requireRole };