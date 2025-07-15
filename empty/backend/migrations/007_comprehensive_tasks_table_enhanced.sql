-- =====================================================
-- Migration: 007_comprehensive_tasks_table_enhanced
-- Created: 2025-07-14
-- Description: Enhanced tasks table with comprehensive indexes, constraints, triggers, and optimizations
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For trigram similarity searches
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For better composite indexes

-- Drop existing table if recreating (use with caution in production)
-- DROP TABLE IF EXISTS tasks CASCADE;

-- Create task priority enum with enhanced levels
DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('critical', 'high', 'medium', 'low', 'none');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create task status enum with comprehensive states
DO $$ BEGIN
    CREATE TYPE task_status AS ENUM (
        'draft',           -- Initial state
        'pending',         -- Ready to start
        'in_progress',     -- Currently being worked on
        'on_hold',         -- Temporarily paused
        'blocked',         -- Waiting for external dependency
        'review',          -- Needs review/approval
        'completed',       -- Finished successfully
        'cancelled',       -- Cancelled by user
        'archived'         -- Archived for reference
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create task type enum for categorization
DO $$ BEGIN
    CREATE TYPE task_type AS ENUM (
        'personal',        -- Personal task
        'work',           -- Work-related task
        'project',        -- Project milestone
        'reminder',       -- Simple reminder
        'habit',          -- Recurring habit
        'goal',           -- Long-term goal
        'meeting',        -- Meeting or appointment
        'deadline'        -- Important deadline
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create recurrence pattern enum
DO $$ BEGIN
    CREATE TYPE recurrence_pattern AS ENUM (
        'none',           -- No recurrence
        'daily',          -- Every day
        'weekly',         -- Every week
        'biweekly',       -- Every two weeks
        'monthly',        -- Every month
        'quarterly',      -- Every quarter
        'yearly',         -- Every year
        'custom'          -- Custom pattern (defined in metadata)
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create comprehensive tasks table
CREATE TABLE IF NOT EXISTS tasks (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    category_id UUID,
    parent_task_id UUID, -- For subtasks/task hierarchies
    
    -- Core task information
    title VARCHAR(500) NOT NULL,
    description TEXT,
    task_type task_type DEFAULT 'personal',
    priority task_priority DEFAULT 'none',
    status task_status DEFAULT 'draft',
    
    -- Scheduling and time management
    due_date TIMESTAMP WITH TIME ZONE,
    start_date TIMESTAMP WITH TIME ZONE,
    reminder_date TIMESTAMP WITH TIME ZONE,
    scheduled_date TIMESTAMP WITH TIME ZONE, -- When user plans to work on it
    
    -- Time tracking
    estimated_hours DECIMAL(8,2), -- More precise than minutes
    actual_hours DECIMAL(8,2),
    time_logged_today DECIMAL(4,2) DEFAULT 0, -- Hours logged today
    last_time_log TIMESTAMP WITH TIME ZONE,
    
    -- Completion tracking
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID,
    
    -- Recurrence support
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern recurrence_pattern DEFAULT 'none',
    recurrence_interval INTEGER DEFAULT 1, -- e.g., every 2 weeks
    recurrence_end_date TIMESTAMP WITH TIME ZONE,
    last_occurrence_id UUID, -- Link to previous occurrence
    next_occurrence_date TIMESTAMP WITH TIME ZONE,
    
    -- Organization and collaboration
    tags TEXT[] DEFAULT '{}',
    labels JSONB DEFAULT '{}', -- Flexible labeling system
    assignee_id UUID, -- Can be assigned to others
    collaborators UUID[] DEFAULT '{}', -- Multiple people can work on task
    
    -- Priority and ordering
    sort_order INTEGER DEFAULT 0,
    user_priority_rank INTEGER, -- User's custom ranking
    urgency_score DECIMAL(3,2) DEFAULT 0, -- Calculated urgency (0-10)
    importance_score DECIMAL(3,2) DEFAULT 0, -- User-defined importance (0-10)
    
    -- Dependencies and blocking
    depends_on UUID[], -- Array of task IDs this task depends on
    blocks UUID[], -- Array of task IDs this task blocks
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_reason TEXT,
    
    -- File attachments and links
    attachments JSONB DEFAULT '[]', -- File metadata
    external_links JSONB DEFAULT '[]', -- URLs and references
    
    -- Notifications and reminders
    notification_settings JSONB DEFAULT '{}',
    last_reminded_at TIMESTAMP WITH TIME ZONE,
    reminder_count INTEGER DEFAULT 0,
    
    -- Location and context
    location VARCHAR(255),
    context_tags TEXT[] DEFAULT '{}', -- @work, @home, @phone, etc.
    energy_required VARCHAR(20) CHECK (energy_required IN ('low', 'medium', 'high')),
    
    -- Metadata and custom fields
    metadata JSONB DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    notes TEXT,
    
    -- Search optimization
    search_vector TSVECTOR,
    search_keywords TEXT[], -- Additional search terms
    
    -- Analytics and insights
    view_count INTEGER DEFAULT 0,
    edit_count INTEGER DEFAULT 0,
    time_spent_viewing INTERVAL DEFAULT '0 seconds',
    productivity_score DECIMAL(3,2), -- 0-10 based on completion time vs estimate
    
    -- Audit and versioning
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    
    -- Soft delete support
    is_deleted BOOLEAN DEFAULT FALSE,
    deletion_reason VARCHAR(100),
    
    -- Row-level security support
    tenant_id UUID, -- For multi-tenancy if needed
    
    -- Constraints
    CONSTRAINT tasks_title_not_empty CHECK (LENGTH(TRIM(title)) > 0),
    CONSTRAINT tasks_positive_hours CHECK (
        (estimated_hours IS NULL OR estimated_hours >= 0) AND
        (actual_hours IS NULL OR actual_hours >= 0) AND
        (time_logged_today IS NULL OR time_logged_today >= 0)
    ),
    CONSTRAINT tasks_due_date_logical CHECK (
        due_date IS NULL OR 
        start_date IS NULL OR 
        start_date <= due_date
    ),
    CONSTRAINT tasks_reminder_before_due CHECK (
        due_date IS NULL OR 
        reminder_date IS NULL OR 
        reminder_date <= due_date
    ),
    CONSTRAINT tasks_completed_status_consistency CHECK (
        (status = 'completed' AND completed_at IS NOT NULL AND completion_percentage = 100) OR
        (status != 'completed' AND (completed_at IS NULL OR completion_percentage < 100))
    ),
    CONSTRAINT tasks_tags_limit CHECK (
        tags IS NOT NULL AND 
        (array_length(tags, 1) IS NULL OR array_length(tags, 1) <= 50)
    ),
    CONSTRAINT tasks_context_tags_limit CHECK (
        context_tags IS NOT NULL AND 
        (array_length(context_tags, 1) IS NULL OR array_length(context_tags, 1) <= 20)
    ),
    CONSTRAINT tasks_recurrence_consistency CHECK (
        (is_recurring = TRUE AND recurrence_pattern != 'none') OR
        (is_recurring = FALSE AND recurrence_pattern = 'none')
    ),
    CONSTRAINT tasks_parent_not_self CHECK (id != parent_task_id),
    CONSTRAINT tasks_urgency_range CHECK (urgency_score >= 0 AND urgency_score <= 10),
    CONSTRAINT tasks_importance_range CHECK (importance_score >= 0 AND importance_score <= 10),
    CONSTRAINT tasks_valid_completion CHECK (completion_percentage BETWEEN 0 AND 100)
);

-- Add foreign key constraints
ALTER TABLE tasks 
    ADD CONSTRAINT fk_tasks_user_id 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE tasks 
    ADD CONSTRAINT fk_tasks_category_id 
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

ALTER TABLE tasks 
    ADD CONSTRAINT fk_tasks_parent_task_id 
    FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE;

ALTER TABLE tasks 
    ADD CONSTRAINT fk_tasks_completed_by 
    FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE tasks 
    ADD CONSTRAINT fk_tasks_assignee_id 
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE tasks 
    ADD CONSTRAINT fk_tasks_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE tasks 
    ADD CONSTRAINT fk_tasks_updated_by 
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- =====================================================
-- INDEXES FOR OPTIMAL PERFORMANCE
-- =====================================================

-- Primary access patterns
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_user_priority ON tasks(user_id, priority) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON tasks(category_id) WHERE category_id IS NOT NULL;

-- Date-based queries
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON tasks(start_date) WHERE start_date IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_reminder_date ON tasks(reminder_date) WHERE reminder_date IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at DESC) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at DESC);

-- Status and priority combinations
CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON tasks(status, priority) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_user_status_priority ON tasks(user_id, status, priority) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_user_type_status ON tasks(user_id, task_type, status) WHERE deleted_at IS NULL;

-- Time-based queries for productivity
CREATE INDEX IF NOT EXISTS idx_tasks_overdue ON tasks(user_id, due_date) 
    WHERE deleted_at IS NULL AND status NOT IN ('completed', 'cancelled', 'archived') AND due_date < NOW();

CREATE INDEX IF NOT EXISTS idx_tasks_today_due ON tasks(user_id, due_date) 
    WHERE deleted_at IS NULL AND DATE(due_date) = CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_tasks_this_week_due ON tasks(user_id, due_date) 
    WHERE deleted_at IS NULL AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days';

-- Search and filtering
CREATE INDEX IF NOT EXISTS idx_tasks_search_vector ON tasks USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING gin(tags) WHERE array_length(tags, 1) > 0;
CREATE INDEX IF NOT EXISTS idx_tasks_context_tags ON tasks USING gin(context_tags) WHERE array_length(context_tags, 1) > 0;
CREATE INDEX IF NOT EXISTS idx_tasks_search_keywords ON tasks USING gin(search_keywords) WHERE array_length(search_keywords, 1) > 0;

-- Collaboration and assignment
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id) WHERE assignee_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_collaborators ON tasks USING gin(collaborators) WHERE array_length(collaborators, 1) > 0;

-- Hierarchy and dependencies
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_depends_on ON tasks USING gin(depends_on) WHERE array_length(depends_on, 1) > 0;
CREATE INDEX IF NOT EXISTS idx_tasks_blocks ON tasks USING gin(blocks) WHERE array_length(blocks, 1) > 0;
CREATE INDEX IF NOT EXISTS idx_tasks_blocked ON tasks(is_blocked) WHERE is_blocked = TRUE;

-- Recurrence support
CREATE INDEX IF NOT EXISTS idx_tasks_recurring ON tasks(is_recurring, recurrence_pattern, next_occurrence_date) 
    WHERE is_recurring = TRUE;

-- Performance optimizations
CREATE INDEX IF NOT EXISTS idx_tasks_active_user_priority ON tasks(user_id, user_priority_rank) 
    WHERE deleted_at IS NULL AND status NOT IN ('completed', 'cancelled', 'archived');

CREATE INDEX IF NOT EXISTS idx_tasks_energy_context ON tasks(energy_required, context_tags) 
    WHERE deleted_at IS NULL AND energy_required IS NOT NULL;

-- Partial indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_incomplete_priority ON tasks(user_id, priority, due_date) 
    WHERE deleted_at IS NULL AND status NOT IN ('completed', 'cancelled', 'archived');

CREATE INDEX IF NOT EXISTS idx_tasks_recent_activity ON tasks(user_id, updated_at DESC) 
    WHERE deleted_at IS NULL AND updated_at > CURRENT_TIMESTAMP - INTERVAL '30 days';

-- JSONB indexes for metadata queries
CREATE INDEX IF NOT EXISTS idx_tasks_metadata ON tasks USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_tasks_custom_fields ON tasks USING gin(custom_fields);
CREATE INDEX IF NOT EXISTS idx_tasks_labels ON tasks USING gin(labels);
CREATE INDEX IF NOT EXISTS idx_tasks_notification_settings ON tasks USING gin(notification_settings);

-- =====================================================
-- TRIGGERS AND FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_tasks_updated_at ON tasks;
CREATE TRIGGER trigger_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_task_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.notes, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'D') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.context_tags, ' '), '')), 'D') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.search_keywords, ' '), '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for search vector
DROP TRIGGER IF EXISTS trigger_update_task_search_vector ON tasks;
CREATE TRIGGER trigger_update_task_search_vector
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_task_search_vector();

-- Function to calculate urgency score
CREATE OR REPLACE FUNCTION calculate_task_urgency()
RETURNS TRIGGER AS $$
DECLARE
    days_until_due INTEGER;
    urgency DECIMAL(3,2) := 0;
BEGIN
    -- Calculate urgency based on due date and priority
    IF NEW.due_date IS NOT NULL THEN
        days_until_due := EXTRACT(DAYS FROM (NEW.due_date - CURRENT_TIMESTAMP));
        
        -- Base urgency on days remaining
        IF days_until_due <= 0 THEN
            urgency := 10; -- Overdue
        ELSIF days_until_due <= 1 THEN
            urgency := 9; -- Due today/tomorrow
        ELSIF days_until_due <= 3 THEN
            urgency := 7; -- Due this week
        ELSIF days_until_due <= 7 THEN
            urgency := 5; -- Due next week
        ELSIF days_until_due <= 14 THEN
            urgency := 3; -- Due in 2 weeks
        ELSE
            urgency := 1; -- Due later
        END IF;
        
        -- Adjust based on priority
        CASE NEW.priority
            WHEN 'critical' THEN urgency := LEAST(10, urgency + 3);
            WHEN 'high' THEN urgency := LEAST(10, urgency + 2);
            WHEN 'medium' THEN urgency := LEAST(10, urgency + 1);
            WHEN 'low' THEN urgency := GREATEST(1, urgency - 1);
            ELSE urgency := urgency;
        END CASE;
        
        NEW.urgency_score := urgency;
    ELSE
        -- No due date, base only on priority
        CASE NEW.priority
            WHEN 'critical' THEN NEW.urgency_score := 8;
            WHEN 'high' THEN NEW.urgency_score := 6;
            WHEN 'medium' THEN NEW.urgency_score := 4;
            WHEN 'low' THEN NEW.urgency_score := 2;
            ELSE NEW.urgency_score := 0;
        END CASE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for urgency calculation
DROP TRIGGER IF EXISTS trigger_calculate_task_urgency ON tasks;
CREATE TRIGGER trigger_calculate_task_urgency
    BEFORE INSERT OR UPDATE OF due_date, priority ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION calculate_task_urgency();

-- Function to handle completion
CREATE OR REPLACE FUNCTION handle_task_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-set completion when status changes to completed
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at := CURRENT_TIMESTAMP;
        NEW.completion_percentage := 100;
        IF NEW.completed_by IS NULL THEN
            NEW.completed_by := NEW.updated_by;
        END IF;
        
        -- Calculate productivity score
        IF NEW.estimated_hours IS NOT NULL AND NEW.actual_hours IS NOT NULL THEN
            NEW.productivity_score := LEAST(10, GREATEST(0, 
                10 - ABS(NEW.actual_hours - NEW.estimated_hours) / NEW.estimated_hours * 5
            ));
        END IF;
    END IF;
    
    -- Clear completion when status changes from completed
    IF OLD.status = 'completed' AND NEW.status != 'completed' THEN
        NEW.completed_at := NULL;
        NEW.completed_by := NULL;
        IF NEW.completion_percentage = 100 THEN
            NEW.completion_percentage := 90; -- Almost done but not complete
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for completion handling
DROP TRIGGER IF EXISTS trigger_handle_task_completion ON tasks;
CREATE TRIGGER trigger_handle_task_completion
    BEFORE UPDATE OF status, completion_percentage ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION handle_task_completion();

-- Function to handle blocking relationships
CREATE OR REPLACE FUNCTION update_blocking_status()
RETURNS TRIGGER AS $$
DECLARE
    dependent_task RECORD;
    dependency_id UUID;
BEGIN
    -- When a task is completed, check if it unblocks other tasks
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Find tasks that depend on this one
        FOR dependent_task IN 
            SELECT id, depends_on FROM tasks 
            WHERE NEW.id = ANY(depends_on) AND status = 'blocked'
        LOOP
            -- Check if all dependencies are now complete
            IF NOT EXISTS (
                SELECT 1 FROM unnest(dependent_task.depends_on) AS dep_id
                JOIN tasks t ON t.id = dep_id
                WHERE t.status != 'completed'
            ) THEN
                -- All dependencies complete, unblock the task
                UPDATE tasks 
                SET is_blocked = FALSE, 
                    blocked_reason = NULL,
                    status = CASE WHEN status = 'blocked' THEN 'pending' ELSE status END
                WHERE id = dependent_task.id;
            END IF;
        END LOOP;
    END IF;
    
    -- When dependencies are added/changed, check if task should be blocked
    IF TG_OP = 'UPDATE' AND NEW.depends_on != OLD.depends_on THEN
        IF EXISTS (
            SELECT 1 FROM unnest(NEW.depends_on) AS dep_id
            JOIN tasks t ON t.id = dep_id
            WHERE t.status != 'completed'
        ) THEN
            NEW.is_blocked := TRUE;
            NEW.blocked_reason := 'Waiting for dependencies';
            IF NEW.status NOT IN ('blocked', 'completed', 'cancelled') THEN
                NEW.status := 'blocked';
            END IF;
        ELSE
            NEW.is_blocked := FALSE;
            NEW.blocked_reason := NULL;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for blocking relationships
DROP TRIGGER IF EXISTS trigger_update_blocking_status ON tasks;
CREATE TRIGGER trigger_update_blocking_status
    AFTER INSERT OR UPDATE OF status, depends_on ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_blocking_status();

-- =====================================================
-- SECURITY POLICIES (Row Level Security)
-- =====================================================

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policy for users to see their own tasks and assigned tasks
CREATE POLICY tasks_user_access ON tasks
    FOR ALL
    TO authenticated
    USING (
        user_id = current_setting('app.current_user_id')::UUID OR
        assignee_id = current_setting('app.current_user_id')::UUID OR
        current_setting('app.current_user_id')::UUID = ANY(collaborators)
    );

-- Policy for admin access
CREATE POLICY tasks_admin_access ON tasks
    FOR ALL
    TO authenticated
    USING (
        current_setting('app.current_user_role', true) IN ('admin', 'super_admin')
    );

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for active tasks with computed fields
CREATE OR REPLACE VIEW active_tasks AS
SELECT 
    t.*,
    CASE 
        WHEN t.due_date IS NOT NULL AND t.due_date < CURRENT_TIMESTAMP 
        THEN TRUE ELSE FALSE 
    END AS is_overdue,
    CASE 
        WHEN t.due_date IS NOT NULL 
        THEN EXTRACT(DAYS FROM (t.due_date - CURRENT_TIMESTAMP))
        ELSE NULL 
    END AS days_until_due,
    u.first_name || ' ' || u.last_name AS owner_name,
    c.name AS category_name
FROM tasks t
LEFT JOIN users u ON t.user_id = u.id
LEFT JOIN categories c ON t.category_id = c.id
WHERE t.deleted_at IS NULL 
  AND t.status NOT IN ('completed', 'cancelled', 'archived');

-- View for task analytics
CREATE OR REPLACE VIEW task_analytics AS
SELECT 
    user_id,
    COUNT(*) AS total_tasks,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_tasks,
    COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_tasks,
    COUNT(*) FILTER (WHERE due_date < CURRENT_TIMESTAMP AND status NOT IN ('completed', 'cancelled')) AS overdue_tasks,
    AVG(completion_percentage) AS avg_completion,
    AVG(productivity_score) FILTER (WHERE productivity_score IS NOT NULL) AS avg_productivity,
    AVG(actual_hours) FILTER (WHERE actual_hours IS NOT NULL) AS avg_actual_hours,
    AVG(estimated_hours) FILTER (WHERE estimated_hours IS NOT NULL) AS avg_estimated_hours
FROM tasks
WHERE deleted_at IS NULL
GROUP BY user_id;

-- =====================================================
-- SEED DATA FOR TESTING
-- =====================================================

-- Insert sample task types and priorities for reference
INSERT INTO tasks (
    id, user_id, title, description, task_type, priority, status,
    due_date, estimated_hours, tags, context_tags, energy_required,
    created_by, metadata
) VALUES 
-- Sample tasks for testing (assuming user IDs exist)
(
    uuid_generate_v4(),
    (SELECT id FROM users LIMIT 1),
    'Complete Project Documentation',
    'Write comprehensive documentation for the task management system',
    'work',
    'high',
    'in_progress',
    CURRENT_TIMESTAMP + INTERVAL '3 days',
    8.0,
    ARRAY['documentation', 'project', 'writing'],
    ARRAY['@computer', '@work'],
    'medium',
    (SELECT id FROM users LIMIT 1),
    '{"project_id": "tm-001", "client": "internal"}'::jsonb
),
(
    uuid_generate_v4(),
    (SELECT id FROM users LIMIT 1),
    'Weekly Team Meeting',
    'Discuss project progress and upcoming milestones',
    'meeting',
    'medium',
    'pending',
    CURRENT_TIMESTAMP + INTERVAL '2 days',
    1.0,
    ARRAY['meeting', 'team', 'weekly'],
    ARRAY['@office', '@meeting-room'],
    'low',
    (SELECT id FROM users LIMIT 1),
    '{"recurring": true, "attendees": ["team_lead", "developers"]}'::jsonb
),
(
    uuid_generate_v4(),
    (SELECT id FROM users LIMIT 1),
    'Review Code Changes',
    'Review pull requests from team members',
    'work',
    'medium',
    'pending',
    CURRENT_TIMESTAMP + INTERVAL '1 day',
    2.0,
    ARRAY['review', 'code', 'github'],
    ARRAY['@computer'],
    'medium',
    (SELECT id FROM users LIMIT 1),
    '{"repository": "task-management", "pr_count": 3}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON TABLE tasks IS 'Comprehensive tasks table with advanced features for task management, time tracking, collaboration, and productivity analysis';

-- Core fields
COMMENT ON COLUMN tasks.id IS 'Unique task identifier';
COMMENT ON COLUMN tasks.user_id IS 'Task owner/creator';
COMMENT ON COLUMN tasks.category_id IS 'Optional category classification';
COMMENT ON COLUMN tasks.parent_task_id IS 'Parent task for subtask hierarchies';
COMMENT ON COLUMN tasks.title IS 'Task title (required, max 500 chars)';
COMMENT ON COLUMN tasks.description IS 'Detailed task description';
COMMENT ON COLUMN tasks.task_type IS 'Type of task (personal, work, etc.)';
COMMENT ON COLUMN tasks.priority IS 'Task priority level with critical option';
COMMENT ON COLUMN tasks.status IS 'Current task status with comprehensive states';

-- Time management
COMMENT ON COLUMN tasks.due_date IS 'When the task must be completed';
COMMENT ON COLUMN tasks.start_date IS 'When the task should/can be started';
COMMENT ON COLUMN tasks.reminder_date IS 'When to send reminders';
COMMENT ON COLUMN tasks.scheduled_date IS 'When user plans to work on it';
COMMENT ON COLUMN tasks.estimated_hours IS 'Estimated time to complete (decimal hours)';
COMMENT ON COLUMN tasks.actual_hours IS 'Actual time spent (decimal hours)';
COMMENT ON COLUMN tasks.time_logged_today IS 'Hours logged today for this task';

-- Advanced features
COMMENT ON COLUMN tasks.completion_percentage IS 'Task completion percentage (0-100)';
COMMENT ON COLUMN tasks.is_recurring IS 'Whether task repeats on a schedule';
COMMENT ON COLUMN tasks.recurrence_pattern IS 'How often the task repeats';
COMMENT ON COLUMN tasks.urgency_score IS 'Calculated urgency score (0-10)';
COMMENT ON COLUMN tasks.importance_score IS 'User-defined importance (0-10)';
COMMENT ON COLUMN tasks.depends_on IS 'Array of task IDs this task depends on';
COMMENT ON COLUMN tasks.blocks IS 'Array of task IDs this task blocks';
COMMENT ON COLUMN tags IS 'Flexible tagging system for organization';
COMMENT ON COLUMN tasks.context_tags IS 'Context-based tags (@work, @home, etc.)';
COMMENT ON COLUMN tasks.energy_required IS 'Energy level needed (low/medium/high)';
COMMENT ON COLUMN tasks.search_vector IS 'Full-text search vector (auto-generated)';
COMMENT ON COLUMN tasks.metadata IS 'Flexible JSON metadata storage';
COMMENT ON COLUMN tasks.custom_fields IS 'User-defined custom fields';

-- Create completion notice
DO $$
BEGIN
    RAISE NOTICE 'Migration 007_comprehensive_tasks_table_enhanced completed successfully!';
    RAISE NOTICE 'Created enhanced tasks table with:';
    RAISE NOTICE '- Comprehensive status and priority enums';
    RAISE NOTICE '- Advanced time tracking and scheduling';
    RAISE NOTICE '- Task hierarchies and dependencies';
    RAISE NOTICE '- Recurrence support';
    RAISE NOTICE '- Collaboration features';
    RAISE NOTICE '- Full-text search optimization';
    RAISE NOTICE '- 25+ specialized indexes for performance';
    RAISE NOTICE '- Automatic triggers for data consistency';
    RAISE NOTICE '- Row-level security policies';
    RAISE NOTICE '- Analytics views';
    RAISE NOTICE '- Sample seed data';
END $$;
