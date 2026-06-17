const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const { requirePermission, clearPermCache } = require('../middleware/auth');
const prisma = require('../db');

const router = express.Router();

const RoleCreateSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(500).optional().nullable(),
  permissionIds: z.array(z.number().int()).optional(),
});

const RoleUpdateSchema = RoleCreateSchema.partial();

router.get(
  '/permissions',
  requirePermission('roles.read', 'roles.manage'),
  asyncHandler(async (req, res) => {
    const perms = await prisma.permission.findMany({ orderBy: [{ category: 'asc' }, { key: 'asc' }] });
    res.json(perms);
  })
);

router.get(
  '/',
  requirePermission('roles.read', 'roles.manage'),
  asyncHandler(async (req, res) => {
    const roles = await prisma.role.findMany({
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
    });
    const shaped = roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r._count.users,
      permissionKeys: r.permissions.map((rp) => rp.permission.key),
    }));
    res.json(shaped);
  })
);

router.post(
  '/',
  requirePermission('roles.manage'),
  asyncHandler(async (req, res) => {
    const data = RoleCreateSchema.parse(req.body);
    const role = await prisma.role.create({
      data: {
        name: data.name,
        description: data.description || null,
        isSystem: false,
        permissions: data.permissionIds && data.permissionIds.length
          ? { create: data.permissionIds.map((id) => ({ permissionId: id })) }
          : undefined,
      },
    });
    res.status(201).json(role);
  })
);

router.patch(
  '/:id',
  requirePermission('roles.manage'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const data = RoleUpdateSchema.parse(req.body);

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Role not found' });
    if (existing.isSystem && data.name) {
      return res.status(400).json({ error: 'Cannot rename a system role' });
    }

    await prisma.role.update({
      where: { id },
      data: {
        name: data.name || undefined,
        description: data.description !== undefined ? data.description : undefined,
      },
    });
    if (data.permissionIds) {
      await prisma.rolePermission.deleteMany({ where: { roleId: id } });
      if (data.permissionIds.length > 0) {
        await prisma.rolePermission.createMany({
          data: data.permissionIds.map((pid) => ({ roleId: id, permissionId: pid })),
        });
      }
    }
    clearPermCache();
    const fresh = await prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    res.json({
      id: fresh.id,
      name: fresh.name,
      description: fresh.description,
      isSystem: fresh.isSystem,
      permissionKeys: fresh.permissions.map((rp) => rp.permission.key),
    });
  })
);

router.delete(
  '/:id',
  requirePermission('roles.manage'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Role not found' });
    if (existing.isSystem) return res.status(400).json({ error: 'Cannot delete a system role' });
    if (existing._count.users > 0) {
      return res.status(400).json({
        error: `Cannot delete: ${existing._count.users} user(s) still assigned to this role`,
      });
    }
    await prisma.role.delete({ where: { id } });
    clearPermCache();
    res.status(204).end();
  })
);

module.exports = router;
