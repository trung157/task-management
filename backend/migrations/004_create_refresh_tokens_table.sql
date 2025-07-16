-- =====================================================
-- Migration: 004_create_refresh_tokens_table
-- Created: 2025-07-13
-- Description: Create refresh tokens table for JWT authentication
-- =====================================================

-- Create refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    
    -- Constraints
    CONSTRAINT check_expires_future CHECK (expires_at > created_at),
    CONSTRAINT check_revoked_logic CHECK (
        (revoked = FALSE AND revoked_at IS NULL) OR
        (revoked = TRUE AND revoked_at IS NOT NULL)
    )
);

-- Create indexes for refresh tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token) WHERE revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked ON refresh_tokens(revoked, expires_at);

-- Partial index for active tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active ON refresh_tokens(user_id, expires_at DESC) 
    WHERE revoked = FALSE AND expires_at IS NOT NULL;

-- Add comments
COMMENT ON TABLE refresh_tokens IS 'Refresh tokens for JWT authentication';
COMMENT ON COLUMN refresh_tokens.token IS 'Unique refresh token value';
COMMENT ON COLUMN refresh_tokens.expires_at IS 'When the token expires';
COMMENT ON COLUMN refresh_tokens.device_info IS 'Device information as JSON';
COMMENT ON COLUMN refresh_tokens.ip_address IS 'IP address where token was issued';
