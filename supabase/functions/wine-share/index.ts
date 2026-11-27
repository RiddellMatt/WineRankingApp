import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { renderWineShareHtml } from '../_shared/wineShareHtml.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 })
  }

  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!UUID_RE.test(id)) {
    return htmlResponse(
      renderWineShareHtml({ wineName: 'Decanti', scoreLabel: 'Wine ranking' }),
      404,
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return htmlResponse(
      renderWineShareHtml({ wineName: 'Decanti', scoreLabel: 'Wine ranking' }),
      503,
    )
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const { data, error } = await admin
    .from('wine_shares')
    .select('wine_name, winery, vintage, score_label, image_path, referral_code')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    return htmlResponse(
      renderWineShareHtml({ wineName: 'Decanti', scoreLabel: 'This share is no longer available' }),
      404,
    )
  }

  const imageUrl = data.image_path
    ? `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/share-cards/${data.image_path}`
    : null

  const body = renderWineShareHtml({
    wineName: String(data.wine_name ?? 'A wine'),
    winery: String(data.winery ?? ''),
    vintage: String(data.vintage ?? ''),
    scoreLabel: String(data.score_label ?? ''),
    imageUrl,
    referralCode: data.referral_code ? String(data.referral_code) : null,
  })

  if (req.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
  return htmlResponse(body)
})
