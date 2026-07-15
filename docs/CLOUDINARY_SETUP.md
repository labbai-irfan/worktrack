# Cloudinary Setup

WorkTrack stores images/videos/documents in Cloudinary; MongoDB keeps **metadata only** (`publicId`, `secureUrl`, size, labels). Until Cloudinary is configured, upload endpoints return a clear `503 UPLOADS_DISABLED` and the rest of the app works normally.

1. **Create an account** at https://cloudinary.com (free plan is fine for development).
2. Open the **Dashboard** and copy: **Cloud name**, **API key**, **API secret**.
3. Add them to `backend/.env`:

   ```
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   CLOUDINARY_FOLDER=worktrack
   ```

   The API secret stays on the backend only — it is never sent to the browser.
4. **Allowed formats & limits** are enforced by the backend before upload: images (jpeg/png/webp/gif/svg) ≤ `MAX_IMAGE_SIZE_MB` (10), videos (mp4/webm/mov) ≤ `MAX_VIDEO_SIZE_MB` (100), documents (pdf/doc/xls/txt/csv/zip) ≤ `MAX_DOCUMENT_SIZE_MB` (25).
5. **Folder organization** — all assets live in the dedicated `CLOUDINARY_FOLDER` root (default `worktrack`), grouped by the uploading employee's name:

   ```
   worktrack/organizations/{organizationId}/employees/{employee-name}/{year}/{month}
   ```

   e.g. `worktrack/organizations/665f…/employees/priya-sharma/2026/07/xyz.png`

6. **Transformations** — images are uploaded with `quality: auto:good` and `fetch_format: auto`, preserving screenshot legibility while letting Cloudinary serve WebP/AVIF automatically. The stored `secureUrl` supports on-the-fly transformations (e.g. insert `w_400,c_limit` for thumbnails).
7. **Signed uploads** — two secure paths, no unsigned uploads:
   - `POST /api/v1/attachments/upload` — multipart through the API; the server signs and streams to Cloudinary.
   - `POST /api/v1/attachments/sign` — returns a short-lived signature (`cloudName`, `apiKey`, `folder`, `timestamp`, `signature`) for client-direct uploads.
8. **Test an upload** — sign in, open *Add Work Update*, pick a project, and drag an image in. Verify it appears in your Cloudinary Media Library under the folder above.
9. **Test deletion** — remove the attachment; the API authorizes, soft-deletes the metadata, then destroys the Cloudinary asset. If DB persistence fails mid-upload, the uploaded asset is rolled back automatically.
10. **Free-plan considerations** — the free tier includes ~25 monthly credits (storage/bandwidth/transformations combined). Screenshot-heavy teams should watch the dashboard usage meter; `quality:auto` + lazy loading keeps bandwidth low. Upgrade or tighten `MAX_*_SIZE_MB` limits as needed.
