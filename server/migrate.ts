// Script to migrate the database schema to add secure_id column
import { pool, db } from "./db";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";

async function migrateDatabase() {
  console.log("Starting migration...");
  
  try {
    // First check if the secure_id column exists
    const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'debates' 
      AND column_name = 'secure_id'
    `);
    
    // If column doesn't exist, add it
    if (checkResult.rows.length === 0) {
      console.log("Adding secure_id column to debates table...");
      
      // Add the column
      await pool.query(`
        ALTER TABLE debates 
        ADD COLUMN secure_id TEXT;
      `);
      
      // Now populate existing records with secure IDs
      console.log("Populating secure IDs for existing debates...");
      const existingDebates = await pool.query(`
        SELECT id FROM debates
      `);
      
      // Update each debate with a unique secure ID
      for (const debate of existingDebates.rows) {
        const secureId = nanoid(16);
        await pool.query(`
          UPDATE debates 
          SET secure_id = $1 
          WHERE id = $2
        `, [secureId, debate.id]);
      }
      
      // Finally, add NOT NULL and UNIQUE constraints
      console.log("Adding constraints to secure_id column...");
      await pool.query(`
        ALTER TABLE debates 
        ALTER COLUMN secure_id SET NOT NULL,
        ADD CONSTRAINT debates_secure_id_unique UNIQUE (secure_id);
      `);
      
      console.log("Migration completed successfully!");
    } else {
      console.log("secure_id column already exists, no migration needed.");
    }
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    // Close the connection pool when done
    await pool.end();
  }
}

// Run the migration
migrateDatabase().catch(console.error);