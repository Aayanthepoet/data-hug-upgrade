import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface KeywordCount {
  keyword: string
  count: number
}

interface Props {
  periodStart?: string
  periodEnd?: string
  optOutsThisWeek?: number
  optOutsLastWeek?: number
  deltaPct?: number | null
  keywordBreakdown?: KeywordCount[]
  blockedSends?: number
  dashboardUrl?: string
}

const ComplianceDigest = ({
  periodStart = '',
  periodEnd = '',
  optOutsThisWeek = 0,
  optOutsLastWeek = 0,
  deltaPct = 0,
  keywordBreakdown = [],
  blockedSends = 0,
  dashboardUrl = '',
}: Props) => {
  const fmt = (d: string) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')
  const deltaLabel =
    deltaPct === null || deltaPct === undefined
      ? '—'
      : `${deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(deltaPct).toFixed(0)}% vs last week`
  const deltaColor = (deltaPct ?? 0) > 0 ? '#dc2626' : (deltaPct ?? 0) < 0 ? '#16a34a' : '#64748b'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {`${optOutsThisWeek} new opt-outs · ${blockedSends} blocked sends · ${fmt(periodStart)}–${fmt(periodEnd)}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>Weekly Compliance Digest</Text>
          <Heading style={h1}>
            {fmt(periodStart)} – {fmt(periodEnd)}
          </Heading>

          <Section style={statRow}>
            <Text style={statLabel}>New opt-outs</Text>
            <Text style={statValue}>{optOutsThisWeek}</Text>
            <Text style={{ ...statDelta, color: deltaColor }}>{deltaLabel}</Text>
            <Text style={statSub}>Last week: {optOutsLastWeek}</Text>
          </Section>

          <Section style={statRow}>
            <Text style={statLabel}>Blocked send attempts</Text>
            <Text style={statValue}>{blockedSends}</Text>
            <Text style={statSub}>Outbound messages stopped by the suppression list</Text>
          </Section>

          <Heading as="h2" style={h2}>Keyword breakdown</Heading>
          {keywordBreakdown.length === 0 ? (
            <Text style={empty}>No opt-outs this week.</Text>
          ) : (
            <Section style={card}>
              {keywordBreakdown.map((k) => (
                <Text key={k.keyword} style={rowStyle}>
                  <span style={labelStyle}>{k.keyword}</span> {k.count}
                </Text>
              ))}
            </Section>
          )}

          {dashboardUrl ? (
            <Text style={cta}>
              <a href={dashboardUrl} style={ctaLink}>Open compliance dashboard →</a>
            </Text>
          ) : null}

          <Hr style={hr} />
          <Text style={footer}>PropAI · Compliance · AI Network Agency</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ComplianceDigest,
  subject: (data: Record<string, any>) =>
    `Weekly compliance digest: ${data.optOutsThisWeek ?? 0} new opt-outs`,
  displayName: 'Weekly Compliance Digest',
  previewData: {
    periodStart: new Date(Date.now() - 7 * 86400000).toISOString(),
    periodEnd: new Date().toISOString(),
    optOutsThisWeek: 12,
    optOutsLastWeek: 8,
    deltaPct: 50,
    keywordBreakdown: [
      { keyword: 'STOP', count: 7 },
      { keyword: 'UNSUBSCRIBE', count: 3 },
      { keyword: 'CANCEL', count: 2 },
    ],
    blockedSends: 24,
    dashboardUrl: 'https://example.com/app/opt-outs',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0b1220' }
const container = { padding: '28px 24px', maxWidth: '560px' }
const eyebrow = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: '#64748b', margin: '0 0 4px' }
const h1 = { fontSize: '22px', fontWeight: 700, margin: '0 0 18px' }
const h2 = { fontSize: '14px', fontWeight: 600, margin: '24px 0 8px', color: '#0b1220' }
const statRow = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px', margin: '0 0 10px' }
const statLabel = { fontSize: '12px', color: '#64748b', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }
const statValue = { fontSize: '28px', fontWeight: 700, margin: '0', color: '#0b1220' }
const statDelta = { fontSize: '13px', fontWeight: 600, margin: '4px 0 0' }
const statSub = { fontSize: '12px', color: '#64748b', margin: '2px 0 0' }
const card = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px' }
const rowStyle = { fontSize: '14px', margin: '4px 0', color: '#0b1220', display: 'flex', justifyContent: 'space-between' as const }
const labelStyle = { color: '#0b1220', fontWeight: 600 }
const empty = { fontSize: '13px', color: '#64748b', margin: '0' }
const cta = { margin: '20px 0 0', fontSize: '14px' }
const ctaLink = { color: '#0ea5e9', fontWeight: 600, textDecoration: 'none' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0 12px' }
const footer = { fontSize: '12px', color: '#94a3b8', textAlign: 'center' as const }
