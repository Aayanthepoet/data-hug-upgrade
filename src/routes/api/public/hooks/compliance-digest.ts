// Weekly compliance digest hook. Called by pg_cron every Monday at 09:00 UTC.
// Authenticated via the dedicated CRON_SECRET in the `apikey` header.
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { generateAndDispatchDigest } from '@/lib/compliance/digest.server'

export const Route = createFileRoute('/api/public/hooks/compliance-digest')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = process.env.SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        const expectedApiKey = process.env.CRON_SECRET
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: 'Server misconfigured' }, { status: 500 })
        }
        const apiKey =
          request.headers.get('apikey') ||
          request.headers.get('authorization')?.replace(/^Bearer /, '')
        if (expectedApiKey && apiKey !== expectedApiKey) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })

        try {
          const origin = new URL(request.url).origin
          const result = await generateAndDispatchDigest(supabase, {
            dashboardUrl: `${origin}/app/opt-outs`,
          })
          return Response.json({ success: true, ...result })
        } catch (e) {
          console.error('Compliance digest failed', e)
          return Response.json(
            { error: (e as Error).message ?? 'Digest failed' },
            { status: 500 },
          )
        }
      },
    },
  },
})
