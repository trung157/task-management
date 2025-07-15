#!/usr/bin/env ts-node

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import config from '../config/config';
import { connectDatabase, closeDatabase } from '../db';
import { logger } from '../utils/logger';
import pool from '../db';

/**
 * Database seeding script
 * Run with: npm run db:seed
 */

async function seedDatabase() {
  try {
    await connectDatabase();
    logger.info('Starting database seeding...');

    // Create demo users
    const demoUsers = [
      {
        id: uuidv4(),
        firstName: 'Demo',
        lastName: 'User',
        email: 'demo@taskflow.com',
        password: 'Demo123!@#',
        role: 'user',
      },
      {
        id: uuidv4(),
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@taskflow.com',
        password: 'Admin123!@#',
        role: 'admin',
      },
    ];

    for (const user of demoUsers) {
      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [user.email]
      );

      if (existingUser.rows.length > 0) {
        logger.info(`User ${user.email} already exists, skipping...`);
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(user.password, config.security.bcryptRounds);

      // Create user
      await pool.query(
        `INSERT INTO users (id, first_name, last_name, email, password_hash, role, email_verified, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, true, true, NOW(), NOW())`,
        [user.id, user.firstName, user.lastName, user.email, hashedPassword, user.role]
      );

      logger.info(`Created user: ${user.email}`);

      // Create demo tags for the user
      const demoTags = [
        { name: 'work', color: '#3b82f6', description: 'Work related tasks' },
        { name: 'personal', color: '#10b981', description: 'Personal tasks' },
        { name: 'urgent', color: '#ef4444', description: 'Urgent tasks' },
        { name: 'shopping', color: '#f59e0b', description: 'Shopping list items' },
        { name: 'health', color: '#8b5cf6', description: 'Health and fitness' },
      ];

      const createdTags = [];
      for (const tag of demoTags) {
        const tagId = uuidv4();
        await pool.query(
          `INSERT INTO tags (id, user_id, name, color, description, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           ON CONFLICT (user_id, name) DO NOTHING`,
          [tagId, user.id, tag.name, tag.color, tag.description]
        );
        createdTags.push({ id: tagId, ...tag });
      }

      // Create demo tasks for the user
      const demoTasks = [
        {
          title: 'Complete project documentation',
          description: 'Write comprehensive documentation for the TaskFlow project',
          priority: 'high',
          status: 'in_progress',
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          tags: ['work'],
        },
        {
          title: 'Buy groceries',
          description: 'Milk, bread, eggs, fruits, vegetables',
          priority: 'medium',
          status: 'pending',
          due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
          tags: ['personal', 'shopping'],
        },
        {
          title: 'Exercise routine',
          description: '30 minutes cardio and strength training',
          priority: 'medium',
          status: 'pending',
          due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // tomorrow
          tags: ['personal', 'health'],
        },
        {
          title: 'Team meeting preparation',
          description: 'Prepare slides and agenda for the weekly team meeting',
          priority: 'high',
          status: 'pending',
          due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
          tags: ['work', 'urgent'],
        },
        {
          title: 'Plan vacation',
          description: 'Research destinations and book flights and accommodation',
          priority: 'low',
          status: 'pending',
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          tags: ['personal'],
        },
        {
          title: 'Code review',
          description: 'Review pull requests from team members',
          priority: 'medium',
          status: 'completed',
          due_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // yesterday
          tags: ['work'],
        },
      ];

      for (const task of demoTasks) {
        const taskId = uuidv4();
        
        // Create task
        await pool.query(
          `INSERT INTO tasks (id, user_id, title, description, priority, status, due_date, completed_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
          [
            taskId,
            user.id,
            task.title,
            task.description,
            task.priority,
            task.status,
            task.due_date,
            task.status === 'completed' ? new Date() : null,
          ]
        );

        // Add tags to task
        for (const tagName of task.tags) {
          const tag = createdTags.find(t => t.name === tagName);
          if (tag) {
            await pool.query(
              `INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2)
               ON CONFLICT DO NOTHING`,
              [taskId, tag.id]
            );
          }
        }
      }

      logger.info(`Created ${demoTasks.length} demo tasks for ${user.email}`);
    }

    logger.info('Database seeding completed successfully');
    logger.info('Demo credentials:');
    logger.info('User: demo@taskflow.com / Demo123!@#');
    logger.info('Admin: admin@taskflow.com / Admin123!@#');

  } catch (error) {
    logger.error('Database seeding failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Run seeding if this script is executed directly
if (require.main === module) {
  seedDatabase();
}

export { seedDatabase };
