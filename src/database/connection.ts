import mysql from 'mysql2/promise';

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  charset: string;
  timezone: string;
  connectionLimit: number;
  acquireTimeout: number;
  timeout: number;
}

export class DatabaseManager {
  private static instance: mysql.Pool;
  private static config: DatabaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'classic_web_fotos',
    charset: 'utf8mb4',
    timezone: '+00:00',
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
  };

  public static getInstance(): mysql.Pool {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = mysql.createPool({
        host: DatabaseManager.config.host,
        port: DatabaseManager.config.port,
        user: DatabaseManager.config.user,
        password: DatabaseManager.config.password,
        database: DatabaseManager.config.database,
        charset: DatabaseManager.config.charset,
        timezone: DatabaseManager.config.timezone,
        connectionLimit: DatabaseManager.config.connectionLimit,
        waitForConnections: true,
        queueLimit: 0,
        multipleStatements: true,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      });

      console.log(`🗄️ MySQL connection pool created for ${DatabaseManager.config.database}`);
    }
    return DatabaseManager.instance;
  }

  public static async close(): Promise<void> {
    if (DatabaseManager.instance) {
      await DatabaseManager.instance.end();
      console.log('🗄️ MySQL connection pool closed');
    }
  }

  public static async testConnection(): Promise<boolean> {
    try {
      const pool = DatabaseManager.getInstance();
      const connection = await pool.getConnection();
      await connection.ping();
      connection.release();
      console.log('✅ MySQL connection test successful');
      return true;
    } catch (error) {
      console.error('❌ MySQL connection test failed:', error);
      return false;
    }
  }
}

// MySQL Query Helper - to maintain compatibility with existing code
export class QueryHelper {
  private pool: mysql.Pool;

  constructor() {
    this.pool = DatabaseManager.getInstance();
  }

  // Execute a single query (for INSERT, UPDATE, DELETE)
  async run(sql: string, params: any[] = []): Promise<{ lastInsertRowid?: number; changes?: number }> {
    try {
      const [result] = await this.pool.execute(sql, params);
      const mysqlResult = result as mysql.ResultSetHeader;

      return {
        lastInsertRowid: mysqlResult.insertId,
        changes: mysqlResult.affectedRows
      };
    } catch (error) {
      console.error('Query execution error:', error);
      throw error;
    }
  }

  // Get a single row
  async get(sql: string, params: any[] = []): Promise<any> {
    try {
      const [rows] = await this.pool.execute(sql, params);
      const results = rows as any[];
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error('Query get error:', error);
      throw error;
    }
  }

  // Get all rows
  async all(sql: string, params: any[] = []): Promise<any[]> {
    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows as any[];
    } catch (error) {
      console.error('Query all error:', error);
      throw error;
    }
  }

  // Execute raw SQL (for schema creation, etc.)
  async exec(sql: string): Promise<void> {
    try {
      // Remove comments and split by semicolon, then filter out empty statements
      const statements = sql
        .split('\n')
        .filter(line => !line.trim().startsWith('--') && line.trim())
        .join('\n')
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      console.log(`Executing ${statements.length} SQL statements...`);

      for (const statement of statements) {
        console.log('Executing:', statement.substring(0, 100) + '...');
        await this.pool.query(statement);
      }
    } catch (error) {
      console.error('Exec error:', error);
      throw error;
    }
  }

  // Create a query builder for prepared statements
  query(sql: string) {
    return {
      run: (params: any[] = []) => this.run(sql, params),
      get: (params: any[] = []) => this.get(sql, params),
      all: (params: any[] = []) => this.all(sql, params)
    };
  }
}

export const db = new QueryHelper();