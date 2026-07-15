/* Attachment upload, gallery, and before/after comparison components. */
import { useCallback, useRef, useState } from 'react';
import { UploadCloud, X, FileText, Film, Download, ImageOff } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { cn, fmtBytes } from '@/lib/utils';
import { Badge, Select, Spinner } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import type { Attachment } from '@/types';

/* ---------- Uploader ---------- */
interface UploaderProps {
  projectId?: string;
  moduleId?: string;
  attachments: Attachment[];
  onChange: (attachments: Attachment[]) => void;
  maxFiles?: number;
}

interface PendingFile {
  id: number;
  name: string;
  progress: number;
  error?: string;
}

let pendingId = 1;

export function AttachmentUploader({ projectId, moduleId, attachments, onChange, maxFiles = 20 }: UploaderProps) {
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const room = maxFiles - attachments.length - pending.length;
      const batch = files.slice(0, Math.max(0, room));
      for (const file of batch) {
        const id = pendingId++;
        setPending((p) => [...p, { id, name: file.name, progress: 0 }]);
        const form = new FormData();
        form.append('file', file);
        if (projectId) form.append('projectId', projectId);
        if (moduleId) form.append('moduleId', moduleId);
        try {
          const res = await api.post('/attachments/upload', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (e) => {
              const progress = e.total ? Math.round((e.loaded / e.total) * 100) : 50;
              setPending((p) => p.map((f) => (f.id === id ? { ...f, progress } : f)));
            },
          });
          onChange([...attachments, res.data.data as Attachment]);
          setPending((p) => p.filter((f) => f.id !== id));
        } catch (err) {
          const message = errorMessage(err);
          setPending((p) => p.map((f) => (f.id === id ? { ...f, error: message } : f)));
          toast.error(message);
        }
      }
    },
    [attachments, pending.length, projectId, moduleId, onChange, maxFiles]
  );

  async function removeAttachment(att: Attachment) {
    try {
      await api.delete(`/attachments/${att._id}`);
    } catch {
      /* soft-deleted server side or already gone */
    }
    onChange(attachments.filter((a) => a._id !== att._id));
  }

  async function updateType(att: Attachment, attachmentType: string) {
    try {
      await api.patch(`/attachments/${att._id}`, { attachmentType });
      onChange(attachments.map((a) => (a._id === att._id ? { ...a, attachmentType } : a)));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          uploadFiles(Array.from(e.dataTransfer.files));
        }}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files);
          if (files.length) uploadFiles(files);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer text-center transition-colors',
          dragOver ? 'border-primary-500 bg-primary-500/5' : 'border-line hover:border-ink-faint'
        )}
      >
        <UploadCloud className="h-5 w-5 text-ink-faint" />
        <p className="text-xs text-ink-muted">
          <span className="font-medium text-primary-600">Click to upload</span>, drag & drop, or paste a screenshot
        </p>
        <p className="text-2xs text-ink-faint">Images up to 10 MB · videos up to 100 MB · documents up to 25 MB</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
          onChange={(e) => {
            uploadFiles(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
      </div>

      {pending.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {pending.map((f) => (
            <div key={f.id} className="flex items-center gap-2 text-2xs bg-surface-sunken rounded px-2 py-1.5">
              {f.error ? <X className="h-3.5 w-3.5 text-error-main" /> : <Spinner className="h-3.5 w-3.5" />}
              <span className="grow truncate">{f.name}</span>
              {f.error ? (
                <button className="text-error-main hover:underline" onClick={() => setPending((p) => p.filter((x) => x.id !== f.id))}>
                  {f.error.slice(0, 40)} — dismiss
                </button>
              ) : (
                <span>{f.progress}%</span>
              )}
            </div>
          ))}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {attachments.map((att) => (
            <div key={att._id} className="relative group border border-line rounded-md overflow-hidden bg-surface-sunken">
              {att.resourceType === 'image' ? (
                <img src={att.secureUrl} alt={att.altText || att.originalFilename} className="h-24 w-full object-cover" loading="lazy" />
              ) : (
                <div className="h-24 flex flex-col items-center justify-center gap-1 text-ink-faint">
                  {att.resourceType === 'video' ? <Film className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                  <span className="text-2xs px-2 truncate max-w-full">{att.originalFilename}</span>
                </div>
              )}
              <div className="p-1.5 flex items-center gap-1">
                <Select
                  value={att.attachmentType}
                  onChange={(e) => updateType(att, e.target.value)}
                  className="!h-6 !py-0 !px-1.5 !text-2xs grow"
                  aria-label="Attachment label"
                >
                  {['screenshot', 'before', 'after', 'evidence', 'error', 'document', 'recording', 'other'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
                <button type="button" onClick={() => removeAttachment(att)} className="p-1 text-ink-faint hover:text-error-main" aria-label={`Remove ${att.originalFilename}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Gallery (read-only) ---------- */
export function AttachmentGallery({ attachments }: { attachments: Attachment[] }) {
  const [preview, setPreview] = useState<Attachment | null>(null);
  if (attachments.length === 0) return null;
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        {attachments.map((att) => (
          <figure key={att._id} className="border border-line rounded-md overflow-hidden bg-surface-sunken">
            {att.resourceType === 'image' ? (
              <button type="button" onClick={() => setPreview(att)} className="block w-full" aria-label={`Preview ${att.originalFilename}`}>
                <img src={att.secureUrl} alt={att.altText || att.originalFilename} className="h-28 w-full object-cover hover:opacity-90" loading="lazy" />
              </button>
            ) : (
              <a href={att.secureUrl} target="_blank" rel="noreferrer" className="h-28 flex flex-col items-center justify-center gap-1 text-ink-faint hover:text-ink">
                {att.resourceType === 'video' ? <Film className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                <span className="text-2xs px-2 truncate max-w-full">{att.originalFilename}</span>
              </a>
            )}
            <figcaption className="px-2 py-1 flex items-center justify-between gap-1">
              <Badge tone={att.attachmentType === 'before' ? 'warning' : att.attachmentType === 'after' ? 'success' : att.attachmentType === 'error' ? 'danger' : 'neutral'}>
                {att.attachmentType}
              </Badge>
              <span className="text-2xs text-ink-faint">{fmtBytes(att.bytes)}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      {preview && (
        <div className="fixed inset-0 z-[90] bg-black/85 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Image preview" onClick={() => setPreview(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" aria-label="Close preview" onClick={() => setPreview(null)}>
            <X className="h-6 w-6" />
          </button>
          <img src={preview.secureUrl} alt={preview.altText || preview.originalFilename} className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
          <a
            href={preview.secureUrl}
            download
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-5 right-5 text-white/80 hover:text-white"
            aria-label="Download"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-5 w-5" />
          </a>
          {preview.caption && <p className="absolute bottom-5 left-5 text-white/90 text-xs">{preview.caption}</p>}
        </div>
      )}
    </>
  );
}

/* ---------- Before / After comparison slider ---------- */
export function BeforeAfterSlider({ before, after, caption }: { before?: Attachment; after?: Attachment; caption?: string }) {
  const [pos, setPos] = useState(50);
  if (!before || !after) {
    return (
      <div className="flex items-center gap-2 text-2xs text-ink-faint border border-dashed border-line rounded-md p-4">
        <ImageOff className="h-4 w-4" /> Comparison images unavailable.
      </div>
    );
  }
  return (
    <figure className="space-y-1.5">
      <div className="relative w-full overflow-hidden rounded-lg border border-line select-none" style={{ aspectRatio: `${after.width && after.height ? `${after.width}/${after.height}` : '16/9'}` }}>
        <img src={after.secureUrl} alt={after.altText || 'After'} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
          <img
            src={before.secureUrl}
            alt={before.altText || 'Before'}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ width: `${10000 / pos}%`, maxWidth: 'none' }}
            loading="lazy"
          />
        </div>
        <div className="absolute inset-y-0" style={{ left: `${pos}%` }}>
          <div className="absolute inset-y-0 -left-px w-0.5 bg-white shadow" />
          <div className="absolute top-1/2 -translate-y-1/2 -left-3 h-6 w-6 rounded-full bg-white shadow flex items-center justify-center text-[10px] font-bold text-slate-600">⇔</div>
        </div>
        <span className="absolute left-2 top-2 text-2xs font-semibold bg-black/60 text-white rounded px-1.5 py-0.5">Before</span>
        <span className="absolute right-2 top-2 text-2xs font-semibold bg-black/60 text-white rounded px-1.5 py-0.5">After</span>
        <input
          type="range"
          min={2}
          max={98}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
          aria-label="Comparison slider"
        />
      </div>
      {caption && <figcaption className="text-2xs text-ink-muted">{caption}</figcaption>}
    </figure>
  );
}
