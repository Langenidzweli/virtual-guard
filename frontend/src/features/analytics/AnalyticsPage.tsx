import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, Camera, CheckCircle2, Clock3, Download, Gauge, Info, ShieldAlert, TrendingUp } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { incidentService } from '@/services/incidentService'
import type { Incident, ReviewStatus } from '@/types'

type DateRange = '7' | '30' | 'all'
const outcomes: Array<[ReviewStatus, string, string]> = [
  ['PENDING_REVIEW', 'Pending', '#f5a623'], ['CONFIRMED', 'Confirmed', '#22c55e'],
  ['ESCALATED', 'Escalated', '#e0293e'], ['DISMISSED', 'Dismissed', '#64789b'],
]
const percent = (value: number) => value <= 1 ? value * 100 : value
const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const shortDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h2 className="text-xs font-semibold tracking-wider uppercase">{title}</h2><p className="mt-1 text-xs text-text-secondary">{subtitle}</p></div>
}

export function AnalyticsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [range, setRange] = useState<DateRange>('7')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    incidentService.list().then((data) => { if (!cancelled) setIncidents(data) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load analytics') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const data = useMemo(() => {
    const now = new Date(), days = range === 'all' ? null : Number(range)
    const cutoff = days ? dayStart(new Date(now.getTime() - (days - 1) * 86400000)) : null
    const items = incidents.filter((item) => !cutoff || new Date(item.detectedAt) >= cutoff)
    const chartDays = days ?? 30
    const trend = Array.from({ length: chartDays }, (_, index) => {
      const date = dayStart(new Date(now.getTime() - (chartDays - 1 - index) * 86400000)), next = new Date(date.getTime() + 86400000)
      return { date, count: items.filter((item) => { const d = new Date(item.detectedAt); return d >= date && d < next }).length }
    })
    const cameras = Object.entries(items.reduce<Record<string, number>>((all, item) => ({ ...all, [item.cameraLabel]: (all[item.cameraLabel] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])
    const reviews = outcomes.map(([status, label, color]) => ({ status, label, color, count: items.filter((item) => item.reviewStatus === status).length }))
    const heat = Array.from({ length: 7 }, (_, weekday) => Array.from({ length: 24 }, (_, hour) => items.filter((item) => { const d = new Date(item.detectedAt); return (d.getDay() + 6) % 7 === weekday && d.getHours() === hour }).length))
    const hours = Array.from({ length: 24 }, (_, hour) => items.filter((item) => new Date(item.detectedAt).getHours() === hour).length)
    return { items, trend, cameras, reviews, heat, pending: reviews[0]?.count ?? 0, confirmed: reviews[1]?.count ?? 0,
      confidence: items.length ? items.reduce((sum, item) => sum + percent(item.confidence), 0) / items.length : 0,
      peak: [...trend].sort((a, b) => b.count - a.count)[0], peakHour: hours.indexOf(Math.max(...hours)) }
  }, [incidents, range])

  function exportCsv() {
    const rows = [['Detected at','Camera','Detection','Confidence','Suspicion score','Review status'], ...data.items.map((i) => [i.detectedAt, i.cameraLabel, i.detectionType, percent(i.confidence).toFixed(1), i.suspicionScore ?? '', i.reviewStatus])]
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), link = document.createElement('a')
    link.href = url; link.download = `virtual-guard-analytics-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url)
  }

  if (loading) return <div className="py-16 text-center text-sm text-text-muted">Loading analytics…</div>
  const maxTrend = Math.max(1, ...data.trend.map((i) => i.count)), maxCamera = Math.max(1, ...data.cameras.map(([, n]) => n)), maxHeat = Math.max(1, ...data.heat.flat())
  const points = data.trend.map((item, index) => `${4 + index / Math.max(1, data.trend.length - 1) * 92},${88 - item.count / maxTrend * 70}`).join(' ')
  let offset = 0

  return <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-semibold">Analytics</h1><p className="mt-1 text-sm text-text-secondary">Overview of security incidents and AI review outcomes</p></div><div className="flex gap-2">
      <label className="flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface-1 px-3 text-xs"><CalendarDays className="h-4 w-4 text-text-secondary"/><select value={range} onChange={(e) => setRange(e.target.value as DateRange)} className="bg-transparent outline-none"><option className="bg-surface-1" value="7">Last 7 days</option><option className="bg-surface-1" value="30">Last 30 days</option><option className="bg-surface-1" value="all">All time</option></select></label>
      <Button icon={<Download className="h-4 w-4"/>} onClick={exportCsv} disabled={!data.items.length}>Export</Button></div></div>
    {error && <div className="rounded-lg border border-status-alert/30 bg-status-alert/10 px-4 py-3 text-sm text-status-alert">{error}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      { label: 'Total incidents', value: data.items.length, Icon: ShieldAlert, color: 'text-status-info' },
      { label: 'Pending review', value: data.pending, Icon: AlertTriangle, color: 'text-status-review' },
      { label: 'Confirmed', value: data.confirmed, Icon: CheckCircle2, color: 'text-status-normal' },
      { label: 'Avg confidence', value: `${data.confidence.toFixed(1)}%`, Icon: Gauge, color: 'text-text-primary' },
    ].map(({label,value,Icon,color}) => <Card key={label} className="flex items-center justify-between p-5"><div><p className="text-xs uppercase tracking-wider text-text-secondary">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div><Icon className={`h-6 w-6 ${color}`}/></Card>)}</div>

    <div className="grid gap-4 lg:grid-cols-[1.75fr_1fr]">
      <Card className="min-h-[310px] p-5"><div className="flex justify-between"><PanelTitle title="Incident trend" subtitle={`Total incidents per day (${range === 'all' ? 'all time' : `last ${range} days`})`}/><span className="text-sm">Total: <b>{data.items.length}</b></span></div><div className="mt-4 h-56">{!data.items.length ? <div className="flex h-full items-center justify-center text-sm text-text-muted">No incidents in this period.</div> : <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">{[18,41,64,88].map(y=><line key={y} x1="4" x2="96" y1={y} y2={y} stroke="#293241" strokeWidth=".35"/>)}<polygon points={`4,88 ${points} 96,88`} fill="rgba(59,130,246,.18)"/><polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="1.2" vectorEffect="non-scaling-stroke"/>{points.split(' ').map((point,index)=>{const [x,y]=point.split(','); return <circle key={index} cx={x} cy={y} r="1" fill="#dbeafe" stroke="#3b82f6" strokeWidth=".7"/>})}</svg>}</div><div className="flex justify-between px-1 text-[10px] text-text-muted"><span>{shortDate(data.trend[0]!.date)}</span><span>{shortDate(data.trend[Math.floor(data.trend.length/2)]!.date)}</span><span>{shortDate(data.trend.at(-1)!.date)}</span></div></Card>
      <Card className="min-h-[310px] p-5"><PanelTitle title="Review outcomes" subtitle="Outcomes for AI-generated review cases"/><div className="mt-7 flex flex-col items-center justify-center gap-6 sm:flex-row lg:flex-col xl:flex-row"><div className="relative h-44 w-44 shrink-0"><svg viewBox="0 0 42 42" className="h-full w-full -rotate-90"><circle cx="21" cy="21" r="15.9" fill="none" stroke="#1b202c" strokeWidth="8"/>{data.reviews.map(o=>{const length=o.count/Math.max(1,data.items.length)*100, start=offset; offset+=length; return <circle key={o.status} cx="21" cy="21" r="15.9" fill="none" stroke={o.color} strokeWidth="8" strokeDasharray={`${length} ${100-length}`} strokeDashoffset={-start}/>})}</svg><div className="absolute inset-0 flex flex-col items-center justify-center"><b className="text-2xl">{data.items.length}</b><span className="text-xs text-text-secondary">Total</span></div></div><div className="w-full max-w-60 space-y-3">{data.reviews.map(o=><div key={o.status} className="flex items-center text-xs"><span className="mr-2 h-3 w-3 rounded-full" style={{background:o.color}}/>{o.label}<span className="ml-auto">{o.count} ({data.items.length?(o.count/data.items.length*100).toFixed(1):0}%)</span></div>)}</div></div></Card>
    </div>

    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1.05fr_1.15fr_.9fr]">
      <Card className="min-h-[285px] p-5"><PanelTitle title="Incidents by camera" subtitle={`Total incidents per camera (${range === 'all' ? 'all time' : `last ${range} days`})`}/><div className="mt-7 space-y-4">{data.cameras.length ? data.cameras.slice(0,6).map(([name,count])=><div key={name} className="grid grid-cols-[76px_1fr_24px] items-center gap-3 text-xs"><span className="truncate">{name}</span><div className="h-4 rounded-sm bg-surface-3"><div className="h-full rounded-sm bg-status-info" style={{width:`${count/maxCamera*100}%`}}/></div><span className="text-right">{count}</span></div>) : <p className="py-8 text-center text-sm text-text-muted">No camera activity yet.</p>}</div></Card>
      <Card className="min-h-[285px] p-5"><PanelTitle title="Risk by time" subtitle={`Incident frequency by day and hour (${range === 'all' ? 'all time' : `last ${range} days`})`}/><div className="mt-5 grid grid-cols-[28px_1fr] gap-2"><div className="grid grid-rows-7 text-[10px] leading-none text-text-secondary">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><span key={d} className="flex items-center">{d}</span>)}</div><div className="grid grid-cols-[repeat(24,minmax(0,1fr))] grid-rows-7 gap-0.5">{data.heat.flatMap((row,d)=>row.map((count,h)=><div key={`${d}-${h}`} title={`${count} incident(s)`} className="aspect-square min-h-2.5 rounded-[2px] border border-blue-400/10" style={{backgroundColor:count?`rgba(${count===maxHeat?'224,41,62':'59,130,246'},${.25+count/maxHeat*.75})`:'#182131'}}/>))}</div></div><div className="mt-3 flex justify-between pl-9 text-[10px] text-text-muted"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div><div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-text-secondary"><span>Low</span><div className="h-2 w-32 bg-gradient-to-r from-[#182131] via-status-info to-status-alert"/><span>High</span></div></Card>
      <Card className="min-h-[285px] p-5 lg:col-span-2 xl:col-span-1"><PanelTitle title="Recent insights" subtitle="Patterns in the selected period"/><div className="mt-3 divide-y divide-line"><div className="flex gap-3 py-4"><TrendingUp className="h-5 w-5 shrink-0 text-status-normal"/><div><b className="text-xs">{data.peak?.count?`Incidents peaked on ${shortDate(data.peak.date)}`:'No incident peak yet'}</b><p className="mt-1 text-xs text-text-secondary">{data.peak?.count??0} incident(s) on the busiest day.</p></div></div><div className="flex gap-3 py-4"><Camera className="h-5 w-5 shrink-0 text-status-info"/><div><b className="text-xs">{data.cameras[0]?`${data.cameras[0][0]} was most active`:'No active camera yet'}</b><p className="mt-1 text-xs text-text-secondary">{data.cameras[0]?.[1]??0} incident(s) recorded.</p></div></div><div className="flex gap-3 py-4"><Clock3 className="h-5 w-5 shrink-0 text-status-info"/><div><b className="text-xs">Highest activity around {String(data.peakHour).padStart(2,'0')}:00</b><p className="mt-1 text-xs text-text-secondary">Busiest hour in the selected period.</p></div></div></div></Card>
    </div>
    <p className="flex items-center gap-2 text-xs text-text-muted"><Info className="h-4 w-4 text-status-info"/>These figures describe AI-generated review cases and officer decisions. They do not represent proven offences.</p>
  </div>
}
