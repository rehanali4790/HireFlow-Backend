-- Team member profile fields used by chats and user management
ALTER TABLE users
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS designation TEXT;
