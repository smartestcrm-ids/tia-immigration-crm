const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const { hasAnyPermission, canSeeAllLeads } = require('../middleware/auth');
const prisma = require('../db');

const router = express.Router();

const ProfileSchema = z.object({
  dateOfBirth:    z.string().optional().nullable(),
  nationality:    z.string().optional().nullable(),
  passportNumber: z.string().optional().nullable(),
  passportExpiry: z.string().optional().nullable(),
  address:        z.string().optional().nullable(),
  notes:          z.string().optional().nullable(),
});

const FamilySchema = z.object({
  relation:       z.enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER']),
  fullName:       z.string().min(1),
  dateOfBirth:    z.string().optional().nullable(),
  nationality:    z.string().optional().nullable(),
  passportNumber: z.string().optional().nullable(),
  passportExpiry: z.string().optional().nullable(),
  notes:          z.string().optional().nullable(),
});

const DocumentSchema = z.object({
  filename:      z.string().min(1).max(255),
  mimeType:      z.string().min(1).max(120),
  size:          z.number().int().nonnegative(),
  category:      z.enum(['PASSPORT', 'BIRTH_CERT', 'MARRIAGE_CERT', 'IELTS', 'DIPLOMA', 'VISA', 'CONTRACT', 'OTHER']),
  contentBase64: z.string().min(1),
  familyMemberId: z.number().int().optional().nullable(),
});

const DATE_KEYS = ['dateOfBirth', 'passportExpiry'];
function parseDates(data) {
  const out = { ...data };
  for (const k of DATE_KEYS) {
    if (out[k]) out[k] = new Date(out[k]);
  }
  return out;
}

async function loadLead(leadId) {
  return prisma.lead.findUnique({ where: { id: Number(leadId) } });
}

async function ensureLeadAccess(req, lead, scopeAll, scopeOwn) {
  if (!lead) {
    const err = new Error('Lead not found');
    err.status = 404;
    throw err;
  }
  const allOk = await hasAnyPermission(req.user.id, scopeAll);
  if (allOk) return;
  const ownOk = await hasAnyPermission(req.user.id, scopeOwn);
  if (ownOk && lead.assignedToId === req.user.id) return;
  const err = new Error('Forbidden');
  err.status = 403;
  throw err;
}

// ---------- Profile ----------

router.get(
  '/:leadId/profile',
  asyncHandler(async (req, res) => {
    const lead = await loadLead(req.params.leadId);
    await ensureLeadAccess(req, lead, 'clients.read.all', 'clients.read.own');
    const profile = await prisma.clientProfile.findUnique({
      where: { leadId: Number(req.params.leadId) },
      include: {
        familyMembers: { orderBy: { createdAt: 'asc' } },
        documents: {
          select: { id: true, filename: true, mimeType: true, size: true, category: true, familyMemberId: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    res.json(profile);
  })
);

router.put(
  '/:leadId/profile',
  asyncHandler(async (req, res) => {
    const lead = await loadLead(req.params.leadId);
    await ensureLeadAccess(req, lead, 'clients.update.all', 'clients.update.own');
    const data = parseDates(ProfileSchema.parse(req.body));
    const profile = await prisma.clientProfile.upsert({
      where: { leadId: lead.id },
      update: data,
      create: { ...data, leadId: lead.id },
    });
    res.json(profile);
  })
);

// ---------- Family members ----------

router.post(
  '/:leadId/family',
  asyncHandler(async (req, res) => {
    const lead = await loadLead(req.params.leadId);
    await ensureLeadAccess(req, lead, 'family.manage.all', 'family.manage.own');
    const data = parseDates(FamilySchema.parse(req.body));
    const profile = await prisma.clientProfile.upsert({
      where: { leadId: lead.id },
      update: {},
      create: { leadId: lead.id },
    });
    const member = await prisma.familyMember.create({
      data: { ...data, clientProfileId: profile.id },
    });
    res.status(201).json(member);
  })
);

router.patch(
  '/:leadId/family/:memberId',
  asyncHandler(async (req, res) => {
    const lead = await loadLead(req.params.leadId);
    await ensureLeadAccess(req, lead, 'family.manage.all', 'family.manage.own');
    const data = parseDates(FamilySchema.partial().parse(req.body));
    const member = await prisma.familyMember.update({
      where: { id: Number(req.params.memberId) },
      data,
    });
    res.json(member);
  })
);

router.delete(
  '/:leadId/family/:memberId',
  asyncHandler(async (req, res) => {
    const lead = await loadLead(req.params.leadId);
    await ensureLeadAccess(req, lead, 'family.manage.all', 'family.manage.own');
    await prisma.familyMember.delete({ where: { id: Number(req.params.memberId) } });
    res.status(204).end();
  })
);

// ---------- Documents ----------

router.post(
  '/:leadId/documents',
  asyncHandler(async (req, res) => {
    const lead = await loadLead(req.params.leadId);
    await ensureLeadAccess(req, lead, 'documents.upload.all', 'documents.upload.own');
    const data = DocumentSchema.parse(req.body);
    const profile = await prisma.clientProfile.upsert({
      where: { leadId: lead.id },
      update: {},
      create: { leadId: lead.id },
    });
    const doc = await prisma.document.create({
      data: {
        filename: data.filename,
        mimeType: data.mimeType,
        size: data.size,
        category: data.category,
        contentBase64: data.contentBase64,
        clientProfileId: profile.id,
        familyMemberId: data.familyMemberId || null,
        uploadedById: req.user.id,
      },
      select: { id: true, filename: true, mimeType: true, size: true, category: true, familyMemberId: true, createdAt: true },
    });
    res.status(201).json(doc);
  })
);

router.get(
  '/:leadId/documents/:docId',
  asyncHandler(async (req, res) => {
    const lead = await loadLead(req.params.leadId);
    await ensureLeadAccess(req, lead, 'documents.download.all', 'documents.download.own');
    const doc = await prisma.document.findUnique({ where: { id: Number(req.params.docId) } });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.set('Content-Type', doc.mimeType);
    res.set('Content-Disposition', `attachment; filename="${doc.filename.replace(/"/g, '')}"`);
    res.send(Buffer.from(doc.contentBase64, 'base64'));
  })
);

router.delete(
  '/:leadId/documents/:docId',
  asyncHandler(async (req, res) => {
    const lead = await loadLead(req.params.leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const allowed = await hasAnyPermission(req.user.id, 'documents.delete');
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });
    await prisma.document.delete({ where: { id: Number(req.params.docId) } });
    res.status(204).end();
  })
);

module.exports = router;
