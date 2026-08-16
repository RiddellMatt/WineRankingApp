import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

export interface AuthedContext {
  user: User
  admin: SupabaseClient
}

export async function requireUser(req: Request): Promise<AuthedContext | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Sign in required.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid session.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(supabaseUrl, serviceKey)
  return { user, admin }
}
