-- =====================================================
-- Migration: 008_fix_refresh_token_length
-- Created: 2025-07-16
-- Description: Fix refresh token column length - JWT tokens can be longer than 255 chars
-- =====================================================

-- Increase token column length to accommodate JWT tokens
ALTER TABLE refresh_tokens 
ALTER COLUMN token TYPE VARCHAR(1000);

-- Update comment
COMMENT ON COLUMN refresh_tokens.token IS 'Unique refresh token value (JWT can be up to 1000 chars)';

-- Add a check to log token lengths for debugging
DO $$
DECLARE
    max_length INTEGER;
BEGIN
    SELECT MAX(LENGTH(token)) INTO max_length FROM refresh_tokens;
    RAISE NOTICE 'Current maximum token length in refresh_tokens: %', COALESCE(max_length, 0);
END $$;
