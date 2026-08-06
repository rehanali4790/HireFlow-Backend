# Deploy HireFlow Backend to Railway

## Prerequisites

- [Railway](https://railway.app) account
- GitHub repo connected (or deploy via Railway CLI)

## Quick Deploy

1. **Create a new Railway project** and add a **PostgreSQL** database.
2. **Create a new service** from your `HireFlow-Backend` repo (or subdirectory if monorepo).
3. **Link the Postgres plugin** to the backend service — Railway injects `DATABASE_URL` automatically.

   In the backend service **Variables** tab, add:

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |

   Replace `Postgres` with your database service name if different. Use the **internal** URL (`postgres.railway.internal`) — do not paste the public proxy URL unless you also set `DB_SSL=true`.

4. **Set environment variables** in the Railway dashboard:

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `production` |
| `JWT_SECRET` | Yes | Strong random secret |
| `CORS_ORIGIN` | Yes | Frontend URL(s), comma-separated |
| `APP_URL` | Yes | Primary frontend URL |
| `OPENAI_API_KEY` | No | For AI resume scoring & interviews |
| `SMTP_HOST` | No | Email notifications |
| `SMTP_PORT` | No | |
| `SMTP_USER` | No | |
| `SMTP_PASSWORD` | No | |
| `SUPER_ADMIN_EMAIL` | No | Platform super admin login |
| `SUPER_ADMIN_PASSWORD` | No | |

`DATABASE_URL`, `PORT`, and `RAILWAY_ENVIRONMENT` are set automatically by Railway when Postgres is linked.

> **Troubleshooting:** If you see `Database initialization failed` with an empty message, the backend service likely does not have `DATABASE_URL` set. Link Postgres or add `DATABASE_URL=${{Postgres.DATABASE_URL}}` manually.

5. **Deploy** — Railway runs `npm install` then `npm start`.

On first boot the server will:
- Connect to Postgres over SSL
- Create base tables from `database/schema.sql` if missing
- Apply all incremental migrations
- Start listening on `0.0.0.0:$PORT`

6. **Verify** — open `https://<your-service>.up.railway.app/api/health`

## Optional: Seed Demo Data

Run once from Railway shell or locally with production `DATABASE_URL`:

```bash
npm run db:seed
```

Demo login: `demo@hireflow.com` / `demo123`

## Frontend Configuration

Point the WebApp at your Railway backend:

```env
VITE_API_URL=https://<your-service>.up.railway.app/api
```

## File Uploads

Railway uses an **ephemeral filesystem**. Uploaded files (resumes, profile pictures, interview videos) are lost on redeploy. For production, plan to use object storage (e.g. S3, Cloudflare R2) — not included in this setup.

## Health Check

Railway uses `GET /api/health` (configured in `railway.toml`). The endpoint returns `503` if the database is unreachable.

## Local vs Railway

| | Local | Railway |
|---|-------|---------|
| Database | `DB_*` env vars | `DATABASE_URL` (auto) |
| SSL | Off by default | On automatically |
| Port | `3001` | `$PORT` (dynamic) |
| Bind address | `0.0.0.0` | `0.0.0.0` |
| Migrations | On server start | On server start |

## CLI Deploy

```bash
npm i -g @railway/cli
railway login
railway init
railway add --database postgres
railway up
```

Set variables with `railway variables set JWT_SECRET=... CORS_ORIGIN=...`
