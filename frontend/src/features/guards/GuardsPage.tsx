import { useMemo, useState } from 'react'
import { BadgeCheck, CalendarDays, ChevronLeft, ChevronRight, Ellipsis, Mail, Pencil, RefreshCw, Search, ShieldX, UserPlus } from 'lucide-react'
import { Badge, Button, Card } from '@/components/ui'
import { GuardStatusBadge } from './components/GuardStatusBadge'
import { GuardFormModal } from './components/GuardFormModal'
import { useGuards } from './hooks/useGuards'
import type { Guard, GuardStatus } from '@/types'

type ModalState = { mode: 'add' | 'edit' | 'view'; guard: Guard | null } | null
type GuardFilter = 'ALL' | 'ACTIVE' | 'DEACTIVATED'
type SortOrder = 'RECENT' | 'OLDEST' | 'NAME'
const PAGE_SIZE = 5

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'GU'
}

export function GuardsPage() {
  const { guards, isLoading, error, addGuard, editGuard, setGuardStatus } = useGuards()
  const [modal, setModal] = useState<ModalState>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<GuardFilter>('ALL')
  const [sort, setSort] = useState<SortOrder>('RECENT')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => guards.filter((guard) => {
    if (filter !== 'ALL' && guard.status !== filter) return false
    const query = search.trim().toLowerCase()
    return !query || `${guard.name} ${guard.email} ${guard.badgeNumber} ${guard.phone}`.toLowerCase().includes(query)
  }).sort((a, b) => sort === 'NAME' ? a.name.localeCompare(b.name) : sort === 'OLDEST'
    ? new Date(a.dateJoined).getTime() - new Date(b.dateJoined).getTime()
    : new Date(b.dateJoined).getTime() - new Date(a.dateJoined).getTime()), [guards, filter, search, sort])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const counts = { ALL: guards.length, ACTIVE: guards.filter((g) => g.status === 'ACTIVE').length, DEACTIVATED: guards.filter((g) => g.status === 'DEACTIVATED').length }

  async function handleFormSubmit(values: Parameters<typeof addGuard>[0]) {
    if (modal?.mode === 'add') await addGuard(values)
    else if (modal?.mode === 'edit' && modal.guard) await editGuard(modal.guard.id, values)
    setModal(null)
  }

  async function changeStatus(guard: Guard, status: GuardStatus) {
    setBusyId(guard.id)
    try { await setGuardStatus(guard.id, status) } finally { setBusyId(null) }
  }

  if (isLoading) return <div className="py-16 text-center text-sm text-text-muted">Loading guards…</div>
  return <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-5">
    <div className="flex items-center justify-between"><div><h1 className="text-3xl font-semibold tracking-tight">Security guards</h1><p className="mt-1 text-sm text-text-secondary">Manage guard profiles and system access.</p></div><Button className="border-status-info bg-status-info text-white hover:bg-status-info/90" icon={<UserPlus className="h-4 w-4"/>} onClick={()=>setModal({mode:'add',guard:null})}>Add guard</Button></div>
    {error && <div className="rounded-lg border border-status-alert/30 bg-status-alert/10 px-4 py-3 text-sm text-status-alert">{error}</div>}
    <div className="grid gap-4 lg:grid-cols-[minmax(280px,1.2fr)_auto_minmax(190px,.4fr)]">
      <label className="flex h-12 items-center gap-3 rounded-lg border border-line-strong bg-surface-1 px-4"><Search className="h-5 w-5 text-text-secondary"/><input value={search} onChange={(e)=>{setSearch(e.target.value);setPage(1)}} placeholder="Search guards" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted"/></label>
      <div className="grid grid-cols-3 gap-3">{(['ALL','ACTIVE','DEACTIVATED'] as GuardFilter[]).map((value)=><button key={value} onClick={()=>{setFilter(value);setPage(1)}} className={`flex h-12 min-w-32 items-center justify-center gap-3 rounded-lg border px-4 text-sm ${filter===value?'border-status-info bg-status-info/15':'border-line-strong bg-surface-1 text-text-secondary hover:bg-surface-2'}`}>{value==='ALL'?'All':value==='ACTIVE'?'Active':'Deactivated'}<span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs">{counts[value]}</span></button>)}</div>
      <select value={sort} onChange={(e)=>setSort(e.target.value as SortOrder)} className="h-12 rounded-lg border border-line-strong bg-surface-1 px-4 text-sm outline-none"><option value="RECENT">Recently joined</option><option value="OLDEST">Oldest joined</option><option value="NAME">Name A–Z</option></select>
    </div>

    <div className="space-y-3">{visible.map((guard) => {
      const expanded=expandedId===guard.id, joined=new Date(guard.dateJoined), active=guard.status==='ACTIVE'
      return <Card key={guard.id} className={`overflow-hidden ${expanded?'border-status-info ring-1 ring-status-info/40':''}`}>
        <div className="grid min-h-[112px] grid-cols-[76px_minmax(180px,1fr)_150px_180px_1px_180px_140px_48px] items-center gap-6 px-7 py-4">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#50698f] to-[#2c3e5d] text-lg font-semibold"><span>{initials(guard.name)}</span><span className={`absolute bottom-1 right-0 h-4 w-4 rounded-full border-2 border-surface-1 ${active?'bg-status-normal':'bg-[#9badca]'}`}/></div>
          <div className="min-w-0"><b className="block truncate text-base">{guard.name}</b><span className="mt-1 block truncate text-sm text-text-secondary">{guard.email}</span></div>
          <Badge className="w-fit text-sm">{guard.badgeNumber}</Badge>
          <div><GuardStatusBadge status={guard.status}/><small className="mt-2 block text-text-secondary">Guard account</small></div><span className="h-14 bg-line"/>
          <div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-text-secondary"/><div><small className="block text-text-secondary">Joined</small><span className="text-sm">{joined.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span></div></div>
          <Button onClick={()=>setExpandedId(expanded?null:guard.id)}>{expanded?'Close profile':'View profile'}</Button>
          <button onClick={()=>setExpandedId(expanded?null:guard.id)} aria-label="Guard options" className="flex h-11 w-11 items-center justify-center rounded-lg border border-line-strong text-text-secondary hover:bg-surface-2"><Ellipsis className="h-5 w-5"/></button>
        </div>
        {expanded&&<div className="grid gap-7 border-t border-line px-7 py-5 lg:grid-cols-3">
          <section className="border-r border-line pr-7"><h2 className="mb-5 text-sm font-semibold">Account details</h2><dl className="grid grid-cols-[28px_140px_1fr] gap-y-4 text-sm"><Mail className="h-5 w-5 text-text-secondary"/><dt className="text-text-secondary">Email</dt><dd className="truncate">{guard.email}</dd><BadgeCheck className="h-5 w-5 text-text-secondary"/><dt className="text-text-secondary">Badge number</dt><dd>{guard.badgeNumber}</dd><CalendarDays className="h-5 w-5 text-text-secondary"/><dt className="text-text-secondary">Joined date</dt><dd>{joined.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</dd></dl></section>
          <section className="border-r border-line pr-7"><h2 className="mb-4 text-sm font-semibold">Access status</h2><GuardStatusBadge status={guard.status}/><p className="mt-3 text-sm text-text-secondary">{guard.status==='ACTIVE'?'This guard can sign in.':guard.status==='SUSPENDED'?'This guard is temporarily unable to sign in.':'This guard cannot sign in.'}</p></section>
          <section><h2 className="mb-4 text-sm font-semibold">Account actions</h2><div className="flex flex-wrap gap-3"><Button icon={<Pencil className="h-4 w-4"/>} onClick={()=>setModal({mode:'edit',guard})}>Edit guard</Button>{guard.status==='ACTIVE'?<Button className="border-status-alert text-status-alert" disabled={busyId===guard.id} icon={<ShieldX className="h-4 w-4"/>} onClick={()=>void changeStatus(guard,'DEACTIVATED')}>Deactivate account</Button>:<Button className="border-status-info text-status-info" disabled={busyId===guard.id} icon={<RefreshCw className="h-4 w-4"/>} onClick={()=>void changeStatus(guard,'ACTIVE')}>Reactivate account</Button>}</div><div className="mt-5 border-t border-line pt-4"><p className="text-xs text-text-secondary">Recent activity</p><p className="mt-2 text-sm">Account status: {guard.status.toLowerCase()}</p></div></section>
        </div>}
      </Card>
    })}</div>
    {!visible.length&&<Card className="py-20 text-center text-sm text-text-muted">No guards match your search and status filters.</Card>}
    <div className="flex items-center justify-between text-sm text-text-secondary"><span>Showing {filtered.length} guard{filtered.length===1?'':'s'}</span><div className="flex items-center gap-2"><button className="flex h-10 w-10 items-center justify-center rounded-lg border border-line disabled:opacity-30" disabled={page===1} onClick={()=>setPage((p)=>p-1)}><ChevronLeft className="h-4 w-4"/></button><span className="flex h-10 min-w-10 items-center justify-center rounded-lg border border-status-info bg-status-info/10 text-text-primary">{page}</span><button className="flex h-10 w-10 items-center justify-center rounded-lg border border-line disabled:opacity-30" disabled={page===pages} onClick={()=>setPage((p)=>p+1)}><ChevronRight className="h-4 w-4"/></button></div></div>
    <GuardFormModal mode={modal?.mode??'add'} guard={modal?.guard??null} open={modal!==null} onClose={()=>setModal(null)} onSubmit={handleFormSubmit}/>
  </div>
}
