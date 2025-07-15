-- =====================================================
-- Migration: 002_create_categories_table
-- Created: 2025-07-13
-- Description: Create categories table for task organization
-- =====================================================

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6366f1',
    icon VARCHAR(50) DEFAULT 'folder',
    sort_order INTEGER DEFAULT 0,
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Statistics (maintained by triggers)
    task_count INTEGER DEFAULT 0,
    completed_task_count INTEGER DEFAULT 0,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT unique_category_name_per_user UNIQUE (user_id, name),
    CONSTRAINT check_color_format CHECK (color ~* '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT check_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT check_task_counts_non_negative CHECK (
        task_count >= 0 AND 
        completed_task_count >= 0 AND 
        completed_task_count <= task_count
    )
);

-- Create indexes for categories table
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
CREATE INDEX IF NOT EXISTS idx_categories_deleted_at ON categories(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(user_id, sort_order);

-- Unique index to ensure only one default category per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_unique_default_per_user 
    ON categories(user_id) WHERE is_default = TRUE;

-- Create trigger for categories table
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE categories IS 'Categories table for organizing tasks';
COMMENT ON COLUMN categories.user_id IS 'Reference to user who owns this category';
COMMENT ON COLUMN categories.color IS 'Hex color code for category display';
COMMENT ON COLUMN categories.task_count IS 'Total number of tasks in this category';
COMMENT ON COLUMN categories.completed_task_count IS 'Number of completed tasks in this category';
