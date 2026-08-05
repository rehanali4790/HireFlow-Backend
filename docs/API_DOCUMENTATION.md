# API Documentation

Complete API reference for HireFlow backend.

## Base URL

```
Development: http://localhost:3001/api
Production: https://your-domain.com/api
```

## Authentication

All protected endpoints require an `Authorization` header:

```
Authorization: Bearer <token>
```

Get token from login/signup response.

## Response Format

### Success Response

```json
{
  "id": "uuid",
  "field": "value",
  ...
}
```

### Error Response

```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

---

## Authentication Endpoints

### POST /auth/signup

Create a new employer account.

**Request:**
```json
{
  "email": "company@example.com",
  "password": "securePassword123",
  "companyName": "Acme Corp"
}
```

**Response:**
```json
{
  "employer": {
    "id": "uuid",
    "companyName": "Acme Corp",
    "contactEmail": "company@example.com"
  },
  "token": "auth_token_here"
}
```

**Errors:**
- `409`: Email already exists
- `400`: Missing required fields

---

### POST /auth/login

Login to existing account.

**Request:**
```json
{
  "email": "company@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "employer": {
    "id": "uuid",
    "companyName": "Acme Corp",
    "contactEmail": "company@example.com"
  },
  "token": "auth_token_here"
}
```

**Errors:**
- `401`: Invalid credentials

---

### POST /auth/logout

Logout (invalidate token).

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true
}
```

---

### GET /auth/session

Get current session info.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "employer": {
    "id": "uuid",
    "companyName": "Acme Corp",
    "contactEmail": "company@example.com",
    ...
  }
}
```

**Errors:**
- `401`: Not authenticated

---

## Jobs Endpoints

### GET /jobs

List jobs (public: active only, authenticated: all).

**Headers:** `Authorization: Bearer <token>` (optional)

**Response:**
```json
[
  {
    "id": "uuid",
    "title": "Software Engineer",
    "description": "We are hiring...",
    "location": "San Francisco, CA",
    "workType": "full-time",
    "remotePolicy": "hybrid",
    "salaryMin": 100000,
    "salaryMax": 150000,
    "salaryCurrency": "USD",
    "status": "active",
    "employer": {
      "companyName": "Acme Corp",
      "companyLogoUrl": "https://..."
    },
    "createdAt": "2026-03-05T10:00:00Z"
  }
]
```

---

### GET /jobs/:id

Get single job details.

**Response:**
```json
{
  "id": "uuid",
  "title": "Software Engineer",
  "description": "We are hiring...",
  "requirements": "5+ years experience...",
  "responsibilities": "Build features...",
  "skillsRequired": ["TypeScript", "NestJS", "PostgreSQL"],
  "location": "San Francisco, CA",
  "workType": "full-time",
  "remotePolicy": "hybrid",
  "salaryMin": 100000,
  "salaryMax": 150000,
  "salaryCurrency": "USD",
  "experienceLevel": "mid",
  "educationRequired": "Bachelor's degree",
  "status": "active",
  "positionsAvailable": 2,
  "positionsFilled": 0,
  "applicationDeadline": "2026-04-01T00:00:00Z",
  "employer": {
    "companyName": "Acme Corp",
    "companyLogoUrl": "https://...",
    "companyDescription": "Leading tech company..."
  },
  "createdAt": "2026-03-05T10:00:00Z",
  "updatedAt": "2026-03-05T10:00:00Z"
}
```

**Errors:**
- `404`: Job not found

---

### POST /jobs

Create a new job posting.

**Headers:** `Authorization: Bearer <token>` (required)

**Request:**
```json
{
  "title": "Software Engineer",
  "description": "We are hiring...",
  "requirements": "5+ years experience...",
  "responsibilities": "Build features...",
  "skillsRequired": ["TypeScript", "NestJS"],
  "location": "San Francisco, CA",
  "workType": "full-time",
  "remotePolicy": "hybrid",
  "salaryMin": 100000,
  "salaryMax": 150000,
  "salaryCurrency": "USD",
  "experienceLevel": "mid",
  "educationRequired": "Bachelor's degree",
  "status": "active",
  "positionsAvailable": 2,
  "applicationDeadline": "2026-04-01T00:00:00Z"
}
```

**Response:**
```json
{
  "id": "uuid",
  "title": "Software Engineer",
  ...
}
```

**Errors:**
- `401`: Not authenticated
- `400`: Validation error

---

### PUT /jobs/:id

Update existing job.

**Headers:** `Authorization: Bearer <token>` (required)

**Request:** (any fields to update)
```json
{
  "title": "Senior Software Engineer",
  "salaryMax": 180000
}
```

**Response:**
```json
{
  "id": "uuid",
  "title": "Senior Software Engineer",
  ...
}
```

**Errors:**
- `401`: Not authenticated
- `404`: Job not found
- `403`: Not your job

---

### DELETE /jobs/:id

Delete a job posting.

**Headers:** `Authorization: Bearer <token>` (required)

**Response:**
```json
{
  "success": true
}
```

**Errors:**
- `401`: Not authenticated
- `404`: Job not found
- `403`: Not your job

---

## Applications Endpoints (TODO)

### POST /applications

Submit a job application.

### GET /jobs/:jobId/applications

Get all applications for a job (auth required).

### GET /applications/:id

Get application details.

### PATCH /applications/:id/status

Update application status (auth required).

---

## Candidates Endpoints (TODO)

### GET /candidates

List all candidates (auth required).

### GET /candidates/:id

Get candidate details (auth required).

---

## Tests Endpoints (TODO)

### GET /tests

List tests (auth required).

### POST /tests

Create a test (auth required).

### GET /tests/:id

Get test details.

### PUT /tests/:id

Update test (auth required).

### DELETE /tests/:id

Delete test (auth required).

---

## Interviews Endpoints (TODO)

### GET /interviews

List interviews (auth required).

### POST /interviews

Create interview (auth required).

### GET /interviews/token/:token

Get interview by token (for candidates).

### PUT /interviews/:id

Update interview.

---

## Analytics Endpoints (TODO)

### GET /analytics/dashboard

Get dashboard statistics (auth required).

---

## Health Check

### GET /health

Check server health.

**Response:**
```json
{
  "status": "ok",
  "message": "HireFlow API is running",
  "timestamp": "2026-03-05T10:00:00Z"
}
```

---

## Rate Limiting (TODO)

- **Public endpoints**: 100 requests/15 minutes
- **Authenticated endpoints**: 1000 requests/15 minutes

## Pagination (TODO)

For list endpoints:

```
GET /jobs?page=1&limit=20
```

Response includes:
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

## Filtering (TODO)

```
GET /jobs?status=active&location=San Francisco
```

## Sorting (TODO)

```
GET /jobs?sortBy=createdAt&order=desc
```

---

**Note**: Endpoints marked as TODO are planned but not yet implemented.
