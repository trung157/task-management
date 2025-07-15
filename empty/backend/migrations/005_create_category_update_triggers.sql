-- =====================================================
-- Migration: 005_create_category_update_triggers
-- Created: 2025-07-13
-- Description: Create triggers to maintain category task counts
-- =====================================================

-- Function to update category task counts
CREATE OR REPLACE FUNCTION update_category_task_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT
    IF TG_OP = 'INSERT' THEN
        IF NEW.category_id IS NOT NULL AND NEW.deleted_at IS NULL THEN
            UPDATE categories SET 
                task_count = task_count + 1,
                completed_task_count = completed_task_count + CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
                updated_at = NOW()
            WHERE id = NEW.category_id;
        END IF;
        RETURN NEW;
    END IF;
    
    -- Handle UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- Handle category change
        IF OLD.category_id IS DISTINCT FROM NEW.category_id THEN
            -- Decrease count in old category
            IF OLD.category_id IS NOT NULL THEN
                UPDATE categories SET 
                    task_count = task_count - 1,
                    completed_task_count = completed_task_count - CASE WHEN OLD.status = 'completed' THEN 1 ELSE 0 END,
                    updated_at = NOW()
                WHERE id = OLD.category_id;
            END IF;
            
            -- Increase count in new category
            IF NEW.category_id IS NOT NULL AND NEW.deleted_at IS NULL THEN
                UPDATE categories SET 
                    task_count = task_count + 1,
                    completed_task_count = completed_task_count + CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
                    updated_at = NOW()
                WHERE id = NEW.category_id;
            END IF;
        END IF;
        
        -- Handle status change
        IF OLD.status IS DISTINCT FROM NEW.status AND NEW.category_id IS NOT NULL THEN
            IF OLD.status = 'completed' AND NEW.status != 'completed' THEN
                -- Task was uncompleted
                UPDATE categories SET 
                    completed_task_count = completed_task_count - 1,
                    updated_at = NOW()
                WHERE id = NEW.category_id;
            ELSIF OLD.status != 'completed' AND NEW.status = 'completed' THEN
                -- Task was completed
                UPDATE categories SET 
                    completed_task_count = completed_task_count + 1,
                    updated_at = NOW()
                WHERE id = NEW.category_id;
            END IF;
        END IF;
        
        -- Handle soft delete
        IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
            -- Task was soft deleted
            IF NEW.category_id IS NOT NULL THEN
                UPDATE categories SET 
                    task_count = task_count - 1,
                    completed_task_count = completed_task_count - CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
                    updated_at = NOW()
                WHERE id = NEW.category_id;
            END IF;
        ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
            -- Task was restored
            IF NEW.category_id IS NOT NULL THEN
                UPDATE categories SET 
                    task_count = task_count + 1,
                    completed_task_count = completed_task_count + CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
                    updated_at = NOW()
                WHERE id = NEW.category_id;
            END IF;
        END IF;
        
        RETURN NEW;
    END IF;
    
    -- Handle DELETE
    IF TG_OP = 'DELETE' THEN
        IF OLD.category_id IS NOT NULL AND OLD.deleted_at IS NULL THEN
            UPDATE categories SET 
                task_count = task_count - 1,
                completed_task_count = completed_task_count - CASE WHEN OLD.status = 'completed' THEN 1 ELSE 0 END,
                updated_at = NOW()
            WHERE id = OLD.category_id;
        END IF;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for category task count maintenance
DROP TRIGGER IF EXISTS trigger_update_category_task_count ON tasks;
CREATE TRIGGER trigger_update_category_task_count
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_category_task_count();

-- Function to recalculate category task counts (for data consistency)
CREATE OR REPLACE FUNCTION recalculate_category_task_counts()
RETURNS void AS $$
BEGIN
    UPDATE categories SET 
        task_count = (
            SELECT COUNT(*)
            FROM tasks
            WHERE tasks.category_id = categories.id
            AND tasks.deleted_at IS NULL
        ),
        completed_task_count = (
            SELECT COUNT(*)
            FROM tasks
            WHERE tasks.category_id = categories.id
            AND tasks.deleted_at IS NULL
            AND tasks.status = 'completed'
        ),
        updated_at = NOW()
    WHERE deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION update_category_task_count() IS 'Automatically maintains task counts in categories table';
COMMENT ON FUNCTION recalculate_category_task_counts() IS 'Recalculates all category task counts for data consistency';
