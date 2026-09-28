import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ChevronRight, Plus, Search, Video, VideoOff } from 'lucide-react'
import { Badge, Button, Card, Input, Modal } from '@/components/ui'
import { cameraService, type CameraInput } from '@/services/cameraService'
import type { StoreCamera } from '@/types'

type CameraFilter = 'ALL' | 'ENABLED' | 'DISABLED'
const EMPTY_CAMERA: CameraInput = { id: '', label: '', x: 50, y: 50, monitored: true, siteId: '', streamUrl: '' }
const toInput = (camera: StoreCamera): CameraInput => ({ id: camera.id, label: camera.label, x: camera.x, y: camera.y, monitored: camera.monitored, siteId: camera.siteId ?? '', streamUrl: camera.streamUrl ?? '' })
const previewPosition = (camera: StoreCamera) => {
  return { x: camera.x, y: camera.y }
}
const previewColor = (camera: StoreCamera) => camera.status === 'alert' ? '#ef334d' : camera.status === 'review' ? '#ffb31f' : camera.status === 'normal' ? '#2bd879' : '#8294b1'

export function SettingsPage() {
  const [cameras, setCameras] = useState<StoreCamera[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CameraInput | null>(null)
  const [addForm, setAddForm] = useState<CameraInput | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<CameraFilter>('ALL')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    cameraService.getCameras().then((items) => {
      setCameras(items); const first = items[0]; if (first) { setSelectedId(first.id); setDraft(toInput(first)) }
    }).catch((err) => setError(err instanceof Error ? err.message : 'Unable to load cameras')).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => cameras.filter((camera) => {
    if (filter === 'ENABLED' && !camera.monitored) return false
    if (filter === 'DISABLED' && camera.monitored) return false
    const query = search.trim().toLowerCase()
    return !query || `${camera.label} ${camera.id}`.toLowerCase().includes(query)
  }), [cameras, filter, search])
  const selected = cameras.find((camera) => camera.id === selectedId) ?? null
  const enabled = cameras.filter((camera) => camera.monitored).length

  function selectCamera(camera: StoreCamera) { setSelectedId(camera.id); setDraft(toInput(camera)); setError(null) }

  async function saveSelected() {
    if (!selected || !draft) return
    setSaving(true); setError(null)
    try { const saved = await cameraService.update(selected.id, draft); setCameras((items) => items.map((item) => item.id === saved.id ? saved : item)); setDraft(toInput(saved)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to save camera') }
    finally { setSaving(false) }
  }

  async function createCamera(event: FormEvent) {
    event.preventDefault(); if (!addForm) return
    setSaving(true); setError(null)
    try { const saved = await cameraService.create(addForm); setCameras((items) => [...items, saved]); setAddForm(null); selectCamera(saved) }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to create camera') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="py-16 text-center text-sm text-text-muted">Loading cameras…</div>
  return <div className="mx-auto w-full max-w-[1600px] space-y-5">
    <header><h1 className="text-3xl font-semibold tracking-tight">Camera settings</h1><p className="mt-1 text-sm text-text-secondary">Manage camera locations and access to video analysis.</p></header>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
    <Card className="min-w-0 overflow-hidden"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5"><div><h2 className="text-xl font-semibold">Camera setup</h2><p className="mt-1 text-sm text-text-secondary">Manage camera locations and monitoring status.</p></div><Button className="border-status-info bg-status-info text-white hover:bg-status-info/90" icon={<Plus className="h-4 w-4"/>} onClick={()=>setAddForm({...EMPTY_CAMERA})}>Add camera</Button></div>
      {error&&<div className="m-4 rounded-lg border border-status-alert/30 bg-status-alert/10 px-4 py-3 text-sm text-status-alert">{error}</div>}
      <div className="flex flex-col gap-3 p-5"><label className="flex h-11 min-w-0 shrink-0 items-center gap-3 rounded-lg border border-line-strong bg-surface-2 px-4"><Search className="h-5 w-5 text-text-secondary"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search cameras" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted"/></label><div className="grid grid-cols-3 overflow-hidden rounded-full border border-line-strong">{([['ALL','All',cameras.length],['ENABLED','Enabled',enabled],['DISABLED','Disabled',cameras.length-enabled]] as Array<[CameraFilter,string,number]>).map(([value,label,count])=><button key={value} onClick={()=>setFilter(value)} className={`min-w-0 border-r border-line px-2 py-3 text-sm last:border-0 ${filter===value?'bg-status-info/15 text-text-primary':'text-text-secondary'}`}>{label} <span className="ml-1 rounded-md bg-surface-3 px-1.5 py-0.5">{count}</span></button>)}</div></div>
      <div className="space-y-2 px-5 pb-5">{!filtered.length && <p className="py-8 text-center text-sm text-text-secondary">No cameras match these filters.</p>}{filtered.map((camera)=><button key={camera.id} onClick={()=>selectCamera(camera)} className={`w-full rounded-xl border p-4 text-left ${selectedId===camera.id?'border-status-info bg-status-info/10':'border-line hover:bg-surface-2'}`}>
        <div className="flex items-center gap-3"><Video className="h-5 w-5 shrink-0 text-text-secondary"/><div className="min-w-0 flex-1"><b className="block break-words">{camera.label}</b><small className="break-all text-text-secondary">{camera.id}</small></div><ChevronRight className="h-4 w-4 shrink-0 text-text-secondary"/></div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs"><span className={camera.monitored?'text-status-normal':'text-text-secondary'}>{camera.monitored?'Monitoring enabled':'Monitoring disabled'}</span><span className="text-text-secondary">Position {camera.x.toFixed(1)}%, {camera.y.toFixed(1)}%</span><Badge>{camera.status}</Badge></div>
      </button>)}</div>
    </Card>

    <Card className="min-w-0 p-5 ">{selected&&draft?<><div><h2 className="text-2xl font-semibold">{selected.label}</h2><p className={`mt-1 flex items-center gap-2 ${draft.monitored?'text-status-normal':'text-text-secondary'}`}>{draft.monitored?<Video className="h-5 w-5"/>:<VideoOff className="h-5 w-5"/>}{draft.monitored?'Enabled':'Disabled'}</p><small className="ml-7 text-text-secondary">{selected.id}</small></div>
      <div className="relative mx-auto mt-5 aspect-[3/4.7] w-full max-w-[220px] overflow-hidden rounded-lg border border-line-strong bg-[#0d1622]" style={{backgroundImage:'linear-gradient(rgba(44,61,82,.27) 1px,transparent 1px),linear-gradient(90deg,rgba(44,61,82,.27) 1px,transparent 1px)',backgroundSize:'18px 18px'}}><svg viewBox="0 0 300 440" preserveAspectRatio="none" className="absolute inset-0 h-full w-full"><g fill="none" stroke="#7f8fa6" strokeWidth="2.5"><path d="M66 14H224V60H264V272H288V406H218V424H174M126 424H82V406H28V60H66V14"/><path d="M66 14V60M224 14V60M28 60H108M132 60H188M216 60H264M126 424v-18a24 24 0 0124 24M174 424v-18a24 24 0 00-24 24" strokeWidth="1.3"/></g><g fill="rgba(73,91,118,.34)" stroke="#72839b"><rect x="40" y="150" width="9" height="142"/><rect x="58" y="150" width="22" height="142"/><rect x="112" y="150" width="22" height="142"/><rect x="190" y="150" width="9" height="142"/><rect x="208" y="150" width="22" height="142"/><rect x="262" y="150" width="9" height="142"/><rect x="38" y="375" width="19" height="31"/><rect x="66" y="375" width="19" height="31"/><rect x="94" y="375" width="19" height="31"/></g><g fill="#b5c3dc" fontSize="9" fontWeight="600" textAnchor="middle"><text x="150" y="31">STORAGE</text><text x="90" y="101">AISLE A</text><text x="198" y="101">AISLE B</text><text x="66" y="335">CHECKOUT</text><text x="210" y="345">ENTRANCE</text></g>{cameras.filter(c=>c.monitored&&c.status!=='offline').map((camera)=>{const pos=previewPosition(camera),x=pos.x*3,y=pos.y*4.4,name=camera.label.toLowerCase(),points=name.includes('storage')?`${x},${y} 124,76 176,76`:name.includes('checkout')?`${x},${y} 32,404 122,404`:name.includes('entrance')?`${x},${y} 130,430 176,430`:name.includes('aisle b')?`${x},${y} 180,165 255,165`:`${x},${y} 48,165 130,165`;return <polygon key={`cone-${camera.id}`} points={points} fill={previewColor(camera)} opacity={camera.status==='normal'?.11:.24}/>})}</svg>{cameras.map((camera)=>{const pos=previewPosition(camera),color=previewColor(camera);return <button key={camera.id} onClick={()=>selectCamera(camera)} title={camera.label} className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-surface-2 ${camera.status==='alert'?'animate-pulse':''} ${camera.id===selected.id?'ring-2 ring-status-info ring-offset-2 ring-offset-surface-0':''}`} style={{left:`${pos.x}%`,top:`${pos.y}%`,borderColor:color,boxShadow:`0 0 ${camera.status==='alert'?'22px 6px':'8px 1px'} ${color}`}}><Video className="h-3 w-3 text-white" fill="currentColor"/></button>})}</div>
      <Input label="Display name" className="mt-1" value={draft.label} required onChange={(e)=>setDraft({...draft,label:e.target.value})}/><div className="mt-5"><h3 className="mb-2 text-sm font-semibold">Map position</h3><div className="grid grid-cols-2 gap-3"><label className="rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-xs text-text-secondary">X position<input type="number" min="0" max="100" step=".1" value={draft.x} onChange={(e)=>setDraft({...draft,x:Number(e.target.value)})} className="mt-1 block w-full bg-transparent text-sm text-text-primary outline-none"/></label><label className="rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-xs text-text-secondary">Y position<input type="number" min="0" max="100" step=".1" value={draft.y} onChange={(e)=>setDraft({...draft,y:Number(e.target.value)})} className="mt-1 block w-full bg-transparent text-sm text-text-primary outline-none"/></label></div></div>
      <div className="mt-6"><h3 className="text-sm font-semibold">Monitoring</h3><label className="mt-3 flex items-center gap-4"><button type="button" role="switch" aria-label="Enable camera monitoring" aria-checked={draft.monitored} onClick={()=>setDraft({...draft,monitored:!draft.monitored})} className={`relative h-7 w-13 rounded-full transition-colors ${draft.monitored?'bg-status-info':'bg-[#465874]'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${draft.monitored?'left-7':'left-1'}`}/></button><span className="text-xs text-text-secondary">New analyses are {draft.monitored?'enabled':'disabled'} for this camera. Running analyses finish normally.</span></label></div>
      <div className="mt-10 flex justify-end"><Button className="min-w-40 border-status-info bg-status-info text-white hover:bg-status-info/90" disabled={saving || !draft.label.trim() || !Number.isFinite(draft.x) || !Number.isFinite(draft.y) || draft.x<0 || draft.x>100 || draft.y<0 || draft.y>100} onClick={()=>void saveSelected()}>{saving?'Saving…':'Save changes'}</Button></div>
    </>:<div className="flex h-full items-center justify-center text-sm text-text-muted">Select a camera to edit it.</div>}</Card>
    </div>

    <Modal open={addForm!==null} onClose={()=>setAddForm(null)} title="Add camera" footer={<><Button onClick={()=>setAddForm(null)}>Cancel</Button><Button variant="primary" type="submit" form="add-camera-form" disabled={saving}>{saving?'Saving…':'Add camera'}</Button></>}>
      {addForm&&<form id="add-camera-form" onSubmit={createCamera} className="space-y-4">{error && <p role="alert" className="text-sm text-status-alert">{error}</p>}<Input label="Camera ID" value={addForm.id} required pattern="[A-Za-z0-9_-]+" onChange={(e)=>setAddForm({...addForm,id:e.target.value})}/><Input label="Display name" value={addForm.label} required onChange={(e)=>setAddForm({...addForm,label:e.target.value})}/><div className="grid grid-cols-2 gap-3"><Input label="Map X (%)" type="number" min="0" max="100" value={addForm.x} onChange={(e)=>setAddForm({...addForm,x:Number(e.target.value)})}/><Input label="Map Y (%)" type="number" min="0" max="100" value={addForm.y} onChange={(e)=>setAddForm({...addForm,y:Number(e.target.value)})}/></div><Input label="Site ID (optional)" value={addForm.siteId} onChange={(e)=>setAddForm({...addForm,siteId:e.target.value})}/><Input label="Stream URL (optional)" type="url" value={addForm.streamUrl} onChange={(e)=>setAddForm({...addForm,streamUrl:e.target.value})}/></form>}
    </Modal>
  </div>
}
