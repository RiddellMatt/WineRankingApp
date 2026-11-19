import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from './cors.ts'

export interface AuthedContext {
  user: User
  admin: SupabaseClient
}

function authError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export async function requireUser(req: Request): Promise<AuthedContext | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return authError('Sign in required.', 401)
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
    return authError('Invalid session.', 401)
  }

  const admin = createClient(supabaseUrl, serviceKey)
  return { user, admin }
}
