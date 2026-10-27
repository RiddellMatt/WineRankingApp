#!/usr/bin/env node
/**
 * Fail fast when mobile/web builds would ship without Supabase credentials.
 * Loads .env.local the same way Vite does (simple KEY=VALUE lines).
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const envFiles = ['.env.local', '.env']

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null) process.env[key] = value
  }
}

for (const file of envFiles) {
  loadEnvFile(resolve(root, file))
}

function normalizeSupabaseProjectUrl(raw) {
  if (!raw) return ''
  let url = raw.trim()
  url = url.replace(/\/rest\/v1\/?$/i, '')
  url = url.replace(/\/+$/, '')
  return url
}

const url = normalizeSupabaseProjectUrl(process.env.VITE_SUPABASE_URL ?? '')
const key = process.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

function fail(message) {
  console.error(`\n[env check] ${message}\n`)
  process.exit(1)
}

if (!url || !key) {
  fail(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.\n' +
      'Create .env.local from .env.example and paste values from Supabase → Project Settings → API.\n' +
      'Then run: npm run cap:sync',
  )
}

if (url.includes('YOUR_PROJECT_REF') || key === 'your-anon-key-here') {
  fail('Supabase env vars are still placeholders. Update .env.local with your real project URL and anon key.')
}

if (!url.includes('.supabase.co')) {
  fail('VITE_SUPABASE_URL does not look like a Supabase project URL.')
}

if (/\/rest\/v1\/?$/i.test(process.env.VITE_SUPABASE_URL?.trim() ?? '')) {
  console.warn(
    '[env check] VITE_SUPABASE_URL includes /rest/v1 — use the project URL from Supabase → Settings → API (build will strip the suffix).',
  )
}

if (!key.startsWith('eyJ')) {
  fail('VITE_SUPABASE_ANON_KEY does not look like a Supabase anon JWT.')
}

console.log('[env check] Supabase env vars present.')
