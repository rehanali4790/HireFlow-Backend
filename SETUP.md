# HireFlow Backend Setup Guide

## Quick Start (5 minutes)

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE hireflow_db;

# Exit
\q
```

### 3. Configure Environment

Create `.env` file:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hireflow_db
DB_USER=postgres
DB_PASSWORD=your_password

# Database Sync (set to true for auto-create tables)
DB_SYNC=true

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_NAME=HireFlow
SMTP_FROM_EMAIL=your_email@gmail.com

# OpenAI
OPENAI_API_KEY=sk-your-key

# Application
APP_URL=http://localhost:3000
TOKEN_SECRET=change-this-to-random-string
PORT=3001
NODE_ENV=development
```

### 4. Check Database Connection

```bash
npm run db:check
```

You should see:
```
✅ Database connection successful!
📊 Existing tables:
   No tables found. Set DB_SYNC=true to auto-create tables.
```

### 5. Start the Server

```bash
npm run start:dev
```

With `DB_SYNC=true`, TypeORM will automatically create all tables on startup!

### 6. Seed Demo Data (Optional)

```bash
npm run db:seed
```

This creates a demo account:
- Email: `demo@hireflow.com`
- Password: `demo123`

## ✅ Verification

1. **Health Check**: http://localhost:3001/api/health
2. **Check Tables**: Run `npm run db:check` again - you should see tables listed

## 🎯 How It Works

### Auto-Sync Mode (Development)

When `DB_SYNC=true`:
- TypeORM reads your entity files
- Automatically creates/updates tables
- Perfect for development
- ⚠️ **Never use in production!**

### Manual Mode (Production)

When `DB_SYNC=false`:
- Tables must exist already
- Use migrations for schema changes
- Safe for production

## 📊 Database Schema

The following tables will be created automatically:

- `employers` - Company accounts
- `jobs` - Job postings
- `candidates` - Candidate profiles
- `applications` - Job applications

## 🐛 Troubleshooting

### "Database connection failed"

```bash
# Check PostgreSQL is running
psql -U postgres -l

# Windows: Start PostgreSQL service
# Mac: brew services start postgresql
# Linux: sudo systemctl start postgresql
```

### "Tables not created"

1. Check `DB_SYNC=true` in `.env`
2. Restart the server
3. Check console for errors

### "Port 3001 already in use"

Change `PORT=3002` in `.env`

## 🚀 Next Steps

1. ✅ Backend is running
2. ✅ Tables are created
3. ✅ Demo data seeded
4. 📝 Start the frontend
5. 📝 Create your first job posting

## 📚 Commands

```bash
# Development
npm run start:dev      # Start with hot reload

# Database
npm run db:check       # Check connection and tables
npm run db:seed        # Seed demo data

# Production
npm run build          # Build
npm run start:prod     # Start production server

# Testing
npm run test           # Run tests
npm run lint           # Lint code
```

## 🔒 Security Notes

1. Change `TOKEN_SECRET` to a random string
2. Use strong database password
3. Set `DB_SYNC=false` in production
4. Use environment variables for secrets

---

**Need help?** Check the main [README.md](./README.md) for detailed documentation.
