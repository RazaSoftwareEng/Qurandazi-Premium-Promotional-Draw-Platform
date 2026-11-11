import { PublicHero } from '@/components/layout/PageHeader'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function Terms() {
  useDocumentTitle('Terms & Conditions')
  return (
    <>
      <PublicHero eyebrow="Legal" title="Terms & Conditions" subtitle="Please read these terms carefully before using QURANDAZI." />
      <article className="container-page max-w-3xl py-14">
        <div className="prose-qz">
          <p className="text-xs text-ink-muted">This template must be reviewed by qualified legal counsel for your jurisdiction before production use.</p>
          <h2>1. Free participation</h2>
          <p>All QURANDAZI promotional campaigns are free to enter. No purchase, deposit, ticket or payment of any kind is required, requested or accepted as a condition of participation. Category reference amounts are informational legacy labels only.</p>
          <h2>2. Eligibility</h2>
          <ul>
            <li>You must hold a registered account in good standing.</li>
            <li>Individual campaigns may set additional requirements, such as a verified email or a complete profile. These are shown on each campaign page.</li>
            <li>Staff and administrators are not eligible to participate.</li>
          </ul>
          <h2>3. Entries</h2>
          <p>Each member may submit one entry per campaign. Entries must be submitted before the published closing date and time. Entries found to breach these terms or campaign rules may be marked ineligible before entries are frozen.</p>
          <h2>4. Winner selection</h2>
          <p>Winners are selected using the published, verifiable process described on the How It Works page. Results are approved by an authorized Super Admin before publication. Published results are final.</p>
          <h2>5. Rewards</h2>
          <p>Rewards are as described on each campaign page, are non-transferable and cannot be exchanged for cash unless stated. We will contact winners using their profile details. We will never ask for payment to release a reward.</p>
          <h2>6. Accounts</h2>
          <p>You are responsible for the accuracy of your profile and the security of your password. We may suspend accounts involved in fraud, multiple accounts or abuse.</p>
          <h2>7. Changes</h2>
          <p>We may update these terms. Material changes will be announced on the platform. Continued use constitutes acceptance.</p>
          <h2>8. Contact</h2>
          <p>Questions about these terms can be sent through the Contact page.</p>
        </div>
      </article>
    </>
  )
}
