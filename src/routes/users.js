const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const { requireRole } = require('../middleware/auth');
const prisma = require('../db');
const authService = require('../services/authService');
const { USER_ROLES } = require('../constants');

const router = express.Router();

const UserCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(USER_ROLES).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

const UserUpdateSchema = UserCreateSchema.partial();

const SAFE_FIELDS = {
  id: true, email: true, name: true, role: true, active: true,
  createdAt: true, updatedAt: true,
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: SAFE_FIELDS,
    });
    res.json(users);
  })
);

router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = UserCreateSchema.parse(req.body);
    const user = await authService.createUserWithPassword({
      email: data.email,
      name: data.name,
      role: data.role,
      password: data.password,
    });
    const { passwordHash, ...safe } = user;
    res.status(201).json(safe);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: Number(req.params.id) },
      select: SAFE_FIELDS,
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  })
);

router.patch(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = UserUpdateSchema.parse(req.body);
    const update = { ...data };
    if (data.password) {
      update.passwordHash = await authService.hashPassword(data.password);
      delete update.password;
    }
    if (update.email) update.email = update.email.toLowerCase().trim();
    const user = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: update,
      select: SAFE_FIELDS,
    });
    res.json(user);
  })
);

module.exports = router;
