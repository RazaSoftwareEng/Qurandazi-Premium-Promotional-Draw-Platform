import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Button, Spinner } from '@/components/ui'
import { supabase } from '@/services/supabase'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/** Landing page for email verification links (PKCE code exchange is automatic). */
export default function AuthCallback() {
  useDocumentTitle('Verifying')
  const navigate = useNavigate()
  const [state, setState] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const url = new URL(window.location.href)
    const hash = new URLSearchParams(url.hash.slice(1))
    const err = url.searchParams.get('error_description') || hash.get('error_description')
    if (err) {
      setState('error')
      setMessage(err)
      return undefined
    }
    let done = false
    const finish = (ok) => {
      if (done) return
      done = true
      setState(ok ? 'success' : 'error')
      if (ok) setTimeout(() => navigate('/dashboard', { replace: true }), 1800)
      else setMessage('This link is invalid or has expired.')
    }
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => session && finish(true))
    supabase.auth.getSession().then(({ data }) => data.session && finish(true))
    const t = setTimeout(() => supabase.auth.getSession().then(({ data }) => finish(Boolean(data.session))), 4000)
    return () => {
      clearTimeout(t)
      sub.subscription.unsubscribe()
    }
  }, [navigate])

  if (state === 'loading') return <Spinner label="Verifying" />
  return (
    <div className="animate-fade-up text-center">
      {state === 'success' ? <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" /> : <XCircle className="mx-auto h-14 w-14 text-red-600" />}
      <h1 className="mt-6 text-3xl font-extrabold text-navy-900">{state === 'success' ? 'Email verified' : 'Verification failed'}</h1>
      <p className="mt-3 text-sm text-ink-muted">{state === 'success' ? 'Your account is active. Redirecting to your dashboard…' : message}</p>
      <Button to={state === 'success' ? '/dashboard' : '/login'} className="mt-8">{state === 'success' ? 'Go to dashboard' : 'Back to sign in'}</Button>
    </div>
  )
}
