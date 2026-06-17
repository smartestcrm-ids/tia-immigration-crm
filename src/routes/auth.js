const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const authService = require('../services/authService');
const prisma = require('../db');
const { USER_ROLES } = require('../constants');

const router = express.Router();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RegisterSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(USER_ROLES).optional(),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = LoginSchema.parse(req.body);
    const result = await authService.authenticate(email, password);
    res.json(result);
  })
);

router.post(
  '/register',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = RegisterSchema.parse(req.body);
    const user = await authService.createUserWithPassword(data);
    const { passwordHash, ...safe } = user;
    res.status(201).json(safe);
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  })
);

router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const ok = await authService.verifyPassword(currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
    const passwordHash = await authService.hashPassword(newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    res.json({ ok: true });
  })
);

module.exports = router;
