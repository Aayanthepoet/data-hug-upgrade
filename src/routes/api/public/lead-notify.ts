import * as React from 'react'
import { render } from '@react-email/components'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'PropAI'
const SENDER_DOMAIN = 'notify.www.ainetworkagency.com'
const FROM_DOMAIN = 'notify.www.ainetworkagency.com'
const TEMPLATE_NAME = 'new-lead-alert'

const schema = z.object({
  lead_id: z.string().uuid().optional(),
  full_name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional(),
  company: z.string().trim().max(120).optional(),
  message: z.string().trim().max(2000).optional(),
  source: z.string().trim().max(80).optional(),
  sms_opt_in: z.boolean().optional(),
})

export const Route = createFileRoute('/api/public/lead-notify')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400 })
        }
        const parsed = schema.safeParse(body)
        if (!parsed.success) {
          return Response.json({ error: 'Invalid payload' }, { status: 400 })
        }
        const data = parsed.data

        const supabase = createClient(supabaseUrl, serviceKey)

        // Stamp consent evidence from trusted server-side headers.
        if (data.lead_id && data.sms_opt_in) {
          const fwd = request.headers.get('x-forwarded-for') ?? ''
          const ip =
            fwd.split(',')[0]?.trim() ||
            request.headers.get('cf-connecting-ip') ||
            request.headers.get('x-real-ip') ||
            null
          const ua = request.headers.get('user-agent')?.slice(0, 500) ?? null
          await supabase
            .from('leads')
            .update({ consent_ip: ip, consent_user_agent: ua })
            .eq('id', data.lead_id)
        }

        const template = TEMPLATES[TEMPLATE_NAME]
        if (!template || !template.to) {
          return Response.json({ error: 'Template not configured' }, { status: 500 })
        }

        const messageId = crypto.randomUUID()
        const templateData = {
          fullName: data.full_name,
          email: data.email,
          company: data.company,
          message: data.message,
          source: data.source || 'website',
          submittedAt: new Date().toISOString(),
        }

        const element = React.createElement(template.component, templateData)
        const html = await render(element)
        const text = await render(element, { plainText: true })
        const subject =
          typeof template.subject === 'function'
            ? template.subject(templateData)
            : template.subject

        await supabase.from('email_send_log').insert({
          message_id: messageId,
          template_name: TEMPLATE_NAME,
          recipient_email: template.to,
          status: 'pending',
        })

        const { error: enqueueError } = await supabase.rpc('enqueue_email', {
          queue_name: 'transactional_emails',
          payload: {
            message_id: messageId,
            to: template.to,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject,
            html,
            text,
            purpose: 'transactional',
            label: TEMPLATE_NAME,
            idempotency_key: `lead-${messageId}`,
            queued_at: new Date().toISOString(),
          },
        })

        if (enqueueError) {
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: TEMPLATE_NAME,
            recipient_email: template.to,
            status: 'failed',
            error_message: 'Failed to enqueue email',
          })
          return Response.json({ error: 'Failed to enqueue' }, { status: 500 })
        }

        return Response.json({ success: true })
      },
    },
  },
})
