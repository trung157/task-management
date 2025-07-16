-- =====================================================
-- Migration: 006_users_table_enhancements
-- Created: 2025-07-15
-- Description: Add enhancements to existing users table
-- =====================================================

-- Enable additional extensions needed
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For trigram similarity searches

-- Create additional enums
DO $$ BEGIN
    CREATE TYPE auth_provider AS ENUM ('local', 'google', 'github', 'microsoft', 'apple');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to existing users table
DO $$ 
BEGIN
    -- Add email_normalized column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_normalized') THEN
        ALTER TABLE users ADD COLUMN email_normalized VARCHAR(255);
    END IF;
    
    -- Add username column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'username') THEN
        ALTER TABLE users ADD COLUMN username VARCHAR(50);
    END IF;
    
    -- Add auth_provider column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'auth_provider') THEN
        ALTER TABLE users ADD COLUMN auth_provider auth_provider DEFAULT 'local';
    END IF;
    
    -- Add provider_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'provider_id') THEN
        ALTER TABLE users ADD COLUMN provider_id VARCHAR(255);
    END IF;
    
    -- Add phone column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone') THEN
        ALTER TABLE users ADD COLUMN phone VARCHAR(20);
    END IF;
    
    -- Add birth_date column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'birth_date') THEN
        ALTER TABLE users ADD COLUMN birth_date DATE;
    END IF;
    
    -- Add two_factor_enabled column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'two_factor_enabled') THEN
        ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add preferences column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'preferences') THEN
        ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}';
    END IF;
    
    -- Add last_activity_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_activity_at') THEN
        ALTER TABLE users ADD COLUMN last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Populate email_normalized column
UPDATE users SET email_normalized = LOWER(TRIM(email)) WHERE email_normalized IS NULL;

-- Add constraints after data population
DO $$
BEGIN
    -- Add unique constraint on email_normalized if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_normalized_key') THEN
        ALTER TABLE users ADD CONSTRAINT users_email_normalized_key UNIQUE (email_normalized);
    END IF;
    
    -- Add unique constraint on username if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key') THEN
        ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
    END IF;
    
    -- Make email_normalized NOT NULL
    ALTER TABLE users ALTER COLUMN email_normalized SET NOT NULL;
END $$;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_users_email_normalized ON users (email_normalized);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users (auth_provider);
CREATE INDEX IF NOT EXISTS idx_users_provider_id ON users (provider_id) WHERE provider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users (last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_two_factor ON users (two_factor_enabled) WHERE two_factor_enabled = TRUE;

-- Create GIN index for preferences JSONB
CREATE INDEX IF NOT EXISTS idx_users_preferences ON users USING gin(preferences);

-- Create trigger to auto-update email_normalized
CREATE OR REPLACE FUNCTION update_user_email_normalized()
RETURNS TRIGGER AS $$
BEGIN
    NEW.email_normalized := LOWER(TRIM(NEW.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_user_email_normalized ON users;
CREATE TRIGGER trigger_update_user_email_normalized
    BEFORE INSERT OR UPDATE OF email ON users
    FOR EACH ROW EXECUTE FUNCTION update_user_email_normalized();

-- Add comments
COMMENT ON COLUMN users.email_normalized IS 'Lowercase normalized email for case-insensitive lookups';
COMMENT ON COLUMN users.username IS 'Optional unique username for display';
COMMENT ON COLUMN users.auth_provider IS 'Authentication provider (local, google, github, etc.)';
COMMENT ON COLUMN users.provider_id IS 'External provider user ID for OAuth accounts';
COMMENT ON COLUMN users.phone IS 'User phone number';
COMMENT ON COLUMN users.birth_date IS 'User birth date';
COMMENT ON COLUMN users.two_factor_enabled IS 'Whether two-factor authentication is enabled';
COMMENT ON COLUMN users.preferences IS 'User preferences stored as JSON';
COMMENT ON COLUMN users.last_activity_at IS 'Last time user was active';
