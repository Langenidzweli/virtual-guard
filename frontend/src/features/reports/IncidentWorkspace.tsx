import { IncidentContext } from './incident-context'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { incidentService } from '@/services/incidentService'
import type { Incident } from '@/types'
import { ReportsPage } from './ReportsPage'
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage'

export function IncidentWorkspace() {
  const [params] = useSearchParams()
  const trends = params.get('view') === 'trends'
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    incidentService.list().then(items => { if (!cancelled) setIncidents(items) })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load incidents') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [attempt])
  return <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-5">
    <header><h1 className="text-3xl font-semibold">Incidents</h1><p className="mt-1 text-sm text-text-secondary">Review alerts, find past decisions, and explore incident trends in one place.</p></header>
    <nav aria-label="Incident views" className="flex gap-2">
      <Link to="/reports" aria-current={!trends ? 'page' : undefined} className={`rounded-lg border px-4 py-2 text-sm ${!trends ? 'border-status-info bg-status-info/15' : 'border-line text-text-secondary'}`}>Records &amp; review</Link>
      <Link to="/reports?view=trends" aria-current={trends ? 'page' : undefined} className={`rounded-lg border px-4 py-2 text-sm ${trends ? 'border-status-info bg-status-info/15' : 'border-line text-text-secondary'}`}>Trends</Link>
    </nav>
    {loading ? <p role="status">Loading incidents…</p> : error ? <div role="alert"><p>{error}</p><button className="mt-3 text-status-info underline" onClick={() => setAttempt(value => value + 1)}>Try again</button></div> :
      <IncidentContext.Provider value={{ incidents, setIncidents }}>
        <div hidden={trends}><ReportsPage /></div>
        <div hidden={!trends}><AnalyticsPage /></div>
      </IncidentContext.Provider>}
  </div>
}
