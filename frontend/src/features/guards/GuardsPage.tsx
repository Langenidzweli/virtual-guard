import { useMemo, useState } from 'react'
import { BadgeCheck, CalendarDays, ChevronLeft, ChevronRight, KeyRound, PauseCircle, Mail, Pencil, RefreshCw, Search, ShieldX, UserPlus } from 'lucide-react'
import { Badge, Button, Card, Modal } from '@/components/ui'
import { GuardStatusBadge } from './components/GuardStatusBadge'
import { GuardFormModal } from './components/GuardFormModal'
import { useGuards } from './hooks/useGuards'
import { guardService } from '@/services/guardService'
import type { Guard, GuardStatus } from '@/types'

type ModalState = { mode: 'add' | 'edit' | 'view'; guard: Guard | null } | null
type GuardFilter = 'ALL' | GuardStatus
type SortOrder = 'RECENT' | 'OLDEST' | 'NAME'
const PAGE_SIZE = 5

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'GU'
}

export function GuardsPage() {
  const { guards, isLoading, error, addGuard, editGuard, setGuardStatus } = useGuards()
  const [confirmation, setConfirmation] = useState<{guard: Guard; action: GuardStatus | 'RESET'} | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<GuardFilter>('ALL')
  const [sort, setSort] = useState<SortOrder>('RECENT')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [actionError, setActionError] = useState<string | null>(null)

  const filtered = useMemo(() => guards.filter((guard) => {
    if (filter !== 'ALL' && guard.status !== filter) return false
    const query = search.trim().toLowerCase()
    return !query || `${guard.name} ${guard.email} ${guard.badgeNumber} ${guard.phone}`.toLowerCase().includes(query)
  }).sort((a, b) => sort === 'NAME' ? a.name.localeCompare(b.name) : sort === 'OLDEST'
    ? new Date(a.dateJoined).getTime() - new Date(b.dateJoined).getTime()
    : new Date(b.dateJoined).getTime() - new Date(a.dateJoined).getTime()), [guards, filter, search, sort])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const activePage = Math.min(page, pages)
  const visible = filtered.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE)
  const counts = { ALL: guards.length, ACTIVE: guards.filter((g) => g.status === 'ACTIVE').length, SUSPENDED: guards.filter((g) => g.status === 'SUSPENDED').length, DEACTIVATED: guards.filter((g) => g.status === 'DEACTIVATED').length }

  async function handleFormSubmit(values: Parameters<typeof addGuard>[0]) {
    if (modal?.mode === 'add') await addGuard(values)
    else if (modal?.mode === 'edit' && modal.guard) await editGuard(modal.guard.id, values)
    setModal(null)
  }

  async function confirmAction() {
    if (!confirmation || busyId) return
    const { guard, action } = confirmation
    setBusyId(guard.id); setActionError(null); setNotice(null)
    try {
      if (action === 'RESET') await guardService.resetPassword(guard.id)
      else await setGuardStatus(guard.id, action)
      setNotice(action === 'RESET' ? 'Password reset to the configured temporary password. The guard must change it at next login.' : 'Guard access updated.')
      setConfirmation(null)
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Unable to update guard account') }
    finally { setBusyId(null) }
  }

  if (isLoading) return <div className="py-16 text-center text-sm text-text-muted">Loading guards…</div>
  return <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-semibold tracking-tight">Security guards</h1><p className="mt-1 text-sm text-text-secondary">Manage guard profiles and system access.</p></div><Button className="border-status-info bg-status-info text-white hover:bg-status-info/90" icon={<UserPlus className="h-4 w-4"/>} onClick={()=>setModal({mode:'add',guard:null})}>Add guard</Button></div>
    {notice && <p role="status" className="rounded-lg border border-status-normal/30 bg-status-normal/10 p-3 text-sm">{notice}</p>}
    {(actionError || error) && <div role="alert" className="rounded-lg border border-status-alert/30 bg-status-alert/10 px-4 py-3 text-sm text-status-alert">{actionError || error}</div>}
    <div className="grid gap-4 xl:grid-cols-[minmax(200px,1fr)_auto_minmax(180px,.4fr)]">
      <label className="flex h-12 items-center gap-3 rounded-lg border border-line-strong bg-surface-1 px-4"><Search className="h-5 w-5 text-text-secondary"/><input value={search} onChange={(e)=>{setSearch(e.target.value);setPage(1)}} placeholder="Search guards" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted"/></label>
      <div className="flex flex-wrap gap-2">{(['ALL','ACTIVE','SUSPENDED','DEACTIVATED'] as GuardFilter[]).map((value)=><button key={value} onClick={()=>{setFilter(value);setPage(1)}} className={`flex h-12 flex-1 items-center justify-center gap-3 rounded-lg border px-4 text-sm ${filter===value?'border-status-info bg-status-info/15':'border-line-strong bg-surface-1 text-text-secondary hover:bg-surface-2'}`}>{value==='ALL'?'All':value==='ACTIVE'?'Active':value==='SUSPENDED'?'Suspended':'Deactivated'}<span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs">{counts[value]}</span></button>)}</div>
      <select value={sort} onChange={(e)=>setSort(e.target.value as SortOrder)} className="h-12 rounded-lg border border-line-strong bg-surface-1 px-4 text-sm outline-none"><option value="RECENT">Recently joined</option><option value="OLDEST">Oldest joined</option><option value="NAME">Name A–Z</option></select>
    </div>

    <div className="space-y-3">{visible.map((guard) => {
      const expanded=expandedId===guard.id, joined=new Date(guard.dateJoined), active=guard.status==='ACTIVE'
      return <Card key={guard.id} className={`overflow-hidden ${expanded?'border-status-info ring-1 ring-status-info/40':''}`}>
        <div className="grid min-h-[112px] grid-cols-2 items-center gap-4 p-4 md:grid-cols-4 xl:grid-cols-[64px_minmax(150px,1fr)_100px_140px_1px_150px_120px]">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-surface-3 text-lg font-semibold"><span>{initials(guard.name)}</span><span className={`absolute bottom-1 right-0 h-4 w-4 rounded-full border-2 border-surface-1 ${active?'bg-status-normal':'bg-[#9badca]'}`}/></div>
          <div className="min-w-0"><b className="block truncate text-base">{guard.name}</b><span className="mt-1 block truncate text-sm text-text-secondary">{guard.email}</span></div>
          <Badge className="w-fit text-sm">{guard.badgeNumber}</Badge>
          <div><GuardStatusBadge status={guard.status}/><small className="mt-2 block text-text-secondary">Guard account</small></div><span className="hidden h-14 bg-line xl:block"/>
          <div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-text-secondary"/><div><small className="block text-text-secondary">Joined</small><span className="text-sm">{joined.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span></div></div>
          <Button onClick={()=>setExpandedId(expanded?null:guard.id)}>{expanded?'Close profile':'View profile'}</Button>
        </div>
        {expanded&&<div className="grid gap-7 border-t border-line px-7 py-5 lg:grid-cols-3">
          <section className="min-w-0 lg:border-r lg:border-line lg:pr-7"><h2 className="mb-5 text-sm font-semibold">Account details</h2><dl className="grid grid-cols-[24px_auto_minmax(0,1fr)] gap-x-2 gap-y-4 text-sm"><Mail className="h-5 w-5 text-text-secondary"/><dt className="text-text-secondary">Email</dt><dd className="break-all">{guard.email}</dd><BadgeCheck className="h-5 w-5 text-text-secondary"/><dt className="text-text-secondary">Badge number</dt><dd>{guard.badgeNumber}</dd><CalendarDays className="h-5 w-5 text-text-secondary"/><dt className="text-text-secondary">Joined date</dt><dd>{joined.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</dd></dl></section>
          <section className="min-w-0 lg:border-r lg:border-line lg:pr-7"><h2 className="mb-4 text-sm font-semibold">Access status</h2><GuardStatusBadge status={guard.status}/><p className="mt-3 text-sm text-text-secondary">{guard.loginAvailable === false ? 'No linked login account.' : guard.status==='ACTIVE'?'This guard can sign in.':guard.status==='SUSPENDED'?'This guard is temporarily unable to sign in.':'This guard cannot sign in.'}</p></section>
          <section><h2 className="mb-4 text-sm font-semibold">Account actions</h2><div className="flex flex-wrap gap-3"><Button icon={<Pencil className="h-4 w-4"/>} onClick={()=>setModal({mode:'edit',guard})}>Edit guard</Button>{guard.status==='ACTIVE' && <Button disabled={busyId===guard.id} icon={<PauseCircle className="h-4 w-4"/>} onClick={()=>{setActionError(null);setConfirmation({guard,action:'SUSPENDED'})}}>Suspend</Button>}
          {guard.status!=='ACTIVE' && <Button disabled={busyId===guard.id} icon={<RefreshCw className="h-4 w-4"/>} onClick={()=>{setActionError(null);setConfirmation({guard,action:'ACTIVE'})}}>Reactivate</Button>}
          {guard.status!=='DEACTIVATED' && <Button disabled={busyId===guard.id} className="text-status-alert" icon={<ShieldX className="h-4 w-4"/>} onClick={()=>{setActionError(null);setConfirmation({guard,action:'DEACTIVATED'})}}>Deactivate</Button>}
          <Button disabled={busyId===guard.id || guard.loginAvailable === false} icon={<KeyRound className="h-4 w-4"/>} onClick={()=>{setActionError(null);setConfirmation({guard,action:'RESET'})}}>Reset password</Button>
          </div></section>
        </div>}
      </Card>
    })}</div>
    {!visible.length&&<Card className="py-20 text-center text-sm text-text-muted">No guards match your search and status filters.</Card>}
    <div className="flex items-center justify-between text-sm text-text-secondary"><span>Showing {filtered.length} guard{filtered.length===1?'':'s'}</span><div className="flex items-center gap-2"><button className="flex h-10 w-10 items-center justify-center rounded-lg border border-line disabled:opacity-30" aria-label="Previous page" disabled={activePage===1} onClick={()=>setPage(Math.max(1,activePage-1))}><ChevronLeft className="h-4 w-4"/></button><span className="flex h-10 min-w-10 items-center justify-center rounded-lg border border-status-info bg-status-info/10 text-text-primary">{activePage}</span><button className="flex h-10 w-10 items-center justify-center rounded-lg border border-line disabled:opacity-30" aria-label="Next page" disabled={activePage===pages} onClick={()=>setPage(Math.min(pages,activePage+1))}><ChevronRight className="h-4 w-4"/></button></div></div>
    <Modal open={confirmation!==null} onClose={()=>{if(!busyId)setConfirmation(null)}} title={confirmation?.action==='RESET'?'Reset guard password':'Change guard access'} footer={<><Button disabled={!!busyId} onClick={()=>setConfirmation(null)}>Cancel</Button><Button variant="primary" disabled={!!busyId} onClick={()=>void confirmAction()}>{busyId?'Saving...':'Confirm'}</Button></>}>
      <p className="text-sm text-text-secondary">{confirmation?.action==='RESET' ? `Reset ${confirmation.guard.name}'s password to the server-configured temporary password? Existing sessions will end and a password change will be required at next login.` : `Set ${confirmation?.guard.name}'s status to ${confirmation?.action.toLowerCase()}? Existing sessions will end when access changes.`}</p>
      {actionError && <p role="alert" className="mt-3 text-sm text-status-alert">{actionError}</p>}
    </Modal>
    <GuardFormModal mode={modal?.mode??'add'} guard={modal?.guard??null} open={modal!==null} onClose={()=>setModal(null)} onSubmit={handleFormSubmit}/>
  </div>
}
