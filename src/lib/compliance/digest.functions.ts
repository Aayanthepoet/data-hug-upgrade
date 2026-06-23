import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

// Admin-only: render and enqueue the weekly compliance digest immediately,
// optionally to a single recipient (defaults to the calling admin's email).
export const sendTestComplianceDigest = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { recipientEmail?: string; dashboardUrl?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context

    const { data: isAdmin, error: roleErr } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    })
    if (roleErr) throw new Error('Failed to verify role')
    if (!isAdmin) throw new Error('Forbidden')

    // Resolve recipient: use override if provided, else the calling admin's email
    let recipientEmail = data.recipientEmail?.trim()
    if (!recipientEmail) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .maybeSingle()
      recipientEmail = profile?.email ?? undefined
    }
    if (!recipientEmail) throw new Error('No recipient email available')

    // Use service-role client for the dispatch (needs to read aggregate tables
    // and write to email infra). Caller is already verified as admin above.
    const supabaseUrl = process.env.SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { generateAndDispatchDigest } = await import('@/lib/compliance/digest.server')
    const result = await generateAndDispatchDigest(adminClient, {
      testRecipient: recipientEmail,
      dashboardUrl: data.dashboardUrl,
      persist: false,
    })
    return { ...result, recipientEmail }
  })
