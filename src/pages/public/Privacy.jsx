import { PublicHero } from '@/components/layout/PageHeader'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function Privacy() {
  useDocumentTitle('Privacy Policy')
  return (
    <>
      <PublicHero eyebrow="Legal" title="Privacy Policy" subtitle="How we collect, use and protect your personal information." />
      <article className="container-page max-w-3xl py-14">
        <div className="prose-qz">
          <p className="text-xs text-ink-muted">This template must be reviewed by qualified legal counsel for your jurisdiction before production use.</p>
          <h2>Information we collect</h2>
          <ul>
            <li>Account details: name, email, phone number, address, city and optional profile image.</li>
            <li>Participation records: entries, entry references and draw results.</li>
            <li>Technical data required to keep your session secure.</li>
          </ul>
          <h2>How we use it</h2>
          <ul>
            <li>To operate your account and verify campaign eligibility.</li>
            <li>To run, audit and publish draws, and to contact winners.</li>
            <li>To send notifications about campaigns, entries and results.</li>
          </ul>
          <h2>What we publish</h2>
          <p>Published results show only a masked winner name (for example “Ahmed K.”) and the entry reference. Draw snapshots publish entry references only — never names, emails or phone numbers.</p>
          <h2>Security</h2>
          <p>Data is stored in a managed PostgreSQL database with row-level security: you can only access your own profile, entries and notifications. Administrative access is role-restricted and logged.</p>
          <h2>Your rights</h2>
          <p>You may view and update your profile at any time from your dashboard. To request account deletion or a copy of your data, contact us via the Contact page. Records required for draw audit integrity may be retained in anonymised form.</p>
          <h2>No sale of data</h2>
          <p>We do not sell your personal information.</p>
        </div>
      </article>
    </>
  )
}
