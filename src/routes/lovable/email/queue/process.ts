import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { Resend } from 'resend'
import { publicBaseUrl } from '@/lib/public-url.server'

const MAX_RETRIES = 5
const DEFAULT_BATCH_SIZE = 10
const DEFAULT_SEND_DELAY_MS = 200
const DEFAULT_AUTH_TTL_MINUTES = 15
const DEFAULT_TRANSACTIONAL_TTL_MINUTES = 60

// Resend reports failures as { error: { message, statusCode, name } } rather than
// throwing, so the send site rethrows with `status` and `code` attached. `code` is
// Resend's error name, which is the more reliable signal — statusCode is nullable.
function isRateLimited(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const e = error as { status?: number | null; code?: string }
    if (e.status === 429) return true
    if (e.code === 'rate_limit_exceeded') return true
  }
  return error instanceof Error && error.message.includes('429')
}

// Permanent auth or sender-configuration failures. Retrying won't help, and every
// other message in the batch will hit the same wall, so DLQ this one and stop.
function isForbidden(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const e = error as { status?: number | null; code?: string }
    if (e.status === 403 || e.status === 401) return true
    if (
      e.code === 'restricted_api_key' ||
      e.code === 'invalid_api_key' ||
      e.code === 'missing_api_key' ||
      e.code === 'invalid_access' ||
      e.code === 'invalid_from_address'
    ) {
      return true
    }
  }
  return error instanceof Error && error.message.includes('403')
}

// Permanently malformed message — bad recipient, missing field, oversized payload.
// Scoped to this message alone, so DLQ it and carry on with the rest of the batch.
function isInvalidMessage(error: unknown): boolean {
  if (error && typeof error === 'object') {
    return (error as { code?: string }).code === 'validation_error'
  }
  return false
}

// Extract Retry-After seconds from a rethrown Resend error, or default to 60s.
function getRetryAfterSeconds(error: unknown): number {
  if (error && typeof error === 'object' && 'retryAfterSeconds' in error) {
    return (error as { retryAfterSeconds: number | null }).retryAfterSeconds ?? 60
  }
  return 60
}

// Resend surfaces rate-limit backoff on the response headers, not in the error body.
function parseRetryAfter(headers: Record<string, string> | null): number | null {
  const raw = headers?.['retry-after'] ?? headers?.['ratelimit-reset']
  const secs = raw ? Number.parseInt(raw, 10) : Number.NaN
  return Number.isFinite(secs) && secs > 0 ? secs : null
}

async function moveToDlq(
  supabase: SupabaseClient<any, any>,
  queue: string,
  msg: { msg_id: number; message: Record<string, unknown> },
  reason: string
): Promise<void> {
  const payload = msg.message
  await supabase.from('email_send_log').insert({
    message_id: payload.message_id,
    template_name: (payload.label || queue) as string,
    recipient_email: payload.to,
    status: 'dlq',
    error_message: reason,
  })
  const { error } = await supabase.rpc('move_to_dlq', {
    source_queue: queue,
    dlq_name: `${queue}_dlq`,
    message_id: msg.msg_id,
    payload,
  })
  if (error) {
    console.error('Failed to move message to DLQ', { queue, msg_id: msg.msg_id, reason, error })
  }
}

export const Route = createFileRoute("/lovable/email/queue/process")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.RESEND_API_KEY
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!apiKey || !supabaseUrl || !supabaseServiceKey) {
          console.error('Missing required environment variables')
          return Response.json(
            { error: 'Server configuration error' },
            { status: 500 }
          )
        }

        // Verify the caller is authorized with the service role key.
        // In the TanStack stack, the pg_cron job sends the service role key as a Bearer token.
        const authHeader = request.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.slice('Bearer '.length).trim()
        if (token !== supabaseServiceKey) {
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        }

        const supabase: SupabaseClient<any, any> = createClient(supabaseUrl, supabaseServiceKey)
        const resend = new Resend(apiKey)

        // 1. Check rate-limit cooldown and read queue config
        const { data: state } = await supabase
          .from('email_send_state')
          .select('retry_after_until, batch_size, send_delay_ms, auth_email_ttl_minutes, transactional_email_ttl_minutes')
          .single()

        if (state?.retry_after_until && new Date(state.retry_after_until) > new Date()) {
          return Response.json({ skipped: true, reason: 'rate_limited' })
        }

        const batchSize = state?.batch_size ?? DEFAULT_BATCH_SIZE
        const sendDelayMs = state?.send_delay_ms ?? DEFAULT_SEND_DELAY_MS
        const ttlMinutes: Record<string, number> = {
          auth_emails: state?.auth_email_ttl_minutes ?? DEFAULT_AUTH_TTL_MINUTES,
          transactional_emails: state?.transactional_email_ttl_minutes ?? DEFAULT_TRANSACTIONAL_TTL_MINUTES,
        }

        let totalProcessed = 0

        // 2. Process auth_emails first (priority), then transactional_emails
        for (const queue of ['auth_emails', 'transactional_emails']) {
          const { data: messages, error: readError } = await supabase.rpc('read_email_batch', {
            queue_name: queue,
            batch_size: batchSize,
            vt: 30,
          })

          if (readError) {
            console.error('Failed to read email batch', { queue, error: readError })
            continue
          }

          if (!messages?.length) continue

          // Retry budget is based on real send failures, not pgmq read_ct.
          const messageIds = Array.from(
            new Set(
              messages
                .map((msg: any) =>
                  msg?.message?.message_id && typeof msg.message.message_id === 'string'
                    ? msg.message.message_id
                    : null
                )
                .filter((id: string | null): id is string => Boolean(id))
            )
          )
          const failedAttemptsByMessageId = new Map<string, number>()
          if (messageIds.length > 0) {
            const { data: failedRows, error: failedRowsError } = await supabase
              .from('email_send_log')
              .select('message_id')
              .in('message_id', messageIds)
              .eq('status', 'failed')

            if (failedRowsError) {
              console.error('Failed to load failed-attempt counters', {
                queue,
                error: failedRowsError,
              })
            } else {
              for (const row of failedRows ?? []) {
                const messageId = row?.message_id
                if (typeof messageId !== 'string' || !messageId) continue
                failedAttemptsByMessageId.set(
                  messageId,
                  (failedAttemptsByMessageId.get(messageId) ?? 0) + 1
                )
              }
            }
          }

          for (let i = 0; i < messages.length; i++) {
            const msg = messages[i]
            const payload = msg.message
            const failedAttempts =
              payload?.message_id && typeof payload.message_id === 'string'
                ? (failedAttemptsByMessageId.get(payload.message_id) ?? 0)
                : msg.read_ct ?? 0

            // Drop expired messages (TTL exceeded).
            // Prefer payload.queued_at when present; fall back to PGMQ's enqueued_at
            // which is always set by the queue.
            const queuedAt = payload.queued_at ?? msg.enqueued_at
            if (queuedAt) {
              const ageMs = Date.now() - new Date(queuedAt).getTime()
              const maxAgeMs = ttlMinutes[queue] * 60 * 1000
              if (ageMs > maxAgeMs) {
                console.warn('Email expired (TTL exceeded)', {
                  queue,
                  msg_id: msg.msg_id,
                  queued_at: queuedAt,
                  ttl_minutes: ttlMinutes[queue],
                })
                await moveToDlq(supabase, queue, msg, `TTL exceeded (${ttlMinutes[queue]} minutes)`)
                continue
              }
            }

            // Move to DLQ if max failed send attempts reached.
            if (failedAttempts >= MAX_RETRIES) {
              await moveToDlq(supabase, queue, msg, `Max retries (${MAX_RETRIES}) exceeded (attempted ${failedAttempts} times)`)
              continue
            }

            // Guard: skip if another worker already sent this message (VT expired race)
            if (payload.message_id) {
              const { data: alreadySent } = await supabase
                .from('email_send_log')
                .select('id')
                .eq('message_id', payload.message_id)
                .eq('status', 'sent')
                .maybeSingle()

              if (alreadySent) {
                console.warn('Skipping duplicate send (already sent)', {
                  queue,
                  msg_id: msg.msg_id,
                  message_id: payload.message_id,
                })
                const { error: dupDelError } = await supabase.rpc('delete_email', {
                  queue_name: queue,
                  message_id: msg.msg_id,
                })
                if (dupDelError) {
                  console.error('Failed to delete duplicate message from queue', { queue, msg_id: msg.msg_id, error: dupDelError })
                }
                continue
              }
            }

            try {
              const { data: sent, error: sendError, headers: sendHeaders } =
                await resend.emails.send(
                  {
                    from: payload.from,
                    to: payload.to,
                    subject: payload.subject,
                    html: payload.html,
                    text: payload.text,
                    // Lovable derived these from unsubscribe_token; Resend has no
                    // equivalent parameter, so set the RFC 8058 headers explicitly.
                    ...(payload.unsubscribe_token
                      ? {
                          headers: {
                            'List-Unsubscribe': `<${publicBaseUrl()}/email/unsubscribe?token=${payload.unsubscribe_token}>`,
                            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                          },
                        }
                      : {}),
                  },
                  payload.idempotency_key
                    ? { idempotencyKey: payload.idempotency_key }
                    : undefined
                )

              // Resend signals failure in the response body rather than by throwing.
              // Rethrow so the retry, DLQ and cooldown handling below is unchanged.
              if (sendError) {
                throw Object.assign(new Error(sendError.message), {
                  status: sendError.statusCode,
                  code: sendError.name,
                  retryAfterSeconds: parseRetryAfter(sendHeaders),
                })
              }

              // Log success
              await supabase.from('email_send_log').insert({
                message_id: payload.message_id,
                template_name: payload.label || queue,
                recipient_email: payload.to,
                status: 'sent',
                metadata: { provider: 'resend', provider_id: sent?.id ?? null },
              })

              // Delete from queue
              const { error: delError } = await supabase.rpc('delete_email', {
                queue_name: queue,
                message_id: msg.msg_id,
              })
              if (delError) {
                console.error('Failed to delete sent message from queue', { queue, msg_id: msg.msg_id, error: delError })
              }
              totalProcessed++
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error)
              console.error('Email send failed', {
                queue,
                msg_id: msg.msg_id,
                read_ct: msg.read_ct,
                failed_attempts: failedAttempts,
                error: errorMsg,
              })

              if (isRateLimited(error)) {
                await supabase.from('email_send_log').insert({
                  message_id: payload.message_id,
                  template_name: payload.label || queue,
                  recipient_email: payload.to,
                  status: 'rate_limited',
                  error_message: errorMsg.slice(0, 1000),
                })

                const retryAfterSecs = getRetryAfterSeconds(error)
                await supabase
                  .from('email_send_state')
                  .update({
                    retry_after_until: new Date(
                      Date.now() + retryAfterSecs * 1000
                    ).toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', 1)

                // Stop processing — remaining messages stay in queue (VT expires, retried next cycle)
                return Response.json({ processed: totalProcessed, stopped: 'rate_limited' })
              }

              // 403s are permanent configuration or authorization failures for this
              // message, so move straight to DLQ and stop processing the rest of the batch.
              if (isForbidden(error)) {
                await moveToDlq(supabase, queue, msg, errorMsg.slice(0, 1000))
                return Response.json({ processed: totalProcessed, stopped: 'forbidden' })
              }

              // Validation failures are permanent for this message but say nothing
              // about the rest of the batch, so DLQ it and keep processing.
              if (isInvalidMessage(error)) {
                await moveToDlq(supabase, queue, msg, errorMsg.slice(0, 1000))
                continue
              }

              // Log non-429 failures to track real retry attempts.
              await supabase.from('email_send_log').insert({
                message_id: payload.message_id,
                template_name: payload.label || queue,
                recipient_email: payload.to,
                status: 'failed',
                error_message: errorMsg.slice(0, 1000),
              })
              if (payload?.message_id && typeof payload.message_id === 'string') {
                failedAttemptsByMessageId.set(payload.message_id, failedAttempts + 1)
              }

              // Non-429 errors: message stays invisible until VT expires, then retried
            }

            // Small delay between sends to smooth bursts
            if (i < messages.length - 1) {
              await new Promise((r) => setTimeout(r, sendDelayMs))
            }
          }
        }

        return Response.json({ processed: totalProcessed })
      },
    },
  },
})
