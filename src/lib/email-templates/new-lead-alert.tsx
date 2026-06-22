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

interface Props {
  fullName?: string
  email?: string
  company?: string
  message?: string
  source?: string
  submittedAt?: string
}

const NewLeadAlert = ({
  fullName = 'Unknown',
  email = 'unknown@example.com',
  company,
  message,
  source = 'website',
  submittedAt,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New lead: {fullName} ({email})</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New lead submitted</Heading>
        <Text style={subtle}>
          Someone just requested a demo on PropAI. Reach out within 24 hours for the best conversion.
        </Text>

        <Section style={card}>
          <Row label="Name" value={fullName} />
          <Row label="Email" value={email} />
          {company ? <Row label="Company" value={company} /> : null}
          <Row label="Source" value={source} />
          {submittedAt ? <Row label="Submitted" value={submittedAt} /> : null}
        </Section>

        {message ? (
          <>
            <Heading as="h2" style={h2}>Message</Heading>
            <Text style={messageStyle}>{message}</Text>
          </>
        ) : null}

        <Hr style={hr} />
        <Text style={footer}>PropAI · AI Network Agency</Text>
      </Container>
    </Body>
  </Html>
)

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Text style={rowStyle}>
      <span style={labelStyle}>{label}:</span> {value}
    </Text>
  )
}

export const template = {
  component: NewLeadAlert,
  subject: (data: Record<string, any>) =>
    `New lead: ${data.fullName || 'Unknown'}${data.company ? ` (${data.company})` : ''}`,
  displayName: 'New Lead Alert',
  to: 'info@ainetworkagency.com',
  previewData: {
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    company: 'Acme Realty',
    message: 'Looking for a demo of the platform.',
    source: 'landing-contact',
    submittedAt: new Date().toISOString(),
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0b1220' }
const container = { padding: '28px 24px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 700, margin: '0 0 8px' }
const h2 = { fontSize: '15px', fontWeight: 600, margin: '20px 0 6px' }
const subtle = { fontSize: '14px', color: '#475569', margin: '0 0 18px' }
const card = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '16px 18px',
}
const rowStyle = { fontSize: '14px', margin: '4px 0', color: '#0b1220' }
const labelStyle = { color: '#64748b', fontWeight: 600, marginRight: '6px' }
const messageStyle = {
  fontSize: '14px',
  lineHeight: '1.6',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '12px 14px',
  whiteSpace: 'pre-wrap' as const,
}
const hr = { borderColor: '#e2e8f0', margin: '24px 0 12px' }
const footer = { fontSize: '12px', color: '#94a3b8', textAlign: 'center' as const }
