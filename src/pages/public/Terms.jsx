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
          <h2>1. No entry fees; refundable deposits</h2>
          <p>No fee is charged to enter a campaign. To join a campaign, you need a verified, refundable deposit for that campaign’s category or a higher one. A deposit is not a fee. It is paid only into the company account shown in your dashboard and returned under the deposit terms you accept before paying. Those terms state the amount, the lock-in period and the refund rules, and their version is recorded on your deposit.</p>
          <h2>2. Eligibility</h2>
          <ul>
            <li>You must hold a registered account in good standing.</li>
            <li>You must complete your profile and pass identity verification (KYC) by submitting your CNIC. Only KYC-verified members can make deposits.</li>
            <li>You must have a verified, active deposit for the campaign’s category or a higher one. Individual campaigns may set additional requirements, shown on each campaign page.</li>
            <li>Staff and administrators are not eligible to participate.</li>
          </ul>
          <h2>3. Entries</h2>
          <p>Each member may submit one entry per campaign. Entries must be submitted before the published closing date and time. When a campaign closes, an entry goes into the draw only if the member’s qualifying deposit is still active at closing. Requesting a withdrawal before closing automatically removes the entry from that draw. Entries found to breach these terms or campaign rules may be marked ineligible before entries are frozen.</p>
          <h2>4. Deposits and withdrawals</h2>
          <p>Every deposit is verified against our bank statement before it becomes active. After the lock-in period, or earlier if the deposit terms allow it, you can request a withdrawal from your dashboard. We refund the deposit to the account you provide and record the payout transaction ID. Deposit statuses are: Pending, Verified, Withdrawal Requested and Refunded (or Rejected, with a reason).</p>
          <h2>5. Winner selection</h2>
          <p>Winners are selected using the published, verifiable process described on the How It Works page. Results are approved by an authorized Super Admin before publication. Published results are final.</p>
          <h2>6. Rewards</h2>
          <p>Rewards are as described on each campaign page, are non-transferable and cannot be exchanged for cash unless stated. We will contact winners using their profile details. Before handover, the winner must present the CNIC that matches their verified profile. Each handover is recorded with its date, documents and notes. We will never ask for payment to release a reward.</p>
          <h2>7. Accounts</h2>
          <p>You are responsible for the accuracy of your profile and the security of your password. We may suspend accounts involved in fraud, multiple accounts or abuse.</p>
          <h2>8. Changes</h2>
          <p>We may update these terms. Material changes will be announced on the platform. Continued use constitutes acceptance.</p>
          <h2>9. Contact</h2>
          <p>Questions about these terms can be sent through the Contact page.</p>
        </div>
      </article>
    </>
  )
}
