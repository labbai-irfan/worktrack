# Backup & Recovery

## MongoDB Atlas

- **Cloud backups** (M10+): enable snapshot backups (daily minimum) and **point-in-time recovery** for production; test restores to a staging cluster quarterly.
- **Manual exports** (any tier):

  ```bash
  mongodump --uri "$MONGODB_URI" --archive=worktrack-$(date +%F).gz --gzip
  mongorestore --uri "$TARGET_URI" --archive=worktrack-2026-07-10.gz --gzip --drop
  ```

- Restore order does not matter (no cross-collection transactions required at rest), but restore the **whole database** — counters must stay consistent with numbered documents (tasks/issues/updates).

## Cloudinary assets

- MongoDB stores only metadata; the binaries live in Cloudinary. For DR, either enable the Cloudinary backup add-on or periodically export assets via the Admin API using the stored `publicId`s.
- After restoring MongoDB to a point in time, attachments deleted after that point will 404 at Cloudinary (asset destroyed) — the soft-deleted metadata makes these auditable.

## Retention guidance

- Database snapshots: 7 daily + 4 weekly + 6 monthly (adjust to compliance needs).
- Audit logs are immutable in the app; export them on your retention schedule before any pruning.
- Data export for a single organization: filter every collection by `organizationId` (all tenant collections carry it).

## Disaster-recovery checklist

1. Provision a new cluster; restore the latest snapshot / PITR target.
2. Point `MONGODB_URI` at the restored cluster; restart the backend (health check `GET /health`).
3. Verify login, one project page, one work update with attachments (Cloudinary reachability).
4. Rotate `JWT_*` secrets **only if compromise is suspected** (this signs everyone out).
5. Re-enable backups on the new cluster and record the incident timeline.
