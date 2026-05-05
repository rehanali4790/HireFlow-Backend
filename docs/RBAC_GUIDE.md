# Role-Based Access Control (RBAC) Guide

## Overview

HireFlow implements a comprehensive Role-Based Access Control (RBAC) system that allows employers to manage team members with granular permissions. The system supports:

- **Dynamic Roles**: Create custom roles with specific permissions
- **System Roles**: Pre-defined roles (Admin, Manager, Recruiter, Viewer)
- **Granular Permissions**: Control read, write, edit, and delete access per resource
- **User Management**: Add, edit, deactivate, and delete team members
- **Admin Privileges**: Special admin flag for elevated access
- **Audit Logging**: Track all permission changes and user actions

## Architecture

### Database Schema

#### Tables

1. **roles**
   - `id`: UUID primary key
   - `employer_id`: Reference to employer
   - `name`: Role name (unique per employer)
   - `description`: Role description
   - `is_system_role`: Boolean flag for system roles
   - `created_at`, `updated_at`: Timestamps

2. **permissions**
   - `id`: UUID primary key
   - `role_id`: Reference to role
   - `resource`: Resource name (jobs, applications, candidates, etc.)
   - `can_read`, `can_write`, `can_edit`, `can_delete`: Boolean flags
   - `created_at`, `updated_at`: Timestamps

3. **users**
   - `id`: UUID primary key
   - `employer_id`: Reference to employer
   - `role_id`: Reference to role (nullable)
   - `email`: User email (unique per employer)
   - `first_name`, `last_name`: User name
   - `password_hash`: Hashed password
   - `phone`: Phone number (optional)
   - `avatar_url`: Profile picture URL (optional)
   - `is_active`: Boolean flag for account status
   - `is_admin`: Boolean flag for admin privileges
   - `last_login`: Last login timestamp
   - `created_at`, `updated_at`: Timestamps

4. **user_activity_log**
   - `id`: UUID primary key
   - `user_id`: Reference to user
   - `employer_id`: Reference to employer
   - `action`: Action performed
   - `resource_type`: Type of resource
   - `resource_id`: ID of resource
   - `details`: JSON details
   - `ip_address`, `user_agent`: Request metadata
   - `created_at`: Timestamp

### Resources

The system defines 8 core resources:

1. **jobs**: Job postings management
2. **applications**: Application review and management
3. **candidates**: Candidate profile management
4. **tests**: Assessment test creation and management
5. **interviews**: Interview scheduling and management
6. **analytics**: Reports and analytics viewing
7. **settings**: Company settings management
8. **users**: Team member and permission management

### Permission Actions

Each resource supports 4 permission actions:

- **read**: View resource data
- **write**: Create new resources
- **edit**: Modify existing resources
- **delete**: Remove resources

## System Roles

### Admin
Full access to all features and resources.

**Permissions:**
- All resources: read, write, edit, delete

**Use Case:** Company owners, HR directors

### Manager
Manage jobs, applications, and team members.

**Permissions:**
- jobs: read, write, edit, delete
- applications: read, write, edit
- candidates: read, write, edit
- tests: read, write, edit, delete
- interviews: read, write, edit
- analytics: read
- settings: read
- users: read, write

**Use Case:** Hiring managers, department heads

### Recruiter
Review applications and conduct interviews.

**Permissions:**
- jobs: read
- applications: read, edit
- candidates: read, edit
- tests: read
- interviews: read, write, edit
- analytics: read

**Use Case:** Recruiters, HR coordinators

### Viewer
Read-only access to jobs and applications.

**Permissions:**
- jobs: read
- applications: read
- candidates: read
- tests: read
- interviews: read
- analytics: read

**Use Case:** Stakeholders, observers

## API Endpoints

### Roles

#### GET /api/roles
Get all roles for the employer.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Admin",
    "description": "Full access to all features",
    "is_system_role": true,
    "user_count": 5,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

#### GET /api/roles/:id
Get single role with permissions.

**Response:**
```json
{
  "id": "uuid",
  "name": "Admin",
  "description": "Full access to all features",
  "is_system_role": true,
  "user_count": 5,
  "permissions": [
    {
      "id": "uuid",
      "resource": "jobs",
      "can_read": true,
      "can_write": true,
      "can_edit": true,
      "can_delete": true
    }
  ]
}
```

#### POST /api/roles
Create new role (admin only).

**Request:**
```json
{
  "name": "Custom Role",
  "description": "Custom role description",
  "permissions": [
    {
      "resource": "jobs",
      "can_read": true,
      "can_write": true,
      "can_edit": false,
      "can_delete": false
    }
  ]
}
```

#### PUT /api/roles/:id
Update role (admin only, cannot modify system roles).

#### DELETE /api/roles/:id
Delete role (admin only, cannot delete system roles or roles with users).

#### GET /api/roles/resources/list
Get available resources.

**Response:**
```json
[
  {
    "id": "jobs",
    "name": "Jobs",
    "description": "Manage job postings"
  }
]
```

### Users

#### GET /api/users
Get all users for the employer.

#### GET /api/users/:id
Get single user.

#### POST /api/users
Create new user (admin only).

**Request:**
```json
{
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "password": "password123",
  "phone": "+1234567890",
  "role_id": "uuid",
  "is_admin": false,
  "is_active": true
}
```

#### PUT /api/users/:id
Update user (admin only).

#### DELETE /api/users/:id
Delete user (admin only, cannot delete yourself).

#### POST /api/users/:id/reset-password
Reset user password (admin only).

**Request:**
```json
{
  "new_password": "newpassword123"
}
```

### Permissions

#### GET /api/permissions/me
Get current user's permissions.

**Response:**
```json
{
  "is_owner": false,
  "is_admin": true,
  "is_active": true,
  "role_id": "uuid",
  "permissions": {
    "jobs": {
      "can_read": true,
      "can_write": true,
      "can_edit": true,
      "can_delete": true
    }
  }
}
```

## Middleware

### authMiddleware
Authenticates requests using `x-employer-id` and optional `x-user-id` headers.

```javascript
const authMiddleware = require('./middleware/auth');
router.get('/protected', authMiddleware, handler);
```

### checkPermission
Checks if user has specific permission for a resource.

```javascript
const { checkPermission } = require('./middleware/permissions');
router.post('/jobs', authMiddleware, checkPermission('jobs', 'write'), handler);
```

### requireAdmin
Requires user to be admin or owner.

```javascript
const { requireAdmin } = require('./middleware/permissions');
router.delete('/users/:id', authMiddleware, requireAdmin, handler);
```

## Frontend Integration

### PermissionsContext

Wrap your app with `PermissionsProvider`:

```tsx
import { PermissionsProvider } from './contexts/PermissionsContext';

function App() {
  return (
    <PermissionsProvider>
      <YourApp />
    </PermissionsProvider>
  );
}
```

### usePermissions Hook

Check permissions in components:

```tsx
import { usePermissions } from './contexts/PermissionsContext';

function MyComponent() {
  const { hasPermission, canAccess, isAdmin } = usePermissions();

  if (!canAccess('jobs')) {
    return <div>Access Denied</div>;
  }

  return (
    <div>
      {hasPermission('jobs', 'write') && (
        <button>Create Job</button>
      )}
      {hasPermission('jobs', 'delete') && (
        <button>Delete Job</button>
      )}
    </div>
  );
}
```

### withPermission HOC

Protect entire components:

```tsx
import { withPermission } from './contexts/PermissionsContext';

function JobsPage() {
  return <div>Jobs Content</div>;
}

export default withPermission(JobsPage, 'jobs', 'read');
```

## Best Practices

### 1. Principle of Least Privilege
Grant users only the permissions they need to perform their job functions.

### 2. Use System Roles as Templates
Start with system roles and create custom roles only when needed.

### 3. Regular Audits
Review user permissions regularly and remove access for inactive users.

### 4. Separate Admin and Owner
Use the `is_admin` flag for elevated privileges, but keep owner (employer) as the ultimate authority.

### 5. Activity Logging
Always log permission changes and sensitive actions for audit trails.

### 6. Deactivate Instead of Delete
When users leave, deactivate their accounts instead of deleting to preserve audit history.

### 7. Test Permissions
Always test permission changes in a development environment before applying to production.

## Security Considerations

1. **Password Security**: Passwords are hashed using bcrypt with salt rounds of 10
2. **Owner Protection**: Owner (employer) always has full access and cannot be restricted
3. **Self-Protection**: Users cannot delete their own accounts
4. **System Role Protection**: System roles cannot be modified or deleted
5. **Active User Check**: Inactive users are denied all access
6. **Role Assignment Validation**: Roles must belong to the same employer

## Migration

To add RBAC to an existing employer:

```bash
node run-users-permissions-migration.js
```

This will:
1. Create roles, permissions, and users tables
2. Create default system roles for all existing employers
3. Set up triggers for automatic role creation on new employer registration

## Troubleshooting

### User Cannot Access Resource

1. Check if user is active: `SELECT is_active FROM users WHERE id = 'user_id'`
2. Check if user has a role: `SELECT role_id FROM users WHERE id = 'user_id'`
3. Check role permissions: `SELECT * FROM permissions WHERE role_id = 'role_id'`
4. Check if user is admin: `SELECT is_admin FROM users WHERE id = 'user_id'`

### Cannot Delete Role

- Ensure role is not a system role
- Ensure role is not assigned to any users
- Ensure you have admin privileges

### Permission Check Failing

- Verify middleware order (authMiddleware must come before checkPermission)
- Check that `x-employer-id` header is set
- For team members, ensure `x-user-id` header is set
- Verify database connection and table existence

## Future Enhancements

1. **Custom Resources**: Allow employers to define custom resources
2. **Permission Templates**: Pre-defined permission sets for common scenarios
3. **Time-Based Access**: Temporary permissions with expiration
4. **IP Restrictions**: Limit access based on IP address
5. **Two-Factor Authentication**: Additional security layer for sensitive operations
6. **Permission Inheritance**: Hierarchical role structure with inheritance
7. **Bulk Operations**: Assign roles to multiple users at once
8. **Permission History**: Track permission changes over time
