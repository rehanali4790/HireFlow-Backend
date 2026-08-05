# Troubleshooting Guide

Common issues and solutions for HireFlow backend.

## Database Issues

### Connection Failed

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solutions:**

1. **Check PostgreSQL is running**
   ```bash
   # Windows
   Get-Service postgresql*
   
   # Mac
   brew services list
   
   # Linux
   sudo systemctl status postgresql
   ```

2. **Start PostgreSQL**
   ```bash
   # Windows
   Start-Service postgresql-x64-14
   
   # Mac
   brew services start postgresql
   
   # Linux
   sudo systemctl start postgresql
   ```

3. **Verify connection details in `.env`**
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_password
   ```

4. **Test connection manually**
   ```bash
   psql -U postgres -h localhost -p 5432
   ```

---

### Database Does Not Exist

**Error:**
```
Error: database "hireflow_db" does not exist
```

**Solution:**
```bash
psql -U postgres
CREATE DATABASE hireflow_db;
\q
```

---

### Tables Not Created

**Error:**
```
Error: relation "employers" does not exist
```

**Solutions:**

1. **Enable auto-sync in development**
   ```env
   DB_SYNC=true
   ```

2. **Restart the server**
   ```bash
   npm run start:dev
   ```

3. **Check entity registration**
   - Verify entities are listed in `ormconfig.ts`
   - Verify modules import `TypeOrmModule.forFeature([Entity])`

4. **Manually create tables**
   ```bash
   npm run typeorm migration:run
   ```

---

### Migration Issues

**Error:**
```
Error: QueryFailedError: relation already exists
```

**Solution:**
```bash
# Revert last migration
npm run typeorm migration:revert

# Or drop and recreate database
psql -U postgres
DROP DATABASE hireflow_db;
CREATE DATABASE hireflow_db;
\q

# Restart with DB_SYNC=true
npm run start:dev
```

---

## Authentication Issues

### Invalid Token

**Error:**
```
401 Unauthorized: Invalid token
```

**Solutions:**

1. **Check token format**
   ```
   Authorization: Bearer <token>
   ```

2. **Verify token in database**
   ```sql
   SELECT * FROM employers WHERE "authToken" = 'your-token';
   ```

3. **Re-login to get new token**
   ```bash
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123"}'
   ```

---

### Password Not Matching

**Error:**
```
401 Unauthorized: Invalid credentials
```

**Solutions:**

1. **Verify password hashing**
   - Check `TOKEN_SECRET` in `.env` matches what was used during signup

2. **Reset password**
   ```sql
   -- Generate new hash
   -- In Node.js:
   const crypto = require('crypto');
   const hash = crypto.createHash('sha256')
     .update('newpassword' + process.env.TOKEN_SECRET)
     .digest('hex');
   
   -- Update in database
   UPDATE employers SET "passwordHash" = 'new-hash' WHERE email = 'user@example.com';
   ```

---

## Server Issues

### Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solutions:**

1. **Change port in `.env`**
   ```env
   PORT=3002
   ```

2. **Kill process using port**
   ```bash
   # Windows
   netstat -ano | findstr :3001
   taskkill /PID <PID> /F
   
   # Mac/Linux
   lsof -ti:3001 | xargs kill -9
   ```

---

### Module Not Found

**Error:**
```
Error: Cannot find module '@nestjs/typeorm'
```

**Solution:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

### TypeScript Compilation Errors

**Error:**
```
Error: TS2307: Cannot find module 'typeorm'
```

**Solutions:**

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Clear build cache**
   ```bash
   rm -rf dist
   npm run build
   ```

3. **Check tsconfig.json**
   ```json
   {
     "compilerOptions": {
       "module": "commonjs",
       "declaration": true,
       "removeComments": true,
       "emitDecoratorMetadata": true,
       "experimentalDecorators": true,
       "allowSyntheticDefaultImports": true,
       "target": "ES2021",
       "sourceMap": true,
       "outDir": "./dist",
       "baseUrl": "./",
       "incremental": true,
       "skipLibCheck": true,
       "strictNullChecks": false,
       "noImplicitAny": false,
       "strictBindCallApply": false,
       "forceConsistentCasingInFileNames": false,
       "noFallthroughCasesInSwitch": false
     }
   }
   ```

---

## Email Issues

### Email Not Sending

**Error:**
```
Error: Invalid login: 535-5.7.8 Username and Password not accepted
```

**Solutions:**

1. **Use App Password (Gmail)**
   - Go to Google Account → Security → 2-Step Verification → App Passwords
   - Generate app password
   - Use in `.env`:
     ```env
     SMTP_PASSWORD=your-app-password
     ```

2. **Check SMTP settings**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   ```

3. **Test email manually**
   ```bash
   npm run test:email
   ```

---

### Email Delivery Delayed

**Solutions:**

1. **Check spam folder**

2. **Verify email service status**
   - Gmail: https://www.google.com/appsstatus
   - Outlook: https://portal.office.com/servicestatus

3. **Use email queue (future enhancement)**

---

## API Issues

### CORS Errors

**Error:**
```
Access to fetch at 'http://localhost:3001/api/jobs' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Solution:**

In `main.ts`:
```typescript
app.enableCors({
  origin: ['http://localhost:3000', 'https://your-domain.com'],
  credentials: true,
});
```

---

### Request Timeout

**Error:**
```
Error: Request timeout
```

**Solutions:**

1. **Check database query performance**
   ```typescript
   // Enable query logging
   logging: ['query', 'error'],
   ```

2. **Add indexes to frequently queried fields**
   ```typescript
   @Index()
   @Column()
   status: string;
   ```

3. **Optimize queries**
   ```typescript
   // Use select to limit fields
   await this.repository.find({ select: ['id', 'title'] });
   ```

---

### 413 Payload Too Large

**Error:**
```
413 Payload Too Large
```

**Solution:**

In `main.ts`:
```typescript
app.use(json({ limit: '50mb' }));
app.use(urlencoded({ extended: true, limit: '50mb' }));
```

---

## Performance Issues

### Slow Queries

**Solutions:**

1. **Enable query logging**
   ```typescript
   // In ormconfig.ts
   logging: ['query', 'slow'],
   maxQueryExecutionTime: 1000, // Log queries taking > 1s
   ```

2. **Add indexes**
   ```typescript
   @Entity('jobs')
   @Index(['status', 'createdAt'])
   export class Job {
     @Index()
     @Column()
     employerId: string;
   }
   ```

3. **Use pagination**
   ```typescript
   await this.repository.find({
     skip: (page - 1) * limit,
     take: limit,
   });
   ```

4. **Optimize relations**
   ```typescript
   // Use select to limit fields
   await this.repository.find({
     relations: ['employer'],
     select: {
       id: true,
       title: true,
       employer: { id: true, companyName: true },
     },
   });
   ```

---

### Memory Leaks

**Solutions:**

1. **Close database connections**
   ```typescript
   async onModuleDestroy() {
     await this.dataSource.destroy();
   }
   ```

2. **Clear event listeners**
   ```typescript
   async onModuleDestroy() {
     this.eventEmitter.removeAllListeners();
   }
   ```

3. **Monitor memory usage**
   ```bash
   node --inspect dist/main.js
   ```

---

## Development Issues

### Hot Reload Not Working

**Solutions:**

1. **Restart development server**
   ```bash
   npm run start:dev
   ```

2. **Clear build cache**
   ```bash
   rm -rf dist
   ```

3. **Check file watchers limit (Linux)**
   ```bash
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

---

### Environment Variables Not Loading

**Solutions:**

1. **Check `.env` file exists**
   ```bash
   ls -la .env
   ```

2. **Verify ConfigModule is imported**
   ```typescript
   @Module({
     imports: [
       ConfigModule.forRoot({
         isGlobal: true,
       }),
     ],
   })
   ```

3. **Restart server after changing `.env`**

---

## Production Issues

### Server Crashes

**Solutions:**

1. **Check logs**
   ```bash
   pm2 logs
   ```

2. **Enable error logging**
   ```typescript
   const logger = new Logger('Main');
   logger.error('Error message', error.stack);
   ```

3. **Use process manager**
   ```bash
   pm2 start dist/main.js --name hireflow-api
   pm2 startup
   pm2 save
   ```

---

### Database Connection Pool Exhausted

**Error:**
```
Error: Connection pool exhausted
```

**Solution:**

In `ormconfig.ts`:
```typescript
extra: {
  max: 20,                      // Increase pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}
```

---

## Getting Help

### Enable Debug Mode

```env
NODE_ENV=development
DEBUG=*
```

### Check Logs

```bash
# Development
npm run start:dev

# Production
pm2 logs hireflow-api
```

### Database Diagnostics

```bash
npm run db:check
```

### Test Email

```bash
npm run test:email
```

### Health Check

```bash
curl http://localhost:3001/api/health
```

---

## Still Having Issues?

1. Check the [GitHub Issues](https://github.com/your-repo/issues)
2. Review the [Documentation](./README.md)
3. Check [NestJS Documentation](https://docs.nestjs.com)
4. Check [TypeORM Documentation](https://typeorm.io)

---

**Most issues can be resolved by:**
1. Restarting the server
2. Checking `.env` configuration
3. Verifying database connection
4. Clearing cache and reinstalling dependencies
