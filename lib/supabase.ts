// lib/supabase.ts — Supabase client factory (SSR-safe)
import { createClient } from '@supabase/supabase-js'
import { createServerClient, createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ── Browser client — use in 'use client' components ──
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}

// ── Server client — use in Server Components & Route Handlers ──
export function createSupabaseServerClient(cookieStore: any) {
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value },
      set(name: string, value: string, options: any) {
        try { cookieStore.set({ name, value, ...options }) } catch (_) {}
      },
      remove(name: string, options: any) {
        try { cookieStore.set({ name, value: '', ...options }) } catch (_) {}
      },
    },
  })
}

// ── Admin/service-role client — bypasses RLS, server-only ──
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Storage helpers ──
export const BUCKETS = {
  listingPhotos: 'listing-photos',
  documents: 'documents',
  inspectionReports: 'inspection-reports',
  bolDocuments: 'bol-documents',
} as const

export async function uploadFile(bucket: string, path: string, file: File) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, file, { upsert: true })
  if (error) throw error
  return supabaseAdmin.storage.from(bucket).getPublicUrl(data.path).data.publicUrl
}
