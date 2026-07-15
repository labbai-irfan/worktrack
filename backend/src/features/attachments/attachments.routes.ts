import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { authenticate, orgScope } from '../../middlewares/auth';
import { ok, created } from '../../utils/respond';
import { ApiError } from '../../utils/ApiError';
import { Attachment } from '../../models/Attachment';
import { cloudinary, cloudinaryEnabled } from '../../config/cloudinary';
import { env } from '../../config/env';
import { audit } from '../../services/audit.service';
import { ATTACHMENT_TYPES } from '../../constants/enums';

const ALLOWED_MIME: Record<string, 'image' | 'video' | 'raw'> = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image', 'image/gif': 'image', 'image/svg+xml': 'image',
  'video/mp4': 'video', 'video/webm': 'video', 'video/quicktime': 'video',
  'application/pdf': 'raw', 'text/plain': 'raw', 'text/csv': 'raw',
  'application/msword': 'raw',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'raw',
  'application/vnd.ms-excel': 'raw',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'raw',
  'application/zip': 'raw',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_VIDEO_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME[file.mimetype]) return cb(new ApiError(400, `File type "${file.mimetype}" is not allowed.`, 'INVALID_FILE_TYPE'));
    cb(null, true);
  },
});

function sizeLimitFor(resourceType: string): number {
  if (resourceType === 'image') return env.MAX_IMAGE_SIZE_MB * 1024 * 1024;
  if (resourceType === 'video') return env.MAX_VIDEO_SIZE_MB * 1024 * 1024;
  return env.MAX_DOCUMENT_SIZE_MB * 1024 * 1024;
}

function requireCloudinary() {
  if (!cloudinaryEnabled) {
    throw new ApiError(503, 'File uploads are not configured. Add Cloudinary credentials to the backend environment (see docs/CLOUDINARY_SETUP.md).', 'UPLOADS_DISABLED');
  }
}

function slugifyName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'unknown';
}

/**
 * All assets live under the dedicated CLOUDINARY_FOLDER root and are grouped
 * by the uploading employee's name, e.g.
 * worktrack/organizations/<orgId>/employees/priya-sharma/2026/07
 */
function folderFor(organizationId: string, uploaderName: string): string {
  const now = new Date();
  return [
    env.CLOUDINARY_FOLDER,
    'organizations', organizationId,
    'employees', slugifyName(uploaderName),
    String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'),
  ].join('/');
}

/** POST /attachments/upload — multipart upload through the API (signed server-side). */
async function uploadFile(req: Request, res: Response) {
  requireCloudinary();
  const scope = orgScope(req);
  const file = req.file;
  if (!file) throw ApiError.badRequest('No file provided.');
  const resourceType = ALLOWED_MIME[file.mimetype];
  if (file.size > sizeLimitFor(resourceType)) {
    throw ApiError.badRequest(`File exceeds the maximum size for ${resourceType} uploads.`);
  }

  const folder = folderFor(String(scope.organizationId), req.user!.displayName);
  const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType === 'raw' ? 'raw' : resourceType,
        // Automatic quality/format for images; keep useful screenshot quality.
        ...(resourceType === 'image' ? { quality: 'auto:good', fetch_format: 'auto' } : {}),
      },
      (error, uploadResult) => (error || !uploadResult ? reject(error ?? new Error('Upload failed')) : resolve(uploadResult as unknown as Record<string, unknown>))
    );
    stream.end(file.buffer);
  });

  try {
    const attachment = await Attachment.create({
      ...scope,
      projectId: req.body.projectId || null,
      moduleId: req.body.moduleId || null,
      secureUrl: result.secure_url,
      publicId: result.public_id,
      resourceType,
      format: result.format ?? file.originalname.split('.').pop() ?? '',
      originalFilename: file.originalname,
      bytes: result.bytes ?? file.size,
      width: result.width ?? null,
      height: result.height ?? null,
      duration: result.duration ?? null,
      caption: req.body.caption ?? '',
      altText: req.body.altText ?? '',
      attachmentType: ATTACHMENT_TYPES.includes(req.body.attachmentType) ? req.body.attachmentType : 'screenshot',
      uploadedBy: req.user!._id,
    });
    return created(res, attachment.toObject(), 'File uploaded.');
  } catch (dbError) {
    // Rollback the Cloudinary asset if metadata persistence fails.
    await cloudinary.uploader
      .destroy(String(result.public_id), { resource_type: resourceType === 'raw' ? 'raw' : resourceType })
      .catch(() => undefined);
    throw dbError;
  }
}

/** POST /attachments/sign — signature for secure client-direct uploads. */
async function signUpload(req: Request, res: Response) {
  requireCloudinary();
  const scope = orgScope(req);
  const folder = folderFor(String(scope.organizationId), req.user!.displayName);
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign: Record<string, string | number> = { folder, timestamp };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, env.CLOUDINARY_API_SECRET);
  return ok(res, {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    folder,
    timestamp,
    signature,
  });
}

/** PATCH /attachments/:id — caption/alt/label edits. */
async function updateAttachment(req: Request, res: Response) {
  const scope = orgScope(req);
  const attachment = await Attachment.findOne({ _id: req.params.id, ...scope, deletedAt: null });
  if (!attachment) throw ApiError.notFound('Attachment not found.');
  const canManage = req.user!.permissions.includes('file.manage');
  if (String(attachment.uploadedBy) !== req.user!.id && !canManage) throw ApiError.forbidden();
  for (const key of ['caption', 'altText', 'attachmentType'] as const) {
    if (req.body[key] !== undefined) attachment[key] = req.body[key];
  }
  await attachment.save();
  return ok(res, attachment.toObject(), 'Attachment updated.');
}

/** DELETE /attachments/:id — authorize, then remove from Cloudinary and soft-delete metadata. */
async function removeAttachment(req: Request, res: Response) {
  const scope = orgScope(req);
  const attachment = await Attachment.findOne({ _id: req.params.id, ...scope, deletedAt: null });
  if (!attachment) throw ApiError.notFound('Attachment not found.');
  const canManage = req.user!.permissions.includes('file.manage');
  if (String(attachment.uploadedBy) !== req.user!.id && !canManage) throw ApiError.forbidden();

  attachment.deletedAt = new Date();
  await attachment.save();
  if (cloudinaryEnabled) {
    await cloudinary.uploader
      .destroy(attachment.publicId, { resource_type: attachment.resourceType === 'raw' ? 'raw' : attachment.resourceType })
      .catch(() => undefined); // metadata soft-delete already succeeded; asset cleanup is best-effort
  }
  audit({ req, action: 'file.delete', entityType: 'attachment', entityId: attachment._id, previousData: { publicId: attachment.publicId, filename: attachment.originalFilename } });
  return ok(res, null, 'Attachment deleted.');
}

/** GET /attachments — project file library. */
async function list(req: Request, res: Response) {
  const scope = orgScope(req);
  const filter: Record<string, unknown> = { ...scope, deletedAt: null };
  if (req.query.projectId) filter.projectId = req.query.projectId;
  if (req.query.entityType) filter.entityType = req.query.entityType;
  if (req.query.entityId) filter.entityId = req.query.entityId;
  if (req.query.resourceType) filter.resourceType = req.query.resourceType;
  const items = await Attachment.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('uploadedBy', 'displayName avatarUrl')
    .lean();
  return ok(res, items);
}

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);
const signSchema = z.object({ projectId: objectId.optional(), moduleId: objectId.optional() });
const patchSchema = z.object({
  caption: z.string().max(300).optional(),
  altText: z.string().max(300).optional(),
  attachmentType: z.enum(ATTACHMENT_TYPES).optional(),
});

const router = Router();
router.use(authenticate);
router.get('/', asyncHandler(list));
router.post('/upload', upload.single('file'), asyncHandler(uploadFile));
router.post('/sign', validate(signSchema), asyncHandler(signUpload));
router.patch('/:id', validate(patchSchema), asyncHandler(updateAttachment));
router.delete('/:id', asyncHandler(removeAttachment));

export default router;
