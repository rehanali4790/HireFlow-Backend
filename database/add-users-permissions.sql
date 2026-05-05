-- Users and Permissions System for HireFlow

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id uuid REFERENCES employers(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  is_system_role boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employer_id, name)
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
  resource text NOT NULL, -- e.g., 'jobs', 'applications', 'candidates', 'tests', 'interviews', 'analytics', 'settings', 'users'
  can_read boolean DEFAULT false,
  can_write boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(role_id, resource)
);

-- Users table (team members under an employer)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id uuid REFERENCES employers(id) ON DELETE CASCADE NOT NULL,
  role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  password_hash text NOT NULL,
  phone text,
  avatar_url text,
  is_active boolean DEFAULT true,
  is_admin boolean DEFAULT false,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employer_id, email)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_roles_employer ON roles(employer_id);
CREATE INDEX IF NOT EXISTS idx_permissions_role ON permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_users_employer ON users(employer_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Insert default system roles for each employer
-- This will be done via migration script for existing employers

-- Function to create default roles for new employers
CREATE OR REPLACE FUNCTION create_default_roles_for_employer()
RETURNS TRIGGER AS $$
DECLARE
  admin_role_id uuid;
  manager_role_id uuid;
  recruiter_role_id uuid;
  viewer_role_id uuid;
BEGIN
  -- Create Admin role
  INSERT INTO roles (employer_id, name, description, is_system_role)
  VALUES (NEW.id, 'Admin', 'Full access to all features', true)
  RETURNING id INTO admin_role_id;
  
  -- Admin permissions (all resources, all rights)
  INSERT INTO permissions (role_id, resource, can_read, can_write, can_edit, can_delete)
  VALUES 
    (admin_role_id, 'jobs', true, true, true, true),
    (admin_role_id, 'applications', true, true, true, true),
    (admin_role_id, 'candidates', true, true, true, true),
    (admin_role_id, 'tests', true, true, true, true),
    (admin_role_id, 'interviews', true, true, true, true),
    (admin_role_id, 'analytics', true, true, true, true),
    (admin_role_id, 'settings', true, true, true, true),
    (admin_role_id, 'users', true, true, true, true);
  
  -- Create Manager role
  INSERT INTO roles (employer_id, name, description, is_system_role)
  VALUES (NEW.id, 'Manager', 'Manage jobs, applications, and team members', true)
  RETURNING id INTO manager_role_id;
  
  -- Manager permissions
  INSERT INTO permissions (role_id, resource, can_read, can_write, can_edit, can_delete)
  VALUES 
    (manager_role_id, 'jobs', true, true, true, true),
    (manager_role_id, 'applications', true, true, true, false),
    (manager_role_id, 'candidates', true, true, true, false),
    (manager_role_id, 'tests', true, true, true, true),
    (manager_role_id, 'interviews', true, true, true, false),
    (manager_role_id, 'analytics', true, false, false, false),
    (manager_role_id, 'settings', true, false, false, false),
    (manager_role_id, 'users', true, true, false, false);
  
  -- Create Recruiter role
  INSERT INTO roles (employer_id, name, description, is_system_role)
  VALUES (NEW.id, 'Recruiter', 'Review applications and conduct interviews', true)
  RETURNING id INTO recruiter_role_id;
  
  -- Recruiter permissions
  INSERT INTO permissions (role_id, resource, can_read, can_write, can_edit, can_delete)
  VALUES 
    (recruiter_role_id, 'jobs', true, false, false, false),
    (recruiter_role_id, 'applications', true, false, true, false),
    (recruiter_role_id, 'candidates', true, false, true, false),
    (recruiter_role_id, 'tests', true, false, false, false),
    (recruiter_role_id, 'interviews', true, true, true, false),
    (recruiter_role_id, 'analytics', true, false, false, false),
    (recruiter_role_id, 'settings', false, false, false, false),
    (recruiter_role_id, 'users', false, false, false, false);
  
  -- Create Viewer role
  INSERT INTO roles (employer_id, name, description, is_system_role)
  VALUES (NEW.id, 'Viewer', 'Read-only access to jobs and applications', true)
  RETURNING id INTO viewer_role_id;
  
  -- Viewer permissions
  INSERT INTO permissions (role_id, resource, can_read, can_write, can_edit, can_delete)
  VALUES 
    (viewer_role_id, 'jobs', true, false, false, false),
    (viewer_role_id, 'applications', true, false, false, false),
    (viewer_role_id, 'candidates', true, false, false, false),
    (viewer_role_id, 'tests', true, false, false, false),
    (viewer_role_id, 'interviews', true, false, false, false),
    (viewer_role_id, 'analytics', true, false, false, false),
    (viewer_role_id, 'settings', false, false, false, false),
    (viewer_role_id, 'users', false, false, false, false);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create default roles for new employers
DROP TRIGGER IF EXISTS create_default_roles_trigger ON employers;
CREATE TRIGGER create_default_roles_trigger
  AFTER INSERT ON employers
  FOR EACH ROW
  EXECUTE FUNCTION create_default_roles_for_employer();

-- Activity log for audit trail
CREATE TABLE IF NOT EXISTS user_activity_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  employer_id uuid REFERENCES employers(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL, -- e.g., 'login', 'create_job', 'approve_application', 'delete_candidate'
  resource_type text, -- e.g., 'job', 'application', 'candidate'
  resource_id uuid,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_employer ON user_activity_log(employer_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON user_activity_log(created_at);
