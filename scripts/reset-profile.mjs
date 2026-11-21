#!/usr/bin/env node
/**
 * Completely reset one profile's progress: cellar, wishlist, badges, journeys,
 * and the points computed from those, plus activity, reactions, notifications,
 * scan history, scan uploads, blocks this profile created, and friendships.
 *
 * Keeps the login, display name, email, avatar, Pro, Stripe ids, and push tokens.
 *
 * Dry-run by default. Nothing is deleted until you pass --yes.
 *
 *   npm run profile:reset -- ada@example.com
 *   npm run profile:reset -- ada@example.com --yes
 *   npm run profile:reset -- --id <uuid> --yes --keep-friends
 *
 * Reads VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment
 * or from .env.local / .env. Do not pass the service role key as an argument.
 *
 * For a single database transaction, run scripts/reset-profile.sql in the
 * Supabase SQL editor instead. This script calls the API once per table and
 * is safe to re-run if it stops halfway.
 *
 * Requires profiles.progress_generation (supabase/migrations/20261121_profile_progress_generation.sql).
 * The SQL script applies that column itself. After either path, reload the app
 * on each device so the cached cellar and badges are dropped.
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Keep in sync with the delete list in scripts/reset-profile.sql. */
export function planResetSteps({ keepFriends }) {
  const steps = [
    { table: 'notifications', match: ['recipient_id', 'actor_id'] },
    { table: 'activity_reactions', match: ['reactor_id', 'target_user_id'] },
    { table: 'activity_milestone_reactions', match: ['reactor_id', 'target_user_id'] },
    { table: 'activity_events', match: ['user_id'] },
    { table: 'user_badge_tiers', match: ['user_id'] },
    { table: 'user_journey_completions', match: ['user_id'] },
    { table: 'user_reports', match: ['reporter_id'] },
    { table: 'wines', match: ['user_id'] },
    { table: 'menu_scan_usage', match: ['user_id'] },
    { table: 'label_scan_usage', match: ['user_id'] },
    { table: 'ai_scan_events', match: ['user_id'] },
    { table: 'ai_scan_corrections', match: ['user_id'] },
  ]
  if (!keepFriends) {
    steps.push({ table: 'friendships', match: ['requester_id', 'addressee_id'] })
  }
  steps.push({ table: 'user_blocks', match: ['blocker_id'] })
  return steps
}

export function parseArgs(argv) {
  const args = {
    email: '',
    id: '',
    yes: false,
    keepFriends: false,
    help: false,
  }
  const positionals = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--yes') args.yes = true
    else if (arg === '--keep-friends') args.keepFriends = true
    else if (arg === '--help' || arg === '-h') args.help = true
    else if (arg === '--email') {
      args.email = argv[++i] ?? ''
      if (!args.email) throw new Error('--email needs a value.')
    } else if (arg === '--id') {
      args.id = argv[++i] ?? ''
      if (!args.id) throw new Error('--id needs a value.')
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option ${arg}.`)
    } else {
      positionals.push(arg)
    }
  }
  if (!args.email && !args.id && positionals.length === 1) args.email = positionals[0]
  else if (positionals.length > 0) throw new Error('Pass one email, or use --id.')
  return args
}

function helpText() {
  return `Reset a Decanti profile's cellar, badges, journeys, points, and activity.

Usage:
  npm run profile:reset -- <email> [--yes] [--keep-friends]
  npm run profile:reset -- --id <uuid> [--yes] [--keep-friends]

--yes           delete. Without it, the script only prints counts.
--keep-friends  leave friendships in place. Friend-count badges still show,
                because those tiers come from the live friend list.
`
}

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

function loadLocalEnv() {
  const root = resolve(import.meta.dirname, '..')
  loadEnvFile(resolve(root, '.env.local'))
  loadEnvFile(resolve(root, '.env'))
}

function projectUrl() {
  let url = (process.env.VITE_SUPABASE_URL ?? '').trim()
  url = url.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '')
  return url
}

function missingTable(error) {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /schema cache/i.test(error.message ?? '') ||
    /does not exist/i.test(error.message ?? '')
  )
}

function applyMatch(query, step, userId) {
  if (step.match.length === 1) return query.eq(step.match[0], userId)
  const clause = step.match.map((column) => `${column}.eq.${userId}`).join(',')
  return query.or(clause)
}

async function countStep(supabase, step, userId) {
  let query = supabase.from(step.table).select('*', { count: 'exact', head: true })
  query = applyMatch(query, step, userId)
  const { count, error } = await query
  if (error) {
    if (missingTable(error)) return null
    throw error
  }
  return count ?? 0
}

async function deleteStep(supabase, step, userId) {
  let query = supabase.from(step.table).delete({ count: 'exact' })
  query = applyMatch(query, step, userId)
  const { count, error } = await query
  if (error) {
    if (missingTable(error)) return null
    throw error
  }
  return count ?? 0
}

function escapeIlike(value) {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

async function findAuthUserIdByEmail(supabase, email) {
  const target = email.toLowerCase()
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const users = data?.users ?? []
    const found = users.find((user) => (user.email ?? '').toLowerCase() === target)
    if (found) return found.id
    if (users.length < 200) return null
  }
  return null
}

async function findProfile(supabase, args) {
  const columns = 'id, display_name, email, is_pro'
  if (args.id) {
    if (!UUID_RE.test(args.id)) throw new Error(`--id is not a uuid: ${args.id}`)
    const { data, error } = await supabase
      .from('profiles')
      .select(columns)
      .eq('id', args.id)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error(`No profile with id ${args.id}.`)
    return data
  }

  const email = args.email.trim()
  if (!email.includes('@')) throw new Error('Pass the account email, or --id <uuid>.')

  const { data, error } = await supabase
    .from('profiles')
    .select(columns)
    .ilike('email', escapeIlike(email))
  if (error) throw error
  const matches = (data ?? []).filter((row) => row.email.toLowerCase() === email.toLowerCase())
  if (matches.length > 1) {
    throw new Error(`More than one profile matches ${email}. Pass --id instead.`)
  }
  if (matches.length === 1) return matches[0]

  const authId = await findAuthUserIdByEmail(supabase, email)
  if (!authId) throw new Error(`No profile or auth user matches ${email}.`)
  const byId = await supabase.from('profiles').select(columns).eq('id', authId).maybeSingle()
  if (byId.error) throw byId.error
  if (!byId.data) throw new Error(`Auth user ${authId} has no profiles row.`)
  return byId.data
}

async function countScanUploads(supabase, userId) {
  let total = 0
  let offset = 0
  for (;;) {
    const { data, error } = await supabase.storage.from('ai-scan-uploads').list(userId, {
      limit: 100,
      offset,
    })
    if (error) {
      if (/bucket not found/i.test(error.message ?? '')) return 0
      throw error
    }
    const entries = data ?? []
    total += entries.filter((entry) => entry.id && entry.name && !entry.name.startsWith('.')).length
    if (entries.length < 100) return total
    offset += entries.length
  }
}

async function removeScanUploads(supabase, userId) {
  let removed = 0
  for (;;) {
    const { data, error } = await supabase.storage.from('ai-scan-uploads').list(userId, {
      limit: 100,
      offset: 0,
    })
    if (error) {
      if (/bucket not found/i.test(error.message ?? '')) return removed
      throw error
    }
    const names = (data ?? [])
      .filter((entry) => entry.id && entry.name && !entry.name.startsWith('.'))
      .map((entry) => `${userId}/${entry.name}`)
    if (names.length === 0) return removed
    const { error: removeError } = await supabase.storage.from('ai-scan-uploads').remove(names)
    if (removeError) throw removeError
    removed += names.length
    if (names.length < 100) return removed
  }
}

async function bumpGeneration(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('progress_generation')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    if (error.code === '42703' || /progress_generation/i.test(error.message ?? '')) {
      throw new Error(
        'profiles.progress_generation is missing. Run supabase/migrations/20261121_profile_progress_generation.sql in the SQL editor, or use scripts/reset-profile.sql which applies it and resets in one step.',
      )
    }
    throw error
  }
  const next = Number(data?.progress_generation ?? 0) + 1
  if (!Number.isFinite(next)) throw new Error('progress_generation is not a number.')
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ ranking_preference: null, progress_generation: next })
    .eq('id', userId)
  if (updateError) {
    if (updateError.code === '42703' || /ranking_preference/i.test(updateError.message ?? '')) {
      const retry = await supabase
        .from('profiles')
        .update({ progress_generation: next })
        .eq('id', userId)
      if (retry.error) throw retry.error
      return next
    }
    throw updateError
  }
  return next
}

function printStep(table, count) {
  if (count == null) {
    console.log(`  ${table}: skipped (table not in this database)`)
    return
  }
  console.log(`  ${table}: ${count}`)
}

async function main() {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    console.error(helpText())
    process.exit(1)
  }
  if (args.help) {
    console.log(helpText())
    return
  }
  if (!args.email && !args.id) {
    console.error('Pass the account email, or --id <uuid>.\n')
    console.error(helpText())
    process.exit(1)
  }

  loadLocalEnv()
  const url = projectUrl()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ''
  if (!url || !serviceKey) {
    console.error(
      'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
        'Put them in .env.local or the environment. The service role key bypasses row level security; do not prefix it with VITE_.',
    )
    process.exit(1)
  }
  if (serviceKey === process.env.VITE_SUPABASE_ANON_KEY?.trim()) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is the anon key. Reset needs the service role key.')
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const profile = await findProfile(supabase, args)
  const steps = planResetSteps({ keepFriends: args.keepFriends })
  const mode = args.yes ? 'Applying' : 'Dry run'
  console.log(`${mode} reset for ${profile.display_name || '(no name)'} <${profile.email}> (${profile.id})`)
  console.log(`Pro stays ${profile.is_pro ? 'on' : 'off'}. Login, name, avatar, and push tokens stay.`)
  if (args.keepFriends) {
    console.log('Friendships stay. Friend-count badges will still show.')
  } else {
    console.log('Friendships will be removed so friend-count badges start over.')
  }

  if (!args.yes) {
    for (const step of steps) {
      printStep(step.table, await countStep(supabase, step, profile.id))
    }
    printStep('ai-scan-uploads', await countScanUploads(supabase, profile.id))
    console.log('\nNo rows deleted. Re-run with --yes to apply.')
    return
  }

  // Bump first. If a later delete fails, the device still drops its cache
  // instead of uploading the old cellar and badges back. Re-run --yes to finish.
  const generation = await bumpGeneration(supabase, profile.id)
  console.log(`progress_generation is now ${generation}.`)

  for (const step of steps) {
    printStep(step.table, await deleteStep(supabase, step, profile.id))
  }
  printStep('ai-scan-uploads', await removeScanUploads(supabase, profile.id))
  console.log('\nReset complete. Reload the app on each device.')
}

function isMain() {
  if (!process.argv[1]) return false
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
  } catch {
    return false
  }
}

if (isMain()) {
  main().catch((error) => {
    console.error(error?.message || error)
    process.exit(1)
  })
}
