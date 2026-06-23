// Weekly compliance digest hook. Called by pg_cron every Monday at 09:00 UTC.
// Authenticated via the Supabase publishable key in the `apikey` header.
//
// Computes opt-out stats for the prior 7 days (and the 7 days before that for
// week-over-week delta), stores a `compliance_digests` snapshot, and enqueues
// a transactional email to every admin user.
import * as React from 'react'
import { render } from '@react-email/components'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'PropAI Compliance'
const SENDER_DOMAIN = 'notify.www.ainetworkagency.com'
const FROM_DOMAIN = 'notify.www.ainetworkagency.com'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const Route = createFileRoute('/api/public/hooks/compliance-digest')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = process.env.SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        const expectedApiKey = process.env.SUPABASE_PUBLISHABLE_KEY
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: 'Server misconfigured' }, { status: 500 })
        }
        const apiKey = request.headers.get('apikey') || request.headers.get('authorization')?.replace(/^Bearer /, '')
        if (expectedApiKey && apiKey !== expectedApiKey) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })

        // Compute time windows
        const now = new Date()
        const periodEnd = now
        const periodStart = new Date(now.getTime() - 7 * 86400000)
        const priorStart = new Date(periodStart.getTime() - 7 * 86400000)

        // Opt-outs this week vs last week
        const [thisWeekRes, lastWeekRes, blockedRes] = await Promise.all([
          supabase
            .from('sms_opt_outs')
            .select('keyword', { count: 'exact' })
            .gte('opted_out_at', periodStart.toISOString())
            .lt('opted_out_at', periodEnd.toISOString()),
          supabase
            .from('sms_opt_outs')
            .select('id', { count: 'exact', head: true })
            .gte('opted_out_at', priorStart.toISOString())
            .lt('opted_out_at', periodStart.toISOString()),
          supabase
            .from('outreach_messages')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'blocked')
            .gte('created_at', periodStart.toISOString())
            .lt('created_at', periodEnd.toISOString()),
        ])

        const optOutsThisWeek = thisWeekRes.count ?? 0
        const optOutsLastWeek = lastWeekRes.count ?? 0
        const blockedSends = blockedRes.count ?? 0
        const deltaPct =
          optOutsLastWeek === 0
            ? optOutsThisWeek > 0
              ? 100
              : 0
            : Math.round(((optOutsThisWeek - optOutsLastWeek) / optOutsLastWeek) * 100)

        // Keyword breakdown
        const kwMap = new Map<string, number>()
        for (const row of thisWeekRes.data ?? []) {
          const k = (row.keyword || 'OTHER').toUpperCase()
          kwMap.set(k, (kwMap.get(k) ?? 0) + 1)
        }
        const keywordBreakdown = Array.from(kwMap.entries())
          .map(([keyword, count]) => ({ keyword, count }))
          .sort((a, b) => b.count - a.count)

        const stats = {
          optOutsThisWeek,
          optOutsLastWeek,
          deltaPct,
          blockedSends,
          keywordBreakdown,
        }

        // Persist digest snapshot (idempotent on period_start)
        const { data: digest, error: digestErr } = await supabase
          .from('compliance_digests')
          .upsert(
            {
              period_start: periodStart.toISOString(),
              period_end: periodEnd.toISOString(),
              stats,
            },
            { onConflict: 'period_start' },
          )
          .select('id')
          .single()
        if (digestErr) {
          console.error('Failed to store digest', digestErr)
          return Response.json({ error: 'Failed to store digest' }, { status: 500 })
        }

        // Find admin recipients
        const { data: admins } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin')
        const adminIds = (admins ?? []).map((a) => a.user_id)
        let recipients: Array<{ id: string; email: string }> = []
        if (adminIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, email')
            .in('id', adminIds)
          recipients = (profs ?? [])
            .filter((p): p is { id: string; email: string } => !!p.email)
        }

        // Render once
        const tpl = TEMPLATES['compliance-digest']
        const origin = new URL(request.url).origin
        const dashboardUrl = `${origin}/app/opt-outs`
        const tplData = { ...stats, periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString(), dashboardUrl }
        const element = React.createElement(tpl.component, tplData)
        const html = await render(element)
        const text = await render(element, { plainText: true })
        const subject = typeof tpl.subject === 'function' ? tpl.subject(tplData) : tpl.subject

        let queued = 0
        let suppressed = 0
        for (const r of recipients) {
          const email = r.email.toLowerCase()
          const { data: supp } = await supabase
            .from('suppressed_emails')
            .select('id')
            .eq('email', email)
            .maybeSingle()
          if (supp) {
            suppressed++
            continue
          }

          // Ensure unsubscribe token
          const { data: existing } = await supabase
            .from('email_unsubscribe_tokens')
            .select('token, used_at')
            .eq('email', email)
            .maybeSingle()
          let token = existing?.token
          if (!token || existing?.used_at) {
            token = generateToken()
            await supabase
              .from('email_unsubscribe_tokens')
              .upsert({ token, email }, { onConflict: 'email', ignoreDuplicates: true })
            const { data: stored } = await supabase
              .from('email_unsubscribe_tokens')
              .select('token')
              .eq('email', email)
              .maybeSingle()
            if (stored?.token) token = stored.token
          }

          const messageId = crypto.randomUUID()
          const idempotencyKey = `compliance-digest-${digest.id}-${r.id}`
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: 'compliance-digest',
            recipient_email: email,
            status: 'pending',
          })
          const { error: enqueueErr } = await supabase.rpc('enqueue_email', {
            queue_name: 'transactional_emails',
            payload: {
              message_id: messageId,
              to: email,
              from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
              sender_domain: SENDER_DOMAIN,
              subject,
              html,
              text,
              purpose: 'transactional',
              label: 'compliance-digest',
              idempotency_key: idempotencyKey,
              unsubscribe_token: token,
              queued_at: new Date().toISOString(),
            },
          })
          if (enqueueErr) {
            console.error('Failed to enqueue digest', enqueueErr)
          } else {
            queued++
          }
        }

        return Response.json({
          success: true,
          digest_id: digest.id,
          stats,
          recipients: recipients.length,
          queued,
          suppressed,
        })
      },
    },
  },
})
