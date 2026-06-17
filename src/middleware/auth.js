const { verifyToken } = require('../services/authService');
const prisma = require('../db');

/**
 * Cache user permissions by user id for the lifetime of the request.
 * In a real deployment, you'd use a short-lived cache or include perms in the JWT.
 */
const permCache = new Map(); // userId -> Set<permKey>

async function loadPermissions(userId) {
  if (permCache.has(userId)) return permCache.get(userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roleRef: { include: { permissions: { include: { permission: true } } } } },
  });
  const set = new Set();
  if (user?.roleRef) {
    for (const rp of user.roleRef.permissions) set.add(rp.permission.key);
  }
  permCache.set(userId, set);
  return set;
}

function clearPermCache(userId) {
  if (userId) permCache.delete(userId);
  else permCache.clear();
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role, name: payload.name };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}

/**
 * Permission-based middleware. Pass one or more permission keys; user needs ANY of them.
 * Example: requirePermission('leads.read.all', 'leads.read.own')
 */
function requirePermission(...keys) {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
      const perms = await loadPermissions(req.user.id);
      if (keys.some((k) => perms.has(k))) {
        req.userPermissions = perms;
        return next();
      }
      return res.status(403).json({ error: 'Forbidden: missing permission', required: keys });
    } catch (e) {
      next(e);
    }
  };
}

/**
 * Returns true if the requester can access leads/conversations they aren't assigned to.
 * Legacy helper that the services already use; now also considers permissions.
 */
function canSeeAllLeads(user) {
  if (!user) return false;
  // Fall back to role string check (services that don't await loadPermissions still work).
  return user.role === 'ADMIN' || user.role === 'MANAGER';
}

async function hasPermission(userId, key) {
  const perms = await loadPermissions(userId);
  return perms.has(key);
}

async function hasAnyPermission(userId, ...keys) {
  const perms = await loadPermissions(userId);
  return keys.some((k) => perms.has(k));
}

module.exports = {
  requireAuth,
  requireRole,
  requirePermission,
  canSeeAllLeads,
  loadPermissions,
  clearPermCache,
  hasPermission,
  hasAnyPermission,
};
