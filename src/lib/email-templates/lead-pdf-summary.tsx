import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  leadName?: string
  sharedBy?: string
  downloadUrl?: string
  note?: string
}

const LeadPdfSummary = ({
  leadName = 'a lead',
  sharedBy = 'A teammate',
  downloadUrl = '#',
  note,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Lead summary PDF for {leadName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Lead summary shared with you</Heading>
        <Text style={subtle}>
          {sharedBy} shared the lead summary for <strong>{leadName}</strong> with you.
        </Text>

        {note ? (
          <Section style={card}>
            <Text style={noteStyle}>{note}</Text>
          </Section>
        ) : null}

        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button href={downloadUrl} style={btn}>Download PDF</Button>
        </Section>

        <Text style={subtle}>
          This download link expires in 7 days.
        </Text>

        <Hr style={hr} />
        <Text style={footer}>PropAI · AI Network Agency</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: LeadPdfSummary,
  subject: (data: Record<string, any>) =>
    `Lead summary: ${data.leadName || 'New lead'}`,
  displayName: 'Lead PDF Summary',
  previewData: {
    leadName: 'Jane Doe',
    sharedBy: 'Alex',
    downloadUrl: 'https://example.com/lead.pdf',
    note: 'Sharing this for the follow-up call tomorrow.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0b1220' }
const container = { padding: '28px 24px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 700, margin: '0 0 8px' }
const subtle = { fontSize: '14px', color: '#475569', margin: '0 0 14px' }
const card = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '14px 16px',
  margin: '12px 0',
}
const noteStyle = { fontSize: '14px', whiteSpace: 'pre-wrap' as const, margin: 0 }
const btn = {
  background: '#0ea5e9',
  color: '#ffffff',
  padding: '12px 22px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
}
const hr = { borderColor: '#e2e8f0', margin: '24px 0 12px' }
const footer = { fontSize: '12px', color: '#94a3b8', textAlign: 'center' as const }
