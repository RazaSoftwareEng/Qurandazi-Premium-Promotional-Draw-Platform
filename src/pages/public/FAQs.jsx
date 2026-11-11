import { Button } from '@/components/ui'
import { PublicHero } from '@/components/layout/PageHeader'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { FAQS } from '@/utils/content'
import { FaqList } from './Home'

export default function FAQs() {
  useDocumentTitle('FAQs')
  return (
    <>
      <PublicHero eyebrow="FAQs" title="Frequently asked questions" subtitle="Everything you need to know about free participation, eligibility and our verifiable draws." />
      <section className="container-page max-w-4xl py-16">
        <FaqList items={FAQS} />
        <div className="mt-10 text-center">
          <p className="text-ink-muted">Still have a question?</p>
          <Button to="/contact" variant="navy" className="mt-4">Contact our team</Button>
        </div>
      </section>
    </>
  )
}
