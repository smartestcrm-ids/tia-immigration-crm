const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { requireRole } = require('../middleware/auth');
const prisma = require('../db');

const router = express.Router();

// All reports are admin/manager-only.
router.use(requireRole('ADMIN', 'MANAGER'));

// -----------------------------------------------------------------------------
// GET /api/reports/summary — headline numbers
// -----------------------------------------------------------------------------
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOf7d    = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const startOf30d   = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalLeads, totalClients, totalOpenCases,
      newThisMonth, convertedThisMonth,
      newLast7d, newLast30d,
      leadsByStatus, casesByStage, leadsBySource,
      cases,
    ] = await Promise.all([
      prisma.lead.count({ where: { status: { not: 'CONVERTED' } } }),
      prisma.lead.count({ where: { status: 'CONVERTED' } }),
      prisma.case.count({ where: { status: 'ACTIVE' } }),
      prisma.lead.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.lead.count({ where: { status: 'CONVERTED', updatedAt: { gte: startOfMonth } } }),
      prisma.lead.count({ where: { createdAt: { gte: startOf7d } } }),
      prisma.lead.count({ where: { createdAt: { gte: startOf30d } } }),
      prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.case.groupBy({ by: ['currentStage'], _count: { _all: true } }),
      prisma.lead.groupBy({ by: ['source'], _count: { _all: true } }),
      prisma.case.findMany({ select: { agreementAmount: true, amountPaid: true } }),
    ]);

    const revenue = cases.reduce(
      (acc, c) => {
        acc.agreement += Number(c.agreementAmount) || 0;
        acc.paid      += Number(c.amountPaid)      || 0;
        return acc;
      },
      { agreement: 0, paid: 0 }
    );
    revenue.balance = revenue.agreement - revenue.paid;

    // Conversion rate = converted-this-month / new-this-month.
    const conversionRate = newThisMonth > 0 ? (convertedThisMonth / newThisMonth) : 0;

    res.json({
      totals: { leads: totalLeads, clients: totalClients, openCases: totalOpenCases },
      recent: { newThisMonth, convertedThisMonth, newLast7d, newLast30d, conversionRate },
      revenue,
      breakdowns: {
        leadsByStatus:  toObj(leadsByStatus,  'status'),
        casesByStage:   toObj(casesByStage,   'currentStage'),
        leadsBySource:  toObj(leadsBySource,  'source'),
      },
    });
  })
);

function toObj(groups, key) {
  return Object.fromEntries(groups.map((g) => [g[key], g._count._all]));
}

// -----------------------------------------------------------------------------
// CSV helpers
// -----------------------------------------------------------------------------
function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  return lines.join('\n') + '\n';
}

function sendCsv(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

// -----------------------------------------------------------------------------
// GET /api/reports/leads.csv
// -----------------------------------------------------------------------------
router.get(
  '/leads.csv',
  asyncHandler(async (req, res) => {
    const leads = await prisma.lead.findMany({
      where: { status: { not: 'CONVERTED' } },
      include: { caseType: true, assignedTo: true },
      orderBy: { createdAt: 'desc' },
    });
    const csv = rowsToCsv(
      ['ID', 'Full Name', 'Email', 'Phone', 'Source', 'Status', 'Case Type', 'Assigned To', 'Created At'],
      leads.map((l) => [
        l.id, l.fullName, l.email, l.phone, l.source, l.status,
        l.caseType?.name, l.assignedTo?.name,
        l.createdAt.toISOString(),
      ])
    );
    sendCsv(res, `leads_${today()}.csv`, csv);
  })
);

// -----------------------------------------------------------------------------
// GET /api/reports/clients.csv
// -----------------------------------------------------------------------------
router.get(
  '/clients.csv',
  asyncHandler(async (req, res) => {
    const leads = await prisma.lead.findMany({
      where: { status: 'CONVERTED' },
      include: {
        caseType: true, assignedTo: true,
        case: { include: { caseType: true, caseManager: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const csv = rowsToCsv(
      [
        'Lead ID', 'Full Name', 'Email', 'Phone', 'Case Type',
        'Case Stage', 'Case Status', 'Case Manager',
        'Agreement', 'Paid', 'Balance', 'Currency', 'Agreement Date',
      ],
      leads.map((l) => {
        const c = l.case;
        const agreement = Number(c?.agreementAmount) || 0;
        const paid      = Number(c?.amountPaid)      || 0;
        return [
          l.id, l.fullName, l.email, l.phone,
          l.caseType?.name || c?.caseType?.name || '',
          c?.currentStage, c?.status, c?.caseManager?.name,
          agreement, paid, agreement - paid,
          c?.currency || 'CAD',
          c?.agreementDate ? c.agreementDate.toISOString().slice(0, 10) : '',
        ];
      })
    );
    sendCsv(res, `clients_${today()}.csv`, csv);
  })
);

// -----------------------------------------------------------------------------
// GET /api/reports/cases.csv
// -----------------------------------------------------------------------------
router.get(
  '/cases.csv',
  asyncHandler(async (req, res) => {
    const cases = await prisma.case.findMany({
      include: {
        lead: true, caseType: true, caseManager: true,
        requirements: { select: { status: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const csv = rowsToCsv(
      [
        'Case ID', 'Client', 'Case Type', 'Stage', 'Status', 'Manager',
        'Agreement', 'Paid', 'Balance',
        'Docs Total', 'Docs Received', 'Docs Missing',
        'Opened At', 'Submitted At', 'Closed At',
      ],
      cases.map((c) => {
        const total    = c.requirements.length;
        const received = c.requirements.filter((r) => r.status === 'RECEIVED').length;
        const missing  = c.requirements.filter((r) => r.status === 'MISSING').length;
        const agreement = Number(c.agreementAmount) || 0;
        const paid      = Number(c.amountPaid)      || 0;
        return [
          c.id, c.lead?.fullName, c.caseType?.name,
          c.currentStage, c.status, c.caseManager?.name,
          agreement, paid, agreement - paid,
          total, received, missing,
          c.openedAt.toISOString(),
          c.submittedAt?.toISOString() || '',
          c.closedAt?.toISOString() || '',
        ];
      })
    );
    sendCsv(res, `cases_${today()}.csv`, csv);
  })
);

function today() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = router;
