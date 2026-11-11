import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ErrorState, Skeleton } from '@/components/ui'
import { PublicHero } from '@/components/layout/PageHeader'
import DrawAuditView from '@/components/campaign/DrawAuditView'
import { useAsync } from '@/hooks/useAsync'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { drawService } from '@/services/drawService'
import { formatDate } from '@/utils/format'

export default function DrawAudit() {
  const { drawId } = useParams()
  const { data, loading, error, reload } = useAsync(() => drawService.audit(drawId), [drawId])
  useDocumentTitle(data?.draw?.title || 'Draw audit')

  return (
    <>
      <PublicHero
        eyebrow="Draw audit"
        title={data?.draw?.title || 'Draw audit record'}
        subtitle={data ? `${data.draw.campaign_title} · published ${formatDate(data.draw.published_at)}` : 'Loading audit record…'}
      >
        <Link to="/winners" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-400 hover:text-gold-300">
          <ArrowLeft className="h-4 w-4" /> All winners
        </Link>
      </PublicHero>
      <section className="container-page py-10">
        {loading ? (
          <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-96 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></div>
        ) : error ? (
          <div className="card"><ErrorState error={error} onRetry={reload} /></div>
        ) : (
          <DrawAuditView audit={data} />
        )}
      </section>
    </>
  )
}
