import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Check, ChevronDown, ChevronUp, ClipboardCheck, Download, ExternalLink, Eye, FileText, Search, ShieldAlert, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Modal } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { useAuth } from '@/features/auth/useAuth'
import { useAuthToken } from '@/features/auth/useAuthToken'
import { incidentService } from '@/services/incidentService'
import type { Incident, ReviewStatus } from '@/types'

type Filter = ReviewStatus | 'ALL'
const NOTIFICATIONS_CHANGED_EVENT = 'virtual-guard:notifications-changed'
const tabs: Array<{ value: Filter; label: string; dot: string }> = [
  { value: 'ALL', label: 'All', dot: 'bg-status-info' }, { value: 'PENDING_REVIEW', label: 'Pending', dot: 'bg-status-info' },
  { value: 'CONFIRMED', label: 'Confirmed', dot: 'bg-status-normal' }, { value: 'DISMISSED', label: 'Dismissed', dot: 'bg-[#8ca1c3]' },
  { value: 'ESCALATED', label: 'Escalated', dot: 'bg-status-alert' },
]

const normalized = (value: number | null) => value == null ? 0 : value <= 1 ? value * 100 : value
const variant = (status: ReviewStatus): 'warning'|'success'|'danger'|'neutral' => status === 'PENDING_REVIEW' ? 'warning' : status === 'CONFIRMED' ? 'success' : status === 'ESCALATED' ? 'danger' : 'neutral'
const statusDot = (status: ReviewStatus) => status === 'CONFIRMED' ? 'bg-status-normal' : status === 'ESCALATED' ? 'bg-status-alert' : status === 'PENDING_REVIEW' ? 'bg-status-info' : 'bg-[#8ca1c3]'
const statusLabel = (status: ReviewStatus) => status.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase())

function evidenceName(incident: Incident): string | null {
  if (incident.annotatedVideoFileName) return incident.annotatedVideoFileName
  const path = incident.evidence?.annotatedVideoPath
  return typeof path === 'string' ? path.split(/[\\/]/).pop() ?? null : null
}

function evidenceUrl(incident: Incident, token: string | null): string | undefined {
  const name = evidenceName(incident)
  if (!name) return undefined
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8090', url = new URL(`/api/video/${encodeURIComponent(name)}`, `${base}/`)
  if (token) url.searchParams.set('token', token)
  return url.toString()
}

export function HistoryPage() {
  const navigate = useNavigate(), authToken = useAuthToken(), { user } = useAuth()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [filter, setFilter] = useState<Filter>('PENDING_REVIEW')
  const [search, setSearch] = useState('')
  const [date, setDate] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [footage, setFootage] = useState<Incident | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    incidentService.list().then(setIncidents).catch((err) => setError(err instanceof Error ? err.message : 'Unable to load incidents')).finally(() => setLoading(false))
  }, [])

  const counts = useMemo(() => Object.fromEntries(tabs.map((tab) => [tab.value, tab.value === 'ALL' ? incidents.length : incidents.filter((item) => item.reviewStatus === tab.value).length])), [incidents])
  const filtered = useMemo(() => incidents.filter((incident) => {
    if (filter !== 'ALL' && incident.reviewStatus !== filter) return false
    const query = search.trim().toLowerCase()
    if (query && !`${incident.cameraLabel} ${incident.detectionType} ${incident.reviewedBy ?? ''} ${window.localStorage.getItem(`virtual-guard:incident-note:${incident.id}`) ?? ''}`.toLowerCase().includes(query)) return false
    return !date || new Date(incident.detectedAt).toLocaleDateString('en-CA') === date
  }), [incidents, filter, search, date])
  const grouped = useMemo(() => Object.entries(filtered.reduce<Record<string, Incident[]>>((result, incident) => {
    const key = new Date(incident.detectedAt).toLocaleDateString('en-CA'); (result[key] ??= []).push(incident); return result
  }, {})).sort(([a], [b]) => b.localeCompare(a)), [filtered])

  async function review(incident: Incident, decision: 'CONFIRMED'|'DISMISSED'|'ESCALATED') {
    setUpdating(incident.id); setError(null)
    try {
      const updated = await incidentService.review(incident.id, decision)
      setIncidents((items) => items.map((item) => item.id === updated.id ? updated : item))
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT))
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to review incident') }
    finally { setUpdating(null) }
  }

  function exportHistory() {
    const rows = [['Detected','Camera','Behaviour','Confidence','Suspicion','Status','Reviewed by'], ...filtered.map((i) => [i.detectedAt,i.cameraLabel,i.detectionType,i.confidence,i.suspicionScore??'',i.reviewStatus,i.reviewedBy??''])]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"','""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), link = document.createElement('a'); link.href=url; link.download='virtual-guard-review-history.csv'; link.click(); URL.revokeObjectURL(url)
  }

  if (loading) return <div className="py-16 text-center text-sm text-text-muted">Loading incidents…</div>
  return <Card className="mx-auto min-h-[calc(100vh-112px)] w-full max-w-[1800px] overflow-hidden">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-5"><div><h1 className="text-3xl font-semibold tracking-tight">Incident review history</h1><p className="mt-1 text-sm text-text-secondary">A complete audit trail of AI alerts and officer decisions.</p></div><Button icon={<Download className="h-4 w-4"/>} onClick={exportHistory} disabled={!filtered.length}>Export history</Button></div>
    <div className="flex flex-col justify-between gap-4 border-b border-line px-6 py-5 xl:flex-row">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{tabs.map((tab) => <button key={tab.value} onClick={()=>{setFilter(tab.value);setExpandedId(null)}} className={`flex h-12 min-w-28 items-center justify-center gap-3 rounded-lg border px-4 text-sm transition-colors ${filter===tab.value?'border-status-info bg-status-info/15 text-text-primary':'border-line-strong bg-surface-2 text-text-secondary hover:bg-surface-3'}`}><span className={`h-2.5 w-2.5 rounded-full ${tab.dot}`}/>{tab.label}<span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs">{counts[tab.value] ?? 0}</span></button>)}</div>
      <div className="flex gap-3"><label className="flex h-12 min-w-72 items-center gap-3 rounded-lg border border-line-strong bg-surface-2 px-4"><Search className="h-4 w-4 text-text-secondary"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search camera, behaviour, or reviewer…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted"/></label><label className="flex h-12 items-center gap-3 rounded-lg border border-line-strong bg-surface-2 px-4"><CalendarDays className="h-4 w-4 text-text-secondary"/><input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="bg-transparent text-sm outline-none"/></label></div>
    </div>
    {error && <div className="m-5 rounded-lg border border-status-alert/30 bg-status-alert/10 px-4 py-3 text-sm text-status-alert">{error}</div>}
    {!filtered.length ? <div className="flex min-h-[540px] flex-col items-center justify-center px-6 text-center"><ClipboardCheck className="h-28 w-28 text-[#7084a5]" strokeWidth={1}/><h2 className="mt-6 text-2xl font-semibold">You're all caught up</h2><p className="mt-3 text-sm text-text-secondary">{filter==='PENDING_REVIEW'?'New AI-generated alerts awaiting human review will appear here.':'No incidents match the selected status and filters.'}</p>{filter!=='ALL'&&<Button className="mt-8" onClick={()=>setFilter('ALL')}>View all incidents <ArrowRight className="h-4 w-4"/></Button>}</div> :
      <div className="space-y-7 p-6">{grouped.map(([day, items]) => <section key={day}><h2 className="mb-4 text-lg font-semibold">{new Date(`${day}T12:00:00`).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})} <span className="text-xs font-normal text-text-secondary">({items.length} event{items.length===1?'':'s'})</span></h2><div className="relative space-y-2 border-l-2 border-line-strong pl-5">{items.map((incident) => {
        const open=expandedId===incident.id, detected=new Date(incident.detectedAt), reviewer=incident.reviewedBy??user?.name??'Awaiting review', note=window.localStorage.getItem(`virtual-guard:incident-note:${incident.id}`) || (incident.reviewStatus==='ESCALATED'?'Forwarded for security investigation.':incident.reviewStatus==='DISMISSED'?'Alert reviewed — no further action required.':incident.reviewStatus==='CONFIRMED'?'Incident confirmed after footage review.':'Awaiting an officer decision.')
        return <div key={incident.id} className="relative"><span className={`absolute -left-[30px] top-7 h-4 w-4 rounded-full ring-4 ring-surface-0 ${statusDot(incident.reviewStatus)}`}/><div className={`overflow-hidden rounded-xl border bg-surface-1 ${open?'border-status-info':'border-line-strong'}`}><div className="grid min-h-[72px] grid-cols-[125px_1fr_1.15fr_.85fr_.85fr_1fr_1.4fr_150px_20px] items-center gap-4 px-5 py-3 text-sm"><b>{detected.toLocaleTimeString([],{hour:'numeric',minute:'2-digit',second:'2-digit'})}</b><div><b>{incident.cameraLabel}</b><small className="block text-text-secondary">Camera</small></div><div>{incident.detectionType.replaceAll('_',' ')}<small className="block text-text-secondary">Behaviour</small></div><div>{normalized(incident.confidence).toFixed(1)}%<small className="block text-text-secondary">Confidence</small></div><div>{incident.suspicionScore==null?'--':`${normalized(incident.suspicionScore).toFixed(1)}%`}<small className="block text-text-secondary">Suspicion</small></div><Badge variant={variant(incident.reviewStatus)} className="w-fit">{statusLabel(incident.reviewStatus)}</Badge><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#31486d] text-xs font-semibold">{reviewer.split(/\s|@/).filter(Boolean).slice(0,2).map(n=>n[0]?.toUpperCase()).join('')}</span><div className="min-w-0"><b className="block truncate">{reviewer}</b><small className="block truncate text-text-secondary">Reviewed by</small></div></div><Button size="sm" icon={<Eye className="h-4 w-4"/>} disabled={!evidenceName(incident)} onClick={()=>setFootage(incident)}>View footage</Button><button onClick={()=>setExpandedId(open?null:incident.id)} aria-label="Toggle review details">{open?<ChevronUp className="h-4 w-4"/>:<ChevronDown className="h-4 w-4"/>}</button></div>
          {open&&<div className="border-t border-line px-6 py-4"><h3 className="mb-4 text-sm font-semibold">Review details</h3><div className="grid gap-5 lg:grid-cols-3"><div className="border-r border-line pr-5"><b className="text-xs text-text-secondary">AI analysis</b><dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><dt className="text-text-secondary">Behaviour</dt><dd>{incident.detectionType.replaceAll('_',' ')}</dd><dt className="text-text-secondary">Confidence</dt><dd>{normalized(incident.confidence).toFixed(1)}%</dd><dt className="text-text-secondary">Suspicion</dt><dd>{incident.suspicionScore==null?'--':`${normalized(incident.suspicionScore).toFixed(1)}%`}</dd></dl></div><div className="border-r border-line pr-5"><b className="text-xs text-text-secondary">Human decision</b>{incident.reviewStatus==='PENDING_REVIEW'?<div className="mt-4 flex flex-wrap gap-2"><Button size="sm" disabled={updating===incident.id} icon={<X className="h-3.5 w-3.5"/>} onClick={()=>void review(incident,'DISMISSED')}>Dismiss</Button><Button size="sm" disabled={updating===incident.id} icon={<Check className="h-3.5 w-3.5"/>} onClick={()=>void review(incident,'CONFIRMED')}>Confirm</Button><Button size="sm" disabled={updating===incident.id} icon={<ShieldAlert className="h-3.5 w-3.5"/>} onClick={()=>void review(incident,'ESCALATED')}>Escalate</Button></div>:<dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><dt className="text-text-secondary">Decision</dt><dd><Badge variant={variant(incident.reviewStatus)}>{statusLabel(incident.reviewStatus)}</Badge></dd><dt className="text-text-secondary">Reviewed by</dt><dd>{reviewer}</dd><dt className="text-text-secondary">Timestamp</dt><dd>{incident.reviewedAt?new Date(incident.reviewedAt).toLocaleString():'--'}</dd></dl>}</div><div><b className="text-xs text-text-secondary">Audit note</b><p className="mt-3 flex gap-2 text-sm"><FileText className="h-4 w-4 shrink-0 text-status-info"/>{note}</p><div className="mt-5 flex flex-wrap gap-2"><Button size="sm" icon={<Eye className="h-4 w-4"/>} disabled={!evidenceName(incident)} onClick={()=>setFootage(incident)}>View footage</Button><Button size="sm" icon={<ExternalLink className="h-4 w-4"/>} onClick={()=>navigate(ROUTES.reports)}>Open incident</Button></div></div></div></div>}
        </div></div>
      })}</div></section>)}</div>}

    <Modal open={footage!==null} onClose={()=>setFootage(null)} title={`${footage?.cameraLabel??'Incident'} footage`}>
      {footage&&evidenceUrl(footage,authToken)&&<video controls autoPlay preload="metadata" src={evidenceUrl(footage,authToken)} className="aspect-video w-full rounded-lg bg-black object-contain"/>}
    </Modal>
  </Card>
}
