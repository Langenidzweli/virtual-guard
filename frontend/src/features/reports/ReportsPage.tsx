import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Download, FileText, Filter, Play, Search } from 'lucide-react'
import { Badge, Button, Card } from '@/components/ui'
import { useAuthToken } from '@/features/auth/useAuthToken'
import { incidentService } from '@/services/incidentService'
import type { Incident, ReviewStatus } from '@/types'

type StatusFilter = ReviewStatus | 'ALL'
type Decision = Exclude<ReviewStatus, 'PENDING_REVIEW'>
const PAGE_SIZE = 6
const NOTIFICATIONS_CHANGED_EVENT = 'virtual-guard:notifications-changed'

function normalizedPercent(value: number | null): number {
  if (value == null) return 0
  return value <= 1 ? value * 100 : value
}

function statusVariant(status: ReviewStatus): 'warning' | 'success' | 'danger' | 'neutral' {
  if (status === 'PENDING_REVIEW') return 'warning'
  if (status === 'CONFIRMED') return 'success'
  if (status === 'ESCALATED') return 'danger'
  return 'neutral'
}

function statusColor(status: ReviewStatus): string {
  if (status === 'CONFIRMED') return 'bg-status-normal'
  if (status === 'ESCALATED') return 'bg-status-alert'
  if (status === 'PENDING_REVIEW') return 'bg-status-review'
  return 'bg-[#8ca1c3]'
}

function videoName(incident: Incident): string | null {
  if (incident.annotatedVideoFileName) return incident.annotatedVideoFileName
  const path = incident.evidence?.annotatedVideoPath
  return typeof path === 'string' ? path.split(/[\\/]/).pop() ?? null : null
}

function videoUrl(incident: Incident, token: string | null): string | undefined {
  const name = videoName(incident)
  if (!name) return undefined
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8090'
  const url = new URL(`/api/video/${encodeURIComponent(name)}`, `${base}/`)
  if (token) url.searchParams.set('token', token)
  return url.toString()
}

function csvCell(value: unknown): string {
  let text = String(value ?? '')
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export function ReportsPage() {
  const authToken = useAuthToken()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [date, setDate] = useState('')
  const [page, setPage] = useState(1)
  const [notes, setNotes] = useState('')
  const [decision, setDecision] = useState<Decision | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    incidentService.list().then((items) => {
      setIncidents(items)
      setSelectedId(items[0]?.id ?? null)
    }).catch((err) => setError(err instanceof Error ? err.message : 'Unable to load reports'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => incidents.filter((incident) => {
    const query = search.trim().toLowerCase()
    if (query && !`${incident.id} ${incident.cameraLabel} ${incident.detectionType}`.toLowerCase().includes(query)) return false
    if (status !== 'ALL' && incident.reviewStatus !== status) return false
    if (date && new Date(incident.detectedAt).toLocaleDateString('en-CA') !== date) return false
    return true
  }), [incidents, search, status, date])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const selected = incidents.find((incident) => incident.id === selectedId) ?? visible[0] ?? null

  useEffect(() => { setPage(1) }, [search, status, date])
  useEffect(() => {
    if (!selected) { setNotes(''); setDecision(null); return }
    setNotes(window.localStorage.getItem(`virtual-guard:incident-note:${selected.id}`) ?? '')
    setDecision(selected.reviewStatus === 'PENDING_REVIEW' ? null : selected.reviewStatus)
    setSaved(false)
  }, [selected])

  function exportCsv() {
    const columns = ['Incident ID','Detected at','Camera','Behaviour','Confidence','Suspicion score','Review status','Reviewed by','Reviewed at']
    const rows = filtered.map((i) => [i.id,i.detectedAt,i.cameraLabel,i.detectionType,i.confidence,i.suspicionScore,i.reviewStatus,i.reviewedBy,i.reviewedAt])
    const csv = [columns,...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), anchor = document.createElement('a')
    anchor.href = url; anchor.download = `virtual-guard-incidents-${new Date().toISOString().slice(0,10)}.csv`; anchor.click(); URL.revokeObjectURL(url)
  }

  async function saveReview() {
    if (!selected) return
    setSaving(true); setSaved(false); setError(null)
    try {
      let updated = selected
      if (selected.reviewStatus === 'PENDING_REVIEW' && decision) updated = await incidentService.review(selected.id, decision)
      window.localStorage.setItem(`virtual-guard:incident-note:${selected.id}`, notes)
      setIncidents((items) => items.map((item) => item.id === updated.id ? updated : item))
      setDecision(updated.reviewStatus === 'PENDING_REVIEW' ? null : updated.reviewStatus)
      setSaved(true)
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT))
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save review') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="py-16 text-center text-sm text-text-muted">Loading report data…</div>
  const confidence = selected ? normalizedPercent(selected.confidence) : 0

  return <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4">
    <div className="flex items-center justify-between"><div><h1 className="text-3xl font-semibold tracking-tight">Incident reports</h1><p className="mt-1 text-sm text-text-secondary">Review and manage AI-generated incident records.</p></div><Button className="border-status-info bg-status-info/10 text-status-info hover:bg-status-info/20" icon={<Download className="h-4 w-4"/>} onClick={exportCsv} disabled={!filtered.length}>Export CSV</Button></div>
    {error && <div className="rounded-lg border border-status-alert/30 bg-status-alert/10 px-4 py-3 text-sm text-status-alert">{error}</div>}

    <Card className="grid gap-3 p-3 md:grid-cols-[minmax(240px,1.7fr)_minmax(170px,.65fr)_minmax(180px,.8fr)_40px]">
      <label className="flex h-10 items-center gap-3 rounded-lg border border-line-strong bg-surface-2 px-3"><Search className="h-4 w-4 text-text-secondary"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search reports" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted"/></label>
      <select value={status} onChange={(e)=>setStatus(e.target.value as StatusFilter)} className="h-10 rounded-lg border border-line-strong bg-surface-2 px-3 text-sm outline-none"><option value="ALL">All statuses</option><option value="PENDING_REVIEW">Pending review</option><option value="CONFIRMED">Confirmed</option><option value="DISMISSED">Dismissed</option><option value="ESCALATED">Escalated</option></select>
      <label className="flex h-10 items-center gap-3 rounded-lg border border-line-strong bg-surface-2 px-3"><CalendarDays className="h-4 w-4 text-text-secondary"/><input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></label>
      <button aria-label="Apply report filters" className="flex h-10 items-center justify-center rounded-lg border border-line-strong bg-surface-2 text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"><Filter className="h-4 w-4"/></button>
    </Card>

    <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(380px,1fr)]">
      <Card className="flex min-h-[654px] flex-col overflow-hidden">
        <div className="flex-1">{visible.length ? visible.map((incident) => {
          const active = selected?.id === incident.id, detected = new Date(incident.detectedAt)
          return <button key={incident.id} onClick={()=>setSelectedId(incident.id)} className={`grid min-h-[88px] w-full grid-cols-[12px_minmax(0,1fr)_100px_116px_20px] items-center gap-4 border-b border-line px-5 py-4 text-left transition-colors hover:bg-surface-2 ${active?'bg-status-info/10 ring-1 ring-inset ring-status-info':''}`}>
            <span className={`h-13 w-2 rounded-full ${statusColor(incident.reviewStatus)}`}/><div className="min-w-0"><b className="block text-base">{detected.toLocaleString()}</b><span className="mt-1 block truncate text-sm text-text-secondary">{incident.cameraLabel}<span className="mx-2 text-text-muted">|</span>{incident.detectionType.replaceAll('_',' ')}</span></div>
            <div><b className="block text-sm">{normalizedPercent(incident.confidence).toFixed(1)}%</b><span className="text-[11px] text-text-secondary">confidence</span></div><Badge variant={statusVariant(incident.reviewStatus)} className="justify-self-start">{incident.reviewStatus.replaceAll('_',' ')}</Badge><ChevronRight className="h-5 w-5 text-text-secondary"/>
          </button>
        }) : <div className="flex h-full flex-col items-center justify-center gap-2 py-20 text-text-muted"><FileText className="h-8 w-8"/><span className="text-sm">No reports match these filters.</span></div>}</div>
        <div className="flex items-center justify-between border-t border-line px-5 py-4 text-xs text-text-secondary"><span>{filtered.length} reports</span><div className="flex items-center gap-3"><Button size="sm" onClick={()=>setPage((p)=>Math.max(1,p-1))} disabled={page===1} icon={<ChevronLeft className="h-3.5 w-3.5"/>}>Previous</Button><span>{page} / {pageCount}</span><Button size="sm" onClick={()=>setPage((p)=>Math.min(pageCount,p+1))} disabled={page===pageCount}>Next <ChevronRight className="h-3.5 w-3.5"/></Button></div></div>
      </Card>

      <Card className="min-h-[654px] overflow-hidden">
        {selected ? <><div className="flex items-center justify-between border-b border-line px-5 py-4"><div><h2 className="text-lg font-semibold">Report details</h2><p className="mt-1 text-xs text-text-secondary">ID: {selected.id}</p></div><Badge variant={statusVariant(selected.reviewStatus)}>{selected.reviewStatus.replaceAll('_',' ')}</Badge></div>
          <div className="space-y-4 p-5"><dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-2 text-sm"><dt className="text-text-secondary">Detected</dt><dd>{new Date(selected.detectedAt).toLocaleString()}</dd><dt className="text-text-secondary">Camera</dt><dd>{selected.cameraLabel}</dd><dt className="text-text-secondary">Behaviour</dt><dd>{selected.detectionType.replaceAll('_',' ')}</dd><dt className="text-text-secondary">Suspicion</dt><dd>{selected.suspicionScore == null?'--':`${normalizedPercent(selected.suspicionScore).toFixed(1)}%`}</dd></dl>
            <div className="border-y border-line py-3"><div className="mb-2 flex justify-between text-xs"><span>Confidence</span><span>{confidence.toFixed(1)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-status-info" style={{width:`${Math.min(100,confidence)}%`}}/></div></div>
            <div><p className="mb-2 text-xs font-medium">Video evidence</p><div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1.65fr)_minmax(140px,1fr)]">{videoUrl(selected,authToken) ? <video key={selected.id} controls preload="metadata" src={videoUrl(selected,authToken)} className="aspect-video w-full rounded-lg border border-line-strong bg-black object-contain"/> : <div className="flex aspect-video items-center justify-center rounded-lg border border-line-strong bg-surface-2 text-xs text-text-muted">No video evidence available</div>}<Button className="h-12 border-status-info bg-status-info text-white hover:bg-status-info/90" disabled={!videoUrl(selected,authToken)} icon={<Play className="h-4 w-4 fill-current"/>} onClick={()=>{const video=document.querySelector<HTMLVideoElement>(`video[src="${videoUrl(selected,authToken)}"]`);void video?.play()}}>View evidence</Button></div></div>
            <div className="border-t border-line pt-3"><p className="mb-2 text-xs font-medium">Officer decision</p><div className="grid grid-cols-3 gap-2">{([['DISMISSED','Dismiss'],['CONFIRMED','Confirm'],['ESCALATED','Escalate']] as Array<[Decision,string]>).map(([value,label])=><button key={value} disabled={selected.reviewStatus!=='PENDING_REVIEW'} onClick={()=>setDecision(value)} className={`h-9 rounded-lg border text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${decision===value?(value==='ESCALATED'?'border-status-alert bg-status-alert/10 text-status-alert':value==='CONFIRMED'?'border-status-normal bg-status-normal/10 text-status-normal':'border-status-info bg-status-info/10 text-status-info'):'border-line-strong text-text-secondary hover:bg-surface-2'}`}>{label}</button>)}</div></div>
            <label className="block"><span className="mb-2 block text-xs text-text-secondary">Investigation notes</span><textarea value={notes} onChange={(e)=>{setNotes(e.target.value);setSaved(false)}} rows={3} placeholder="Add investigation notes…" className="w-full resize-none rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-text-muted focus:border-status-info"/></label>
            <Button className="w-full bg-status-info hover:bg-status-info/90" disabled={saving || (selected.reviewStatus==='PENDING_REVIEW'&&!decision)} onClick={()=>void saveReview()} icon={<Play className="h-3.5 w-3.5"/>}>{saving?'Saving…':saved?'Review saved':'Save review'}</Button>
          </div></> : <div className="flex h-full items-center justify-center text-sm text-text-muted">Select a report to view its details.</div>}
      </Card>
    </div>
  </div>
}
