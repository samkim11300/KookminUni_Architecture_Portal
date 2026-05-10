// Supabase configuration and store implementation
import { createClient } from '@supabase/supabase-js'

// Get credentials from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
// ⚠️ 보안 주의: VITE_ 접두사가 붙은 환경변수는 브라우저 번들에 포함되어 누구나 볼 수 있습니다.
// Service Role Key는 모든 RLS 정책을 우회하므로 클라이언트에서 사용하면 안 됩니다.
// 근본적 해결책: 파일 업로드를 백엔드(서버 함수)에서 처리하거나,
//               Supabase Storage 정책을 Anon Key로도 동작하도록 수정하세요.
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''

// Create Supabase client (anon — for DB operations)
export const supabase = supabaseUrl
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Admin client for Storage operations (bypasses RLS)
const supabaseAdmin = supabase && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : supabase

// Supabase Store API
export const supabaseStore = {
  /**
   * Retrieve data by key
   * @param {string} key - The key to retrieve
   * @returns {Promise<any|null>} The value associated with the key, or null if not found
   */
  async get(key) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('portal_data')
        .select('value')
        .eq('key', key)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw error
      }

      return data?.value || null
    } catch (error) {
      console.error(`Supabase get error (${key}):`, error)
      return null
    }
  },

  /**
   * Create or update data
   * @param {string} key - The key to set
   * @param {any} value - The value to set (null deletes the row)
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async set(key, value) {
    if (!supabase) return false;
    try {
      // If value is null or undefined, delete the row
      if (value === null || value === undefined) {
        const { error } = await supabase
          .from('portal_data')
          .delete()
          .eq('key', key)

        if (error) throw error
        return true
      }

      // Upsert the value (insert or update)
      const { error } = await supabase
        .from('portal_data')
        .upsert({ key, value }, { onConflict: 'key' })

      if (error) throw error
      return true
    } catch (error) {
      console.error(`Supabase set error (${key}):`, error)
      return false
    }
  },

  /**
   * Update data (merge objects)
   * @param {string} key - The key to update
   * @param {object} value - The value to merge with existing data
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async update(key, value) {
    if (!supabase) return false;
    try {
      // Get existing data
      const existing = await this.get(key)

      // Merge objects (if existing is an object)
      const merged = typeof existing === 'object' && existing !== null
        ? { ...existing, ...value }
        : value

      // Set merged value
      return await this.set(key, merged)
    } catch (error) {
      console.error(`Supabase update error (${key}):`, error)
      return false
    }
  },

  /**
   * Add a new child with auto-generated ID
   * @param {string} key - The parent key
   * @param {any} value - The value to add
   * @returns {Promise<string|null>} The generated ID, or null if failed
   */
  async push(key, value) {
    if (!supabase) return null;
    try {
      // Generate a unique ID (timestamp + random string)
      const timestamp = Date.now()
      const random = Math.random().toString(36).substr(2, 9)
      const newKey = `${timestamp}_${random}`

      // Get existing data (should be an object with child IDs as keys)
      const existing = await this.get(key)
      const data = (typeof existing === 'object' && existing !== null) ? existing : {}

      // Add new child
      data[newKey] = value

      // Save updated object
      await this.set(key, data)

      return newKey
    } catch (error) {
      console.error(`Supabase push error (${key}):`, error)
      return null
    }
  },

  /**
   * Delete data at key
   * @param {string} key - The key to delete
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async remove(key) {
    if (!supabase) return false;
    try {
      const { error } = await supabase
        .from('portal_data')
        .delete()
        .eq('key', key)

      if (error) throw error
      return true
    } catch (error) {
      console.error(`Supabase remove error (${key}):`, error)
      return false
    }
  },

  /**
   * Subscribe to real-time changes for a specific key
   * @param {string} key - The key to subscribe to
   * @param {Function} callback - Callback function to receive updates
   * @returns {Function} Unsubscribe function
   */
  subscribe(key, callback) {
    if (!supabase) return () => {};
    // Create a unique channel name for this subscription
    const channelName = `portal_data:${key}`

    // Subscribe to PostgreSQL changes
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // All events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'portal_data',
          filter: `key=eq.${key}`
        },
        (payload) => {
          // Handle different event types
          if (payload.eventType === 'DELETE') {
            callback(null)
          } else {
            callback(payload.new?.value || null)
          }
        }
      )
      .subscribe()

    // Return unsubscribe function
    return () => {
      supabase.removeChannel(channel)
    }
  },

  /**
   * List all keys matching a prefix
   * @param {string} prefix - The prefix to match
   * @returns {Promise<Array>} Array of objects with 'name' property (key names)
   */
  async listByPrefix(prefix) {
    if (!supabase) return [];
    try {
      // Use LIKE query with wildcard
      const { data, error } = await supabase
        .from('portal_data')
        .select('key')
        .like('key', `${prefix}%`)

      if (error) throw error

      // Transform to array of {name} objects
      return (data || []).map(row => ({ name: row.key }))
    } catch (error) {
      console.error(`Supabase listByPrefix error (${prefix}):`, error)
      return []
    }
  }
}

// ─── Certificate File Storage ────────────────────────────────────
const CERT_BUCKET = 'certificates'

export const certificateStorage = {
  async upload(studentId, file) {
    if (!supabaseAdmin) return { path: null, error: 'Supabase not configured' };
    try {
      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = `${studentId}/${timestamp}_${safeName}`

      const { data, error } = await supabaseAdmin.storage
        .from(CERT_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })

      if (error) throw error
      return { path: data.path, error: null }
    } catch (err) {
      console.error('Certificate upload error:', err)
      return { path: null, error: err.message }
    }
  },

  async getSignedUrl(filePath, expiresIn = 3600) {
    if (!supabaseAdmin) return null;
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(CERT_BUCKET)
        .createSignedUrl(filePath, expiresIn)

      if (error) throw error
      return data.signedUrl
    } catch (err) {
      console.error('Certificate signed URL error:', err)
      return null
    }
  },

  async download(filePath) {
    if (!supabaseAdmin) return null;
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(CERT_BUCKET)
        .download(filePath)

      if (error) throw error
      return data // Blob
    } catch (err) {
      console.error('Certificate download error:', err)
      return null
    }
  },

  async remove(filePath) {
    if (!supabaseAdmin) return false;
    try {
      const { error } = await supabaseAdmin.storage
        .from(CERT_BUCKET)
        .remove([filePath])

      if (error) throw error
      return true
    } catch (err) {
      console.error('Certificate delete error:', err)
      return false
    }
  },
}

// ─── Form File Storage ────────────────────────────────────────────
const FORMS_BUCKET = 'forms'

export const formStorage = {
  async upload(file, customName) {
    if (!supabaseAdmin) return { path: null, error: 'Supabase not configured' };
    try {
      const timestamp = Date.now()
      const displayName = customName || file.name
      const safeName = displayName.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = `${timestamp}_${safeName}`

      const { data, error } = await supabaseAdmin.storage
        .from(FORMS_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'application/pdf',
        })

      if (error) throw error
      return { path: data.path, error: null }
    } catch (err) {
      console.error('Form upload error:', err)
      return { path: null, error: err.message }
    }
  },

  async getSignedUrl(filePath, expiresIn = 3600) {
    if (!supabaseAdmin) return null;
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(FORMS_BUCKET)
        .createSignedUrl(filePath, expiresIn)

      if (error) throw error
      return data.signedUrl
    } catch (err) {
      console.error('Form signed URL error:', err)
      return null
    }
  },

  async remove(filePath) {
    if (!supabaseAdmin) return false;
    try {
      const { error } = await supabaseAdmin.storage
        .from(FORMS_BUCKET)
        .remove([filePath])

      if (error) throw error
      return true
    } catch (err) {
      console.error('Form file delete error:', err)
      return false
    }
  },
}

// Export as default
export default supabaseStore
