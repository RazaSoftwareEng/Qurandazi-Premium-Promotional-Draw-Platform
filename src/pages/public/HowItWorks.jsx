import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui'
import { PublicHero } from '@/components/layout/PageHeader'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { STEPS, TRUST } from '@/utils/content'

const DRAW_FLOW = [
  ['Scheduled', 'An administrator schedules the draw for a time at or after the campaign closing date.'],
  ['Frozen', 'At closing, every eligible entry is copied into a numbered, immutable snapshot. Its SHA-256 fingerprint and the commitment to a secret 256-bit random seed are recorded.'],
  ['Drawn', 'At the scheduled time, winners are derived from the committed seed and the snapshot fingerprint. The seed is revealed.'],
  ['Approved', 'A Super Admin reviews and approves the result — a different Super Admin from the one who ran the draw whenever one is available.'],
  ['Published', 'Results go live with the full audit record. Winners and participants are notified.'],
]

export default function HowItWorks() {
  useDocumentTitle('How It Works')
  return (
    <>
      <PublicHero eyebrow="How it works" title="Simple to join. Impossible to fix." subtitle="Participation takes a minute. Fairness is guaranteed by mathematics and enforced by the database." />
      <section className="container-page py-16">
        <h2 className="section-title">For participants</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 text-gold-400"><s.icon className="h-5 w-5" /></span>
                <span className="font-mono text-xs text-gold-700">STEP 0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-bold text-navy-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="border-y border-ivory-300 bg-white py-16">
        <div className="container-page grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="eyebrow"><span className="gold-rule" /> The draw lifecycle</p>
            <h2 className="mt-3 section-title">Five auditable stages</h2>
            <p className="mt-3 text-ink-muted">Each stage is a one-way transition recorded in the audit log. A completed draw cannot be cancelled and re-run.</p>
          </div>
          <ol className="space-y-4 lg:col-span-8">
            {DRAW_FLOW.map(([title, text], i) => (
              <li key={title} className="flex gap-5 rounded-2xl border border-ivory-300 p-5">
                <span className="font-display text-3xl font-semibold text-gold-600">{i + 1}</span>
                <div>
                  <h3 className="font-bold text-navy-900">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-ink-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="container-page py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((t) => (
            <div key={t.title} className="card p-6">
              <t.icon className="h-6 w-6 text-gold-600" />
              <h3 className="mt-4 font-bold text-navy-900">{t.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-muted">{t.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button to="/register" size="lg">Create an account</Button>
          <Button to="/winners" variant="outline" size="lg" iconRight={ArrowRight}>See a published audit</Button>
        </div>
      </section>
    </>
  )
}
