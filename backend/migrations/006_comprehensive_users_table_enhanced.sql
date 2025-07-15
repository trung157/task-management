-- =====================================================
-- Migration: 006_comprehensive_users_table_enhanced
-- Created: 2025-07-14
-- Description: Enhanced users table with comprehensive indexes, constraints, and optimizations
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For trigram similarity searches

-- Drop existing table if recreating (use with caution)
-- DROP TABLE IF EXISTS users CASCADE;

-- Create enhanced user role enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'premium_user', 'moderator', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create user status enum
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending_verification', 'email_unverified', 'locked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create authentication provider enum for OAuth support
DO $$ BEGIN
    CREATE TYPE auth_provider AS ENUM ('local', 'google', 'github', 'microsoft', 'apple');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create users table with enhanced features
CREATE TABLE IF NOT EXISTS users (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_normalized VARCHAR(255) UNIQUE NOT NULL, -- Normalized for case-insensitive searches
    username VARCHAR(50) UNIQUE, -- Optional username
    
    -- Authentication
    password_hash TEXT, -- NULL for OAuth-only accounts
    auth_provider auth_provider DEFAULT 'local',
    provider_id VARCHAR(255), -- External provider user ID
    
    -- Personal information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) GENERATED ALWAYS AS (
        CASE 
            WHEN username IS NOT NULL THEN username
            ELSE first_name || ' ' || last_name
        END
    ) STORED,
    full_name VARCHAR(200) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    
    -- Profile information
    avatar_url TEXT,
    bio TEXT,
    phone VARCHAR(20),
    birth_date DATE,
    
    -- Localization
    timezone VARCHAR(50) DEFAULT 'UTC',
    date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',
    time_format VARCHAR(20) DEFAULT '24h',
    language_code VARCHAR(5) DEFAULT 'en',
    country_code VARCHAR(3),
    
    -- Account management
    role user_role DEFAULT 'user',
    status user_status DEFAULT 'pending_verification',
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    phone_verified BOOLEAN DEFAULT FALSE,
    phone_verified_at TIMESTAMP WITH TIME ZONE,
    
    -- Security and audit
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip INET,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Two-factor authentication
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret TEXT, -- Encrypted TOTP secret
    backup_codes TEXT[], -- Encrypted backup codes
    
    -- Preferences and settings
    preferences JSONB DEFAULT '{}',
    notification_settings JSONB DEFAULT '{
        "email_notifications": true,
        "push_notifications": true,
        "due_date_reminders": true,
        "task_assignments": true,
        "daily_digest": false,
        "weekly_summary": true,
        "marketing_emails": false
    }',
    privacy_settings JSONB DEFAULT '{
        "profile_visibility": "private",
        "show_online_status": false,
        "allow_task_sharing": true
    }',
    
    -- Usage analytics
    login_count INTEGER DEFAULT 0,
    tasks_created_count INTEGER DEFAULT 0,
    tasks_completed_count INTEGER DEFAULT 0,
    
    -- Search optimization
    search_vector TSVECTOR,
    
    -- Subscription/billing (for premium features)
    subscription_tier VARCHAR(20) DEFAULT 'free',
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    -- Constraints
    CONSTRAINT check_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT check_email_normalized_format CHECK (email_normalized ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'),
    CONSTRAINT check_username_format CHECK (username IS NULL OR (username ~* '^[a-zA-Z0-9_]{3,50}$')),
    CONSTRAINT check_timezone CHECK (timezone IS NOT NULL),
    CONSTRAINT check_names_not_empty CHECK (
        LENGTH(TRIM(first_name)) > 0 AND 
        LENGTH(TRIM(last_name)) > 0
    ),
    CONSTRAINT check_phone_format CHECK (phone IS NULL OR phone ~* '^\+?[1-9]\d{1,14}$'),
    CONSTRAINT check_failed_login_attempts CHECK (failed_login_attempts >= 0),
    CONSTRAINT check_login_count CHECK (login_count >= 0),
    CONSTRAINT check_task_counts CHECK (
        tasks_created_count >= 0 AND 
        tasks_completed_count >= 0 AND
        tasks_completed_count <= tasks_created_count
    ),
    CONSTRAINT check_subscription_tier CHECK (subscription_tier IN ('free', 'basic', 'premium', 'enterprise')),
    CONSTRAINT check_oauth_constraints CHECK (
        (auth_provider = 'local' AND password_hash IS NOT NULL) OR
        (auth_provider != 'local' AND provider_id IS NOT NULL)
    ),
    CONSTRAINT check_birth_date CHECK (birth_date IS NULL OR birth_date < CURRENT_DATE),
    CONSTRAINT check_two_factor_consistency CHECK (
        (two_factor_enabled = FALSE AND two_factor_secret IS NULL) OR
        (two_factor_enabled = TRUE AND two_factor_secret IS NOT NULL)
    )
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_users_email_normalized ON users (email_normalized);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_provider_id ON users (auth_provider, provider_id) WHERE provider_id IS NOT NULL;

-- Status and role indexes
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_active ON users (status, email_verified) WHERE deleted_at IS NULL AND status = 'active';

-- Security indexes
CREATE INDEX IF NOT EXISTS idx_users_failed_logins ON users (failed_login_attempts, locked_until) WHERE failed_login_attempts > 0;
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users (last_login_at) WHERE last_login_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_password_changed ON users (password_changed_at);

-- Audit and temporal indexes
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users (updated_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users (last_activity_at) WHERE status = 'active';

-- Subscription and business indexes
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users (subscription_tier, subscription_expires_at) WHERE subscription_tier != 'free';
CREATE INDEX IF NOT EXISTS idx_users_trial ON users (trial_ends_at) WHERE trial_ends_at IS NOT NULL;

-- Search and analytics indexes
CREATE INDEX IF NOT EXISTS idx_users_search_vector ON users USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_users_full_text ON users USING gin(
    (first_name || ' ' || last_name || ' ' || COALESCE(username, '') || ' ' || email) gin_trgm_ops
);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_users_active_role ON users (status, role, created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_verification_status ON users (email_verified, status, created_at);

-- Partial indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_unverified_old ON users (created_at) 
    WHERE email_verified = FALSE AND status = 'pending_verification' AND created_at < NOW() - INTERVAL '7 days';

-- GIN indexes for JSONB fields
CREATE INDEX IF NOT EXISTS idx_users_preferences ON users USING gin(preferences);
CREATE INDEX IF NOT EXISTS idx_users_notification_settings ON users USING gin(notification_settings);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_user_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.first_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.last_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.username, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.email, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.bio, '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to normalize email
CREATE OR REPLACE FUNCTION update_user_email_normalized()
RETURNS TRIGGER AS $$
BEGIN
    NEW.email_normalized := LOWER(TRIM(NEW.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_user_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to validate and sanitize user data
CREATE OR REPLACE FUNCTION validate_user_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Trim and sanitize names
    NEW.first_name := TRIM(NEW.first_name);
    NEW.last_name := TRIM(NEW.last_name);
    
    -- Validate email domain
    IF NEW.email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Invalid email format: %', NEW.email;
    END IF;
    
    -- Check for disposable email domains (basic check)
    IF NEW.email ~* '(tempmail|10minutemail|guerrillamail|mailinator)' THEN
        RAISE NOTICE 'Potentially disposable email detected: %', NEW.email;
    END IF;
    
    -- Set default avatar if none provided
    IF NEW.avatar_url IS NULL OR NEW.avatar_url = '' THEN
        NEW.avatar_url := 'https://ui-avatars.com/api/?name=' || 
            encode(NEW.first_name || '+' || NEW.last_name, 'escape') || 
            '&background=6366f1&color=ffffff';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_user_search_vector ON users;
CREATE TRIGGER trigger_update_user_search_vector
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_user_search_vector();

DROP TRIGGER IF EXISTS trigger_update_user_email_normalized ON users;
CREATE TRIGGER trigger_update_user_email_normalized
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_user_email_normalized();

DROP TRIGGER IF EXISTS trigger_update_user_updated_at ON users;
CREATE TRIGGER trigger_update_user_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_user_updated_at();

DROP TRIGGER IF EXISTS trigger_validate_user_data ON users;
CREATE TRIGGER trigger_validate_user_data
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION validate_user_data();

-- =====================================================
-- INITIAL DATA AND ADMIN USER
-- =====================================================

-- Insert system admin user (if not exists)
INSERT INTO users (
    id,
    email,
    email_normalized,
    username,
    password_hash,
    first_name,
    last_name,
    role,
    status,
    email_verified,
    email_verified_at,
    preferences,
    notification_settings
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@taskflow.com',
    'admin@taskflow.com',
    'admin',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewkV5l5LPbKwGOma', -- 'admin123' - CHANGE IN PRODUCTION
    'System',
    'Administrator',
    'super_admin',
    'active',
    TRUE,
    CURRENT_TIMESTAMP,
    '{"theme": "dark", "sidebar_collapsed": false, "default_task_priority": "medium"}',
    '{"email_notifications": false, "push_notifications": false, "due_date_reminders": false, "task_assignments": false, "daily_digest": false, "weekly_summary": false, "marketing_emails": false}'
) ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- SECURITY POLICIES (Row Level Security)
-- =====================================================

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own data
CREATE POLICY users_select_own ON users
    FOR SELECT
    USING (id = current_setting('app.current_user_id')::UUID);

-- Policy: Users can update their own data (except role and status)
CREATE POLICY users_update_own ON users
    FOR UPDATE
    USING (id = current_setting('app.current_user_id')::UUID)
    WITH CHECK (
        id = current_setting('app.current_user_id')::UUID AND
        role = OLD.role AND -- Cannot change own role
        status = OLD.status -- Cannot change own status
    );

-- Policy: Admins can view all users
CREATE POLICY users_admin_select ON users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = current_setting('app.current_user_id')::UUID 
            AND u.role IN ('admin', 'super_admin')
        )
    );

-- Policy: Admins can update any user
CREATE POLICY users_admin_update ON users
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = current_setting('app.current_user_id')::UUID 
            AND u.role IN ('admin', 'super_admin')
        )
    );

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- Active users view (excluding deleted and suspended)
CREATE OR REPLACE VIEW active_users AS
SELECT 
    id,
    email,
    username,
    first_name,
    last_name,
    display_name,
    avatar_url,
    role,
    status,
    email_verified,
    last_login_at,
    created_at,
    subscription_tier
FROM users 
WHERE deleted_at IS NULL 
    AND status IN ('active', 'pending_verification')
ORDER BY last_activity_at DESC;

-- User statistics view
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE status = 'active') as active_users,
    COUNT(*) FILTER (WHERE status = 'pending_verification') as pending_users,
    COUNT(*) FILTER (WHERE email_verified = TRUE) as verified_users,
    COUNT(*) FILTER (WHERE role = 'admin') as admin_users,
    COUNT(*) FILTER (WHERE subscription_tier != 'free') as paid_users,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_users_30d,
    COUNT(*) FILTER (WHERE last_login_at >= CURRENT_DATE - INTERVAL '30 days') as active_users_30d
FROM users 
WHERE deleted_at IS NULL;

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON TABLE users IS 'Enhanced users table with comprehensive authentication, security, and profile management features';
COMMENT ON COLUMN users.email_normalized IS 'Lowercase normalized email for case-insensitive lookups';
COMMENT ON COLUMN users.auth_provider IS 'Authentication provider (local, OAuth, etc.)';
COMMENT ON COLUMN users.search_vector IS 'Full-text search vector for user discovery';
COMMENT ON COLUMN users.two_factor_secret IS 'Encrypted TOTP secret for 2FA';
COMMENT ON COLUMN users.preferences IS 'User interface and application preferences';
COMMENT ON COLUMN users.notification_settings IS 'User notification preferences';
COMMENT ON COLUMN users.privacy_settings IS 'User privacy and visibility settings';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 006_comprehensive_users_table_enhanced completed successfully at %', NOW();
END $$;
