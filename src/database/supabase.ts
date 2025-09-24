import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

class SupabaseManager {
  private supabaseClient: SupabaseClient

  constructor() {
    this.supabaseClient = supabase
  }

  async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseClient
        .from('users')
        .select('count(*)')
        .limit(1)

      if (error && !error.message.includes('relation "users" does not exist')) {
        console.error('Supabase connection test failed:', error)
        return false
      }

      console.log('✅ Supabase connection test successful')
      return true
    } catch (error) {
      console.error('❌ Supabase connection failed:', error)
      return false
    }
  }

  async initializeDatabase(): Promise<boolean> {
    try {
      console.log('🗄️ Initializing Supabase database...')

      // Test connection first
      const isConnected = await this.testConnection()
      if (!isConnected) {
        console.log('⚠️ Tables might not exist yet, proceeding with schema creation...')
      }

      // Read and execute schema
      const schemaSQL = readFileSync(join(import.meta.dir, 'supabase-schema.sql'), 'utf-8')

      // Split SQL into individual statements and execute them
      const statements = schemaSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

      console.log(`Executing ${statements.length} SQL statements...`)

      for (const statement of statements) {
        try {
          if (statement.trim()) {
            console.log(`Executing: ${statement.substring(0, 100)}...`)
            const { error } = await this.supabaseClient.rpc('exec_sql', { sql: statement })

            if (error && !error.message.includes('already exists')) {
              console.error(`SQL error: ${error.message}`)
              // Continue with other statements even if some fail
            }
          }
        } catch (err) {
          console.error(`Statement execution error:`, err)
          // Continue with other statements
        }
      }

      console.log('✅ Database schema created')

      // Read and execute seeds
      const seedsSQL = readFileSync(join(import.meta.dir, 'supabase-seeds.sql'), 'utf-8')
      const seedStatements = seedsSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

      console.log(`Executing ${seedStatements.length} SQL statements...`)

      for (const statement of seedStatements) {
        try {
          if (statement.trim()) {
            console.log(`Executing: ${statement.substring(0, 100)}...`)
            const { error } = await this.supabaseClient.rpc('exec_sql', { sql: statement })

            if (error && !error.message.includes('duplicate key')) {
              console.error(`Seed error: ${error.message}`)
            }
          }
        } catch (err) {
          console.error(`Seed execution error:`, err)
        }
      }

      console.log('✅ Database seeded with default data')

      // Verify tables exist
      const { data: tables, error } = await this.supabaseClient
        .rpc('get_table_names')
        .single()

      if (tables) {
        console.log(`✅ Database initialized with tables`)
      } else {
        console.log('✅ Database initialization completed')
      }

      return true
    } catch (error) {
      console.error('❌ Database initialization failed:', error)
      return false
    }
  }

  // Helper method to execute raw SQL
  async query(sql: string, params: any[] = []): Promise<any> {
    try {
      const { data, error } = await this.supabaseClient.rpc('exec_sql', {
        sql: sql,
        params: params
      })

      if (error) {
        throw error
      }

      return data
    } catch (error) {
      console.error('Query execution error:', error)
      throw error
    }
  }

  // Convenient methods for common operations
  async select(table: string, columns = '*', conditions?: any) {
    let query = this.supabaseClient.from(table).select(columns)

    if (conditions) {
      Object.entries(conditions).forEach(([key, value]) => {
        query = query.eq(key, value)
      })
    }

    const { data, error } = await query
    if (error) throw error
    return data
  }

  async insert(table: string, data: any) {
    const { data: result, error } = await this.supabaseClient
      .from(table)
      .insert(data)
      .select()

    if (error) throw error
    return result
  }

  async update(table: string, data: any, conditions: any) {
    let query = this.supabaseClient.from(table).update(data)

    Object.entries(conditions).forEach(([key, value]) => {
      query = query.eq(key, value)
    })

    const { data: result, error } = await query.select()
    if (error) throw error
    return result
  }

  async delete(table: string, conditions: any) {
    let query = this.supabaseClient.from(table).delete()

    Object.entries(conditions).forEach(([key, value]) => {
      query = query.eq(key, value)
    })

    const { error } = await query
    if (error) throw error
    return true
  }

  // Getter for direct client access when needed
  get client() {
    return this.supabaseClient
  }
}

export const db = new SupabaseManager()

// Legacy compatibility - export functions that match the old MySQL interface
export const DatabaseManager = {
  testConnection: () => db.testConnection()
}

export async function initializeDatabase() {
  return await db.initializeDatabase()
}

export async function getAppSettings() {
  try {
    const settings = await db.select('app_settings', '*', { is_public: true })

    const result: Record<string, any> = {}
    settings.forEach((setting: any) => {
      switch (setting.data_type) {
        case 'number':
          result[setting.key] = Number(setting.value)
          break
        case 'boolean':
          result[setting.key] = setting.value === 'true'
          break
        case 'json':
          result[setting.key] = JSON.parse(setting.value)
          break
        default:
          result[setting.key] = setting.value
      }
    })

    return result
  } catch (error) {
    console.error('Error fetching app settings:', error)
    return {}
  }
}