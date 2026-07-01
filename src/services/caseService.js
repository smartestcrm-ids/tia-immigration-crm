const prisma = require('../db');
const { checklistForCaseType, CASE_STAGES, STAGE_BY_CODE, nextStageAfter } = require('../caseTemplates');

/**
 * Get (or create if missing) the Case for a Lead. Called when a Lead's status
 * transitions to CONVERTED. Idempotent — safe to call multiple times.
 */
async function ensureCaseForLead(leadId) {
  const existing = await prisma.case.findUnique({ where: { leadId } });
  if (existing) return existing;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { caseType: true },
  });
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  // Create the case with default stage and copy caseType from the lead.
  const newCase = await prisma.case.create({
    data: {
      leadId,
      caseTypeId: lead.caseTypeId,
      currentStage: 'SIGNED',
      status: 'ACTIVE',
      caseManagerId: lead.assignedToId, // default: same as the lead's assignee
    },
  });

  // Seed the default document checklist for this case type.
  const checklist = checklistForCaseType(lead.caseType ? lead.caseType.name : null);
  if (checklist.length) {
    await prisma.documentRequirement.createMany({
      data: checklist.map((item) => ({
        caseId: newCase.id,
        name: item.name,
        category: item.category,
        status: 'PENDING',
      })),
    });
  }

  // Record the SIGNED stage as completed (that's what "CONVERTED" means).
  await prisma.caseStageEvent.create({
    data: {
      caseId: newCase.id,
      stage: 'SIGNED',
      status: 'COMPLETED',
      notes: 'Auto-recorded when lead was converted.',
    },
  });

  return newCase;
}

/**
 * Advance a case to the next stage (or a specific target stage). Records
 * a CaseStageEvent for the newly-completed stage.
 */
async function advanceCase({ caseId, toStage, completedById, notes }) {
  const current = await prisma.case.findUnique({ where: { id: caseId } });
  if (!current) throw new Error(`Case ${caseId} not found`);

  const target = toStage || (nextStageAfter(current.currentStage)?.code);
  if (!target || !STAGE_BY_CODE[target]) {
    throw new Error(`No next stage from "${current.currentStage}"`);
  }

  // Record the current stage as completed (unless we're already past it).
  await prisma.caseStageEvent.create({
    data: {
      caseId,
      stage: current.currentStage,
      status: 'COMPLETED',
      completedById: completedById || null,
      notes: notes || null,
    },
  });

  // Move forward.
  const patch = { currentStage: target };
  if (target === 'SUBMITTED') patch.submittedAt = new Date();
  if (target === 'DECISION_RECEIVED') { patch.status = 'CLOSED'; patch.closedAt = new Date(); }

  return prisma.case.update({ where: { id: caseId }, data: patch });
}

module.exports = {
  CASE_STAGES,
  ensureCaseForLead,
  advanceCase,
};
