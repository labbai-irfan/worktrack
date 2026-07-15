import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ok, created } from '../../utils/respond';
import { getPagination, pageMeta } from '../../utils/pagination';
import { orgScope } from '../../middlewares/auth';
import { WorkUpdate } from '../../models/WorkUpdate';
import { Project } from '../../models/Project';
import { Organization } from '../../models/Organization';
import { Attachment } from '../../models/Attachment';
import { nextIdentifier } from '../../utils/counters';
import { audit } from '../../services/audit.service';
import { recordActivity } from '../../services/activity.service';
import { notify } from '../../services/notification.service';
import { emitToOrg } from '../../sockets';

const POPULATE = [
  { path: 'userId', select: 'displayName avatarUrl jobTitle' },
  { path: 'projectId', select: 'name key color managerId' },
  { path: 'moduleId', select: 'name key color' },
  { path: 'taskId', select: 'number title' },
  { path: 'issueId', select: 'number title' },
  { path: 'attachmentIds' },
  { path: 'review.reviewerId', select: 'displayName avatarUrl' },
];

function canSeeAllUpdates(req: Request): boolean {
  return req.user!.permissions.includes('work_update.view_team') || req.user!.isSuperAdmin;
}

export async function list(req: Request, res: Response) {
  const scope = orgScope(req);
  const { page, limit, skip, sort } = getPagination(req, '-workDate');
  const filter: Record<string, unknown> = { ...scope, deletedAt: null };

  if (!canSeeAllUpdates(req)) {
    // Employees see their own updates; drafts are always private to the author.
    filter.userId = req.user!._id;
  } else if (req.query.userId) {
    filter.userId = req.query.userId === 'me' ? req.user!._id : req.query.userId;
  }
  if (req.query.projectId) filter.projectId = req.query.projectId;
  if (req.query.moduleId) filter.moduleId = req.query.moduleId;
  if (req.query.taskId) filter.taskId = req.query.taskId;
  if (req.query.status) filter.status = { $in: String(req.query.status).split(',') };
  if (req.query.workType) filter.workType = { $in: String(req.query.workType).split(',') };
  if (req.query.from || req.query.to) {
    const range: Record<string, Date> = {};
    if (req.query.from) range.$gte = new Date(String(req.query.from));
    if (req.query.to) range.$lte = new Date(String(req.query.to));
    filter.workDate = range;
  }
  if (req.query.q) {
    filter.$or = [
      { title: { $regex: String(req.query.q), $options: 'i' } },
      { number: { $regex: String(req.query.q), $options: 'i' } },
    ];
  }
  // Never expose other people's drafts, even to reviewers.
  if (canSeeAllUpdates(req) && String(filter.userId ?? '') !== req.user!.id) {
    filter.$and = [{ $or: [{ status: { $ne: 'draft' } }, { userId: req.user!._id }] }];
  }

  const [items, total] = await Promise.all([
    WorkUpdate.find(filter).sort(sort).skip(skip).limit(limit).populate(POPULATE).lean(),
    WorkUpdate.countDocuments(filter),
  ]);
  return ok(res, items, 'OK', pageMeta(page, limit, total));
}

export async function get(req: Request, res: Response) {
  const scope = orgScope(req);
  const update = await WorkUpdate.findOne({ _id: req.params.id, ...scope, deletedAt: null })
    .populate(POPULATE)
    .populate('watcherIds', 'displayName avatarUrl')
    .lean();
  if (!update) throw ApiError.notFound('Work update not found.');
  const authorId = String((update.userId as { _id?: unknown })?._id ?? update.userId);
  const isAuthor = authorId === req.user!.id;
  if (!isAuthor && !canSeeAllUpdates(req)) throw ApiError.forbidden();
  if (update.status === 'draft' && !isAuthor) throw ApiError.forbidden('Drafts are private to their author.');
  return ok(res, update);
}

export async function create(req: Request, res: Response) {
  const scope = orgScope(req);
  const project = await Project.findOne({ _id: req.body.projectId, ...scope }).lean();
  if (!project) throw ApiError.badRequest('Invalid project.');

  const number = await nextIdentifier(scope.organizationId, 'work_update', 'UPD');
  const update = await WorkUpdate.create({
    ...scope,
    ...req.body,
    number,
    userId: req.user!._id,
    createdBy: req.user!._id,
    status: 'draft',
  });

  if (req.body.attachmentIds?.length) {
    await Attachment.updateMany(
      { _id: { $in: req.body.attachmentIds }, ...scope, uploadedBy: req.user!._id },
      { entityType: 'work_update', entityId: update._id, projectId: update.projectId, moduleId: update.moduleId }
    );
  }

  audit({ req, action: 'work_update.create', entityType: 'work_update', entityId: update._id, newData: { number, title: update.title } });
  const populated = await WorkUpdate.findById(update._id).populate(POPULATE).lean();
  return created(res, populated, 'Work update saved as draft.');
}

export async function update(req: Request, res: Response) {
  const scope = orgScope(req);
  const doc = await WorkUpdate.findOne({ _id: req.params.id, ...scope, deletedAt: null });
  if (!doc) throw ApiError.notFound('Work update not found.');
  const isAuthor = String(doc.userId) === req.user!.id;
  if (!isAuthor) throw ApiError.forbidden('Only the author can edit a work update.');
  if (!['draft', 'changes_requested'].includes(doc.status)) {
    throw ApiError.badRequest('Only drafts or updates with requested changes can be edited.');
  }

  Object.assign(doc, req.body, { updatedBy: req.user!._id, editCount: doc.editCount + 1 });
  await doc.save();

  if (req.body.attachmentIds) {
    await Attachment.updateMany(
      { _id: { $in: req.body.attachmentIds }, ...scope, uploadedBy: req.user!._id },
      { entityType: 'work_update', entityId: doc._id, projectId: doc.projectId, moduleId: doc.moduleId }
    );
  }
  const populated = await WorkUpdate.findById(doc._id).populate(POPULATE).lean();
  return ok(res, populated, 'Work update saved.');
}

/** POST /work-updates/:id/submit */
export async function submit(req: Request, res: Response) {
  const scope = orgScope(req);
  const doc = await WorkUpdate.findOne({ _id: req.params.id, ...scope, deletedAt: null });
  if (!doc) throw ApiError.notFound('Work update not found.');
  if (String(doc.userId) !== req.user!.id) throw ApiError.forbidden();
  if (!['draft', 'changes_requested'].includes(doc.status)) throw ApiError.badRequest('This update has already been submitted.');

  const resubmission = doc.status === 'changes_requested';
  doc.status = 'submitted';
  doc.submittedAt = new Date();
  doc.reviewHistory.push({ action: resubmission ? 'resubmitted' : 'submitted', byId: req.user!._id, comment: '', at: new Date() });
  await doc.save();

  const project = await Project.findById(doc.projectId).lean();
  if (project?.managerId && String(project.managerId) !== req.user!.id) {
    await notify({
      organizationId: scope.organizationId, userId: project.managerId, actorId: req.user!.id,
      type: 'work_submitted',
      title: `${req.user!.displayName} ${resubmission ? 'resubmitted' : 'submitted'} ${doc.number}`,
      body: doc.title, entityType: 'work_update', entityId: doc._id, link: `/work-updates/${doc._id}`,
    });
  }
  recordActivity({
    organizationId: scope.organizationId, projectId: doc.projectId, actorId: req.user!.id,
    action: resubmission ? 'work_update.resubmitted' : 'work_update.submitted',
    entityType: 'work_update', entityId: doc._id, entityLabel: `${doc.number} ${doc.title}`,
    link: `/work-updates/${doc._id}`,
  });
  emitToOrg(String(scope.organizationId), 'work_update:status', { id: String(doc._id), status: doc.status });
  return ok(res, doc.toObject(), resubmission ? 'Update resubmitted for review.' : 'Update submitted for review.');
}

/** POST /work-updates/:id/review — approve | request_changes | reject | start_review */
export async function review(req: Request, res: Response) {
  const scope = orgScope(req);
  const { action, comment } = req.body as { action: 'start_review' | 'approve' | 'request_changes' | 'reject'; comment?: string };
  const doc = await WorkUpdate.findOne({ _id: req.params.id, ...scope, deletedAt: null });
  if (!doc) throw ApiError.notFound('Work update not found.');

  const isAuthor = String(doc.userId) === req.user!.id;
  if (isAuthor) {
    const org = await Organization.findById(scope.organizationId).lean();
    if (!org?.settings?.allowSelfApproval) {
      throw ApiError.forbidden('You cannot review your own work update.');
    }
  }
  if (action === 'approve' && !req.user!.permissions.includes('work_update.approve') && !req.user!.isSuperAdmin) {
    throw ApiError.forbidden('You do not have approval permission.');
  }

  const transitions: Record<string, { from: string[]; to: string; event: 'review_started' | 'approved' | 'changes_requested' | 'rejected'; notif: string }> = {
    start_review: { from: ['submitted'], to: 'under_review', event: 'review_started', notif: '' },
    approve: { from: ['submitted', 'under_review'], to: 'approved', event: 'approved', notif: 'work_approved' },
    request_changes: { from: ['submitted', 'under_review'], to: 'changes_requested', event: 'changes_requested', notif: 'work_changes_requested' },
    reject: { from: ['submitted', 'under_review'], to: 'rejected', event: 'rejected', notif: 'work_rejected' },
  };
  const t = transitions[action];
  if (!t.from.includes(doc.status)) {
    throw ApiError.badRequest(`Cannot ${action.replace('_', ' ')} an update in "${doc.status}" state.`);
  }
  if ((action === 'request_changes' || action === 'reject') && !comment?.trim()) {
    throw ApiError.validation([{ field: 'comment', message: 'A reason is required when requesting changes or rejecting.' }]);
  }

  doc.status = t.to as typeof doc.status;
  doc.review = {
    reviewerId: req.user!._id,
    comment: comment ?? '',
    reviewedAt: new Date(),
    approvedAt: action === 'approve' ? new Date() : null,
  };
  doc.reviewHistory.push({ action: t.event, byId: req.user!._id, comment: comment ?? '', at: new Date() });
  await doc.save();

  if (t.notif) {
    await notify({
      organizationId: scope.organizationId, userId: doc.userId, actorId: req.user!.id,
      type: t.notif,
      title: `${doc.number} ${t.to === 'approved' ? 'was approved' : t.to === 'rejected' ? 'was rejected' : 'needs changes'}`,
      body: comment ?? doc.title, entityType: 'work_update', entityId: doc._id, link: `/work-updates/${doc._id}`,
    });
  }
  recordActivity({
    organizationId: scope.organizationId, projectId: doc.projectId, actorId: req.user!.id,
    action: `work_update.${t.event}`, entityType: 'work_update', entityId: doc._id,
    entityLabel: `${doc.number} ${doc.title}`, newValue: t.to, link: `/work-updates/${doc._id}`,
  });
  audit({ req, action: `work_update.${t.event}`, entityType: 'work_update', entityId: doc._id, metadata: { comment } });
  emitToOrg(String(scope.organizationId), 'work_update:status', { id: String(doc._id), status: doc.status });
  const populated = await WorkUpdate.findById(doc._id).populate(POPULATE).lean();
  return ok(res, populated, `Update ${t.to.replace(/_/g, ' ')}.`);
}

/** GET /work-updates/pending-reviews */
export async function pendingReviews(req: Request, res: Response) {
  const scope = orgScope(req);
  const { page, limit, skip } = getPagination(req, '-submittedAt');
  const filter = { ...scope, status: { $in: ['submitted', 'under_review'] }, userId: { $ne: req.user!._id }, deletedAt: null };
  const [items, total] = await Promise.all([
    WorkUpdate.find(filter).sort({ submittedAt: 1 }).skip(skip).limit(limit).populate(POPULATE).lean(),
    WorkUpdate.countDocuments(filter),
  ]);
  return ok(res, items, 'OK', pageMeta(page, limit, total));
}

export async function remove(req: Request, res: Response) {
  const scope = orgScope(req);
  const doc = await WorkUpdate.findOne({ _id: req.params.id, ...scope, deletedAt: null });
  if (!doc) throw ApiError.notFound('Work update not found.');
  const isAuthor = String(doc.userId) === req.user!.id;
  if (!isAuthor && !req.user!.permissions.includes('work_update.approve')) throw ApiError.forbidden();
  if (isAuthor && doc.status !== 'draft' && !req.user!.permissions.includes('work_update.approve')) {
    throw ApiError.badRequest('Submitted updates cannot be deleted. Ask a manager to archive it.');
  }
  doc.deletedAt = new Date();
  await doc.save();
  audit({ req, action: 'work_update.delete', entityType: 'work_update', entityId: doc._id, previousData: { number: doc.number, title: doc.title } });
  return ok(res, null, 'Work update deleted.');
}
