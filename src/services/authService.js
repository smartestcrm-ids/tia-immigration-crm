const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function authenticate(email, password) {
  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
  if (!user || !user.active) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }
  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token: signToken(user),
  };
}

/**
 * Resolve a role name (e.g. "ADMIN") to its database Role.id, so that the
 * user gets BOTH a role string and a roleId — the latter is what the
 * permission middleware uses to look up the role's permissions.
 */
async function resolveRoleId(roleName) {
  if (!roleName) return null;
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  return role ? role.id : null;
}

async function createUserWithPassword({ email, name, role, password }) {
  const passwordHash = password ? await hashPassword(password) : null;
  const roleName = role || 'CONSULTANT';
  const roleId = await resolveRoleId(roleName);
  return prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      name,
      role: roleName,
      roleId,
      passwordHash,
    },
  });
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  authenticate,
  createUserWithPassword,
  resolveRoleId,
};
