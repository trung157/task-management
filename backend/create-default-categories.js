const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function createDefaultCategories() {
  try {
    console.log('🔄 Creating default categories...');
    
    // Get the first user (for demo purposes)
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) {
      console.log('❌ No users found. Please create a user first.');
      await pool.end();
      return;
    }
    
    const userId = userResult.rows[0].id;
    console.log(`👤 Using user ID: ${userId}`);
    
    // Check current categories for this user
    const existing = await pool.query('SELECT * FROM categories WHERE user_id = $1', [userId]);
    console.log(`📊 Found ${existing.rows.length} existing categories for this user`);
    
    if (existing.rows.length === 0) {
      // Create default categories for this user
      const result = await pool.query(`
        INSERT INTO categories (name, description, color, icon, is_default, sort_order, user_id)
        VALUES 
          ('Work', 'Work related tasks', '#3B82F6', 'work', true, 1, $1),
          ('Personal', 'Personal tasks', '#10B981', 'person', false, 2, $1),
          ('Shopping', 'Shopping lists and tasks', '#F59E0B', 'shopping', false, 3, $1),
          ('Health', 'Health and fitness tasks', '#EF4444', 'health', false, 4, $1)
        RETURNING *
      `, [userId]);
      
      console.log(`✅ Created ${result.rows.length} default categories`);
      result.rows.forEach(cat => {
        console.log(`   - ${cat.name} (${cat.color})`);
      });
    } else {
      console.log('ℹ️  User already has categories');
    }
    
    // Show all categories for this user
    const all = await pool.query('SELECT * FROM categories WHERE user_id = $1 ORDER BY sort_order', [userId]);
    console.log(`\n📝 User categories (${all.rows.length}):`);
    all.rows.forEach(cat => {
      console.log(`   - ${cat.name} ${cat.is_default ? '(default)' : ''}`);
    });
    
    await pool.end();
    console.log('\n🎉 Done!');
    
  } catch (err) {
    console.error('❌ Error creating default categories:', err.message);
    await pool.end();
    process.exit(1);
  }
}

createDefaultCategories();
