import { Eye, HeartHandshake, Scale, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui'
import { PublicHero } from '@/components/layout/PageHeader'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const VALUES = [
  { icon: HeartHandshake, title: 'Refundable, never a fee', text: 'Joining needs a verified deposit. It stays yours and is returned under clear terms. We charge no entry fee.' },
  { icon: Scale, title: 'Equal chances', text: 'One entry per member per campaign, enforced by the database — not by goodwill.' },
  { icon: Eye, title: 'Radical transparency', text: 'Every published draw ships with the cryptographic evidence needed to reproduce it.' },
  { icon: ShieldCheck, title: 'Accountable operations', text: 'Every administrative action is recorded in an append-only audit log.' },
]

export default function About() {
  useDocumentTitle('About Us')
  return (
    <>
      <PublicHero eyebrow="About us" title="Promotions built on trust" subtitle="QURANDAZI — from the Urdu for “drawing lots” — runs promotional campaigns where fairness is provable, not promised." />
      <section className="container-page grid gap-12 py-16 lg:grid-cols-2">
        <div className="prose-qz">
          <h2>Our story</h2>
          <p>Promotional draws are only as good as the trust behind them. Too often, participants are asked to simply believe that a winner was chosen fairly. We built QURANDAZI to change that.</p>
          <p>Our platform freezes eligible entries the moment a campaign closes, commits to a secret random seed before anyone can see the outcome, and publishes everything needed for anyone to reproduce the result independently.</p>
          <h2>Our commitment</h2>
          <p>We will never charge you a fee to participate. Each category requires a refundable deposit, paid only into our company account and verified against our bank statement. After the lock-in period you can withdraw it from your dashboard, and every refund is recorded with its payout transaction ID.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {VALUES.map((v) => (
            <div key={v.title} className="card p-6">
              <v.icon className="h-6 w-6 text-gold-600" />
              <h3 className="mt-4 font-bold text-navy-900">{v.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-muted">{v.text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="container-page pb-16 text-center">
        <Button to="/campaigns" size="lg">Explore campaigns</Button>
      </section>
    </>
  )
}
