const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function testQuery() {
  try {
    const userId = '273e6d25-2937-4a29-85f1-9322c078953b';
    console.log('Testing categories query for user:', userId);
    
    const result = await pool.query(`
      SELECT c.*, 
             COALESCE(task_counts.task_count, 0) as task_count,
             COALESCE(task_counts.completed_task_count, 0) as completed_task_count
      FROM categories c
      LEFT JOIN (
        SELECT category_id,
               COUNT(*) as task_count,
               COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_task_count
        FROM tasks 
        WHERE user_id = $1
        GROUP BY category_id
      ) task_counts ON c.id = task_counts.category_id
      WHERE c.user_id = $1
      ORDER BY c.sort_order ASC
    `, [userId]);
    
    console.log('Query result:', result.rows.length, 'categories');
    result.rows.forEach(cat => {
      console.log('- ', cat.name, cat.user_id);
    });
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
  }
}

testQuery();
