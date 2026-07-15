# MongoDB Atlas Setup

1. **Create an account** at https://www.mongodb.com/cloud/atlas (free tier is enough for development).
2. **Create a project** (e.g. `WorkTrack`).
3. **Create a cluster** — the free `M0` shared cluster works for development; pick a region close to your backend host.
4. **Create a database user**: *Database Access → Add New Database User* — username + strong password, role **Read and write to any database** (or scope to the `worktrack` database).
5. **Network access**: *Network Access → Add IP Address*. For local development add your current IP (or `0.0.0.0/0` temporarily — never for production). For production add your backend host's egress IPs.
6. **Get the connection string**: *Clusters → Connect → Drivers* — copy the `mongodb+srv://...` URI.
7. **Replace the placeholders** and add a database name:

   ```
   mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/worktrack?retryWrites=true&w=majority
   ```

   URL-encode special characters in the password.
8. **Set `MONGODB_URI`** in `backend/.env`. Never commit this file.
9. **Test the connection**: `npm run dev:backend` — you should see `MongoDB connected` in the logs; then `npm run seed` to load demo data.
10. **Indexes** are declared in the Mongoose schemas and created automatically (`autoIndex: true`). For very large production datasets, create them manually during a maintenance window and disable autoIndex.
11. **Backups (production)**: M10+ clusters include continuous cloud backups — enable them and configure point-in-time recovery (see [BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md)).
12. **Monitoring**: enable Atlas alerts for connections, replication lag, and disk usage; the Performance Advisor suggests missing indexes from real query patterns.
13. **Atlas Search (optional)**: the app ships with a portable regex/text-index search fallback (`backend/src/features/search/search.routes.ts`). To upgrade, create Atlas Search indexes on `projects`, `tasks`, `workupdates`, and `issues` and replace the per-collection `find` queries with `$search` aggregations in that one file.
