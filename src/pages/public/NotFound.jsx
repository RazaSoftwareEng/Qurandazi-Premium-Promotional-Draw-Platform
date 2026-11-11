import { Button, LogoMark } from '@/components/ui'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function NotFound() {
  useDocumentTitle('Page not found')
  return (
    <section className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <LogoMark className="h-16 w-16" />
      <p className="mt-6 font-mono text-sm text-gold-700">404</p>
      <h1 className="mt-2 font-display text-5xl font-semibold text-navy-900">This page isn’t here</h1>
      <p className="mt-3 max-w-md text-ink-muted">The page you’re looking for may have moved or no longer exists.</p>
      <div className="mt-8 flex gap-3">
        <Button to="/">Go home</Button>
        <Button to="/campaigns" variant="outline">Browse campaigns</Button>
      </div>
    </section>
  )
}
