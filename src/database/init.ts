import { readFileSync } from 'fs';
import { join } from 'path';
import { db, DatabaseManager } from './connection';

export async function initializeDatabase() {
  try {
    console.log('🗄️ Initializing MySQL database...');

    // Test connection first
    const isConnected = await DatabaseManager.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to MySQL database');
    }

    // Read and execute schema
    const schemaSQL = readFileSync(join(import.meta.dir, 'schema.sql'), 'utf-8');
    await db.exec(schemaSQL);
    console.log('✅ Database schema created');

    // Read and execute seeds
    const seedsSQL = readFileSync(join(import.meta.dir, 'seeds.sql'), 'utf-8');
    await db.exec(seedsSQL);
    console.log('✅ Database seeded with default data');

    // Verify tables exist
    const tables = await db.all('SHOW TABLES');
    console.log(`✅ Created ${tables.length} tables:`, tables.map((t: any) => Object.values(t)[0]).join(', '));

    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    return false;
  }
}

export async function getAppSettings() {
  const query = db.query('SELECT `key`, value, data_type FROM app_settings WHERE is_public = TRUE');
  const settings = await query.all() as { key: string; value: string; data_type: string }[];

  const result: Record<string, any> = {};
  settings.forEach(setting => {
    switch (setting.data_type) {
      case 'number':
        result[setting.key] = Number(setting.value);
        break;
      case 'boolean':
        result[setting.key] = setting.value === 'true';
        break;
      case 'json':
        result[setting.key] = JSON.parse(setting.value);
        break;
      default:
        result[setting.key] = setting.value;
    }
  });

  return result;
}