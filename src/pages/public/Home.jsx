import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, ShieldCheck, Trophy } from 'lucide-react'
import { Button, CardSkeleton, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import CampaignCard from '@/components/campaign/CampaignCard'
import CategoryCard from '@/components/campaign/CategoryCard'
import { useAsync } from '@/hooks/useAsync'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { campaignService } from '@/services/campaignService'
import { categoryService } from '@/services/categoryService'
import { drawService } from '@/services/drawService'
import { useSettings } from '@/context/SettingsContext'
import { FAQS, STEPS, TRUST } from '@/utils/content'
import { formatDate, formatNumber } from '@/utils/format'

function SectionHead({ eyebrow, title, text, dark = false, action }) {
  return (
    <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className={dark ? 'eyebrow-dark' : 'eyebrow'}>
          <span className="gold-rule" /> {eyebrow}
        </p>
        <h2 className={`mt-3 font-display text-4xl font-semibold leading-tight sm:text-5xl ${dark ? 'text-white' : 'text-navy-900'}`}>{title}</h2>
        {text && <p className={`mt-3 text-base leading-7 ${dark ? 'text-white/65' : 'text-ink-muted'}`}>{text}</p>}
      </div>
      {action}
    </div>
  )
}

export function FaqList({ items }) {
  const [open, setOpen] = useState(0)
  return (
    <div className="divide-y divide-ivory-300 rounded-2xl border border-ivory-300 bg-white">
      {items.map((f, i) => (
        <div key={f.q}>
          <button
            className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left sm:px-6"
            onClick={() => setOpen(open === i ? -1 : i)}
            aria-expanded={open === i}
          >
            <span className="font-bold text-navy-900">{f.q}</span>
            <ChevronDown className={`h-5 w-5 shrink-0 text-gold-600 transition-transform ${open === i ? 'rotate-180' : ''}`} />
          </button>
          {open === i && <p className="animate-fade-up px-5 pb-5 text-sm leading-7 text-ink-soft sm:px-6">{f.a}</p>}
        </div>
      ))}
    </div>
  )
}

export default function Home() {
  useDocumentTitle()
  const { settings } = useSettings()
  const featured = useAsync(() => campaignService.featured(3), [])
  const categories = useAsync(() => categoryService.list(), [])
  const winners = useAsync(() => drawService.publishedWinners({ from: 0, to: 5 }), [])
  const stats = useAsync(() => drawService.publicStats(), [])

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <div className="pattern-stars pointer-events-none absolute inset-0" aria-hidden />
        <div className="pointer-events-none absolute -right-40 top-1/2 h-[560px] w-[560px] -translate-y-1/2 rounded-full border border-gold-500/10" aria-hidden />
        <div className="pointer-events-none absolute -right-20 top-1/2 h-[380px] w-[380px] -translate-y-1/2 rotate-45 border border-gold-500/15" aria-hidden />
        <div className="container-page relative grid items-center gap-12 py-20 sm:py-28 lg:grid-cols-12">
          <div className="lg:col-span-7">
            {settings.homepage.announcement && (
              <p className="mb-6 inline-flex rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1 text-xs font-semibold text-gold-300">
                {settings.homepage.announcement}
              </p>
            )}
            <p className="eyebrow-dark">
              <span className="gold-rule" /> Verifiable promotional draws
            </p>
            <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.02] text-white sm:text-7xl">
              {settings.homepage.hero_title.split('.').filter(Boolean).length > 1 ? (
                <>
                  {settings.homepage.hero_title.split('.')[0]}.
                  <br />
                  <span className="text-gold-400">{settings.homepage.hero_title.split('.').slice(1).join('.').trim()}</span>
                </>
              ) : (
                settings.homepage.hero_title
              )}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/70">{settings.homepage.hero_subtitle}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button to="/campaigns" size="lg" iconRight={ArrowRight}>
                Explore Campaigns
              </Button>
              <Button to="/how-it-works" size="lg" variant="outline-light">
                How It Works
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/60">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gold-400" /> Refundable deposits, no entry fee</span>
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gold-400" /> Publicly verifiable results</span>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-white/10 bg-navy-800/80 p-6 shadow-2xl backdrop-blur">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-400">Platform at a glance</p>
              <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/10">
                {[
                  ['Campaigns', stats.data?.campaigns],
                  ['Free entries', stats.data?.entries],
                  ['Published draws', stats.data?.draws],
                  ['Winners', stats.data?.winners],
                ].map(([label, v]) => (
                  <div key={label} className="bg-navy-800 p-5">
                    <dt className="text-xs text-white/55">{label}</dt>
                    <dd className="mt-1 text-3xl font-extrabold tabular-nums text-white">
                      {stats.loading ? <Skeleton className="h-8 w-14 bg-white/10" /> : formatNumber(v ?? 0)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs leading-5 text-white/50">Every published draw includes its seed commitment, snapshot fingerprint and a one-click browser verification.</p>
            </div>
          </div>
        </div>
        <div className="hairline-gold" />
      </section>

      {/* Featured */}
      <section className="container-page py-20">
        <SectionHead
          eyebrow="Featured"
          title="Campaigns open now"
          text="Join any open campaign for free. One entry per member — equal chances for everyone."
          action={<Button to="/campaigns" variant="outline" iconRight={ArrowRight}>All campaigns</Button>}
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.loading ? (
            <CardSkeleton count={3} />
          ) : featured.error ? (
            <div className="card col-span-full"><ErrorState error={featured.error} onRetry={featured.reload} /></div>
          ) : featured.data?.length ? (
            featured.data.map((c) => <CampaignCard key={c.id} campaign={c} />)
          ) : (
            <div className="card col-span-full"><EmptyState title="No open campaigns right now" message="New campaigns are announced regularly — create a free account to be notified." action={<Button to="/register">Create free account</Button>} /></div>
          )}
        </div>
      </section>

      {/* Categories */}
      <section className="bg-navy-900 py-20">
        <div className="container-page">
          <SectionHead dark eyebrow="Categories" title="Three tiers. One promise: free." text="Each category groups campaigns by reward tier. Reference amounts are legacy labels for information only." />
          <div className="grid gap-6 md:grid-cols-3">
            {categories.loading
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-2xl bg-navy-800" />)
              : categories.error
                ? <div className="card col-span-full"><ErrorState error={categories.error} onRetry={categories.reload} /></div>
                : categories.data?.map((c, i) => <CategoryCard key={c.id} category={c} index={i} />)}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container-page py-20">
        <SectionHead eyebrow="How it works" title="Six steps to your moment" action={<Button to="/how-it-works" variant="outline" iconRight={ArrowRight}>Learn more</Button>} />
        <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card relative p-6">
              <span className="absolute right-5 top-5 font-display text-4xl font-semibold text-ivory-300">0{i + 1}</span>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-900 text-gold-400"><s.icon className="h-5 w-5" /></div>
              <h3 className="mt-5 font-bold text-navy-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Winners */}
      <section className="border-y border-ivory-300 bg-white py-20">
        <div className="container-page">
          <SectionHead eyebrow="Latest winners" title="Moments that happened" action={<Button to="/winners" variant="outline" iconRight={ArrowRight}>All winners & audits</Button>} />
          {winners.loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
          ) : winners.error ? (
            <ErrorState error={winners.error} onRetry={winners.reload} />
          ) : winners.data?.rows?.length ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {winners.data.rows.map((w) => (
                <li key={w.id}>
                  <Link to={`/winners/${w.draw_id}`} className="card card-hover flex items-center gap-4 p-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-700"><Trophy className="h-5 w-5" /></div>
                    <div className="min-w-0">
                      <p className="font-bold text-navy-900">{w.winner_display_name}</p>
                      <p className="truncate text-sm text-ink-muted">{w.campaign_title}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-gold-700">{w.entry_reference} · {formatDate(w.published_at)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Trophy} title="No published results yet" message="Winners will appear here as soon as the first draw is published." />
          )}
        </div>
      </section>

      {/* Trust */}
      <section className="relative overflow-hidden bg-navy-900 py-20 text-white">
        <div className="pattern-stars pointer-events-none absolute inset-0" aria-hidden />
        <div className="container-page relative">
          <SectionHead dark eyebrow="Trust & transparency" title="Fairness you can verify — not just trust" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map((t) => (
              <div key={t.title} className="card-navy p-6">
                <t.icon className="h-6 w-6 text-gold-400" />
                <h3 className="mt-4 font-bold text-white">{t.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-page grid gap-10 py-20 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="eyebrow"><span className="gold-rule" /> FAQs</p>
          <h2 className="mt-3 font-display text-4xl font-semibold text-navy-900 sm:text-5xl">Questions, answered</h2>
          <p className="mt-3 text-ink-muted">Can’t find what you need?</p>
          <Button to="/contact" variant="navy" className="mt-6">Contact us</Button>
        </div>
        <div className="lg:col-span-8"><FaqList items={FAQS.slice(0, 5)} /></div>
      </section>

      {/* CTA */}
      <section className="container-page pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gold-500 px-8 py-14 text-center sm:px-16">
          <div className="pattern-stars-dark pointer-events-none absolute inset-0" aria-hidden />
          <h2 className="relative font-display text-4xl font-semibold text-navy-900 sm:text-5xl">Your moment could be next.</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-navy-800">Create your free account in under a minute and join any open campaign.</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Button to="/register" variant="navy" size="lg">Create free account</Button>
            <Button to="/campaigns" variant="outline" size="lg">Browse campaigns</Button>
          </div>
        </div>
      </section>
    </>
  )
}
