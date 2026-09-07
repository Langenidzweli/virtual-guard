import { useState } from 'react'
import { Maximize2, Minimize2, Video } from 'lucide-react'
import { Card } from '@/components/ui'
import type { CameraStatus, StoreCamera } from '@/types'

interface StoreMapProps { cameras: StoreCamera[] }
const statusStyle: Record<CameraStatus, { color: string; glow: string; label: string }> = {
  normal: { color: '#2bd879', glow: 'rgba(43,216,121,.34)', label: 'Normal' },
  review: { color: '#ffb31f', glow: 'rgba(255,179,31,.38)', label: 'Review required' },
  alert: { color: '#ef334d', glow: 'rgba(239,51,77,.42)', label: 'Active alert' },
  idle: { color: '#8294b1', glow: 'rgba(130,148,177,.25)', label: 'Idle' },
  offline: { color: '#596579', glow: 'rgba(89,101,121,.2)', label: 'Offline' },
}

function mapPosition(camera: StoreCamera): { x: number; y: number } {
  const name = camera.label.toLowerCase()
  if (name.includes('storage')) return { x: 50, y: 10 }
  if (name.includes('aisle a')) return { x: 30, y: 26 }
  if (name.includes('aisle b')) return { x: 66, y: 26 }
  if (name.includes('checkout')) return { x: 22, y: 79 }
  if (name.includes('entrance')) return { x: 70, y: 82 }
  return { x: camera.x, y: camera.y }
}

export function StoreMap({ cameras }: StoreMapProps) {
  const [expanded, setExpanded] = useState(false)
  const monitored = cameras.filter((camera) => camera.monitored)
  const online = monitored.filter((camera) => camera.status !== 'offline').length
  const count = (status: CameraStatus) => monitored.filter((camera) => camera.status === status).length

  const content = <Card className={`flex h-full flex-col overflow-hidden ${expanded ? 'shadow-2xl' : ''}`}>
    <div className="flex items-center justify-between border-b border-line px-5 py-4">
      <h2 className={`${expanded ? 'text-3xl' : 'text-xl'} font-semibold`}>Store map</h2>
      <div className="flex items-center gap-4"><span className="flex items-center gap-2 text-sm text-[#aab7d2]"><span className="h-3 w-3 rounded-full bg-status-normal"/>{online} online</span><button aria-label={expanded?'Close full map':'View full map'} onClick={()=>setExpanded(!expanded)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-line-strong text-text-secondary hover:bg-surface-2">{expanded?<Minimize2 className="h-5 w-5"/>:<Maximize2 className="h-5 w-5"/>}</button></div>
    </div>
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <div className="relative mx-auto min-h-0 w-full flex-1 overflow-hidden rounded-xl border border-[#38485f] bg-[#0d1622]" style={{ aspectRatio: expanded ? '16 / 10' : '3 / 4.7', maxWidth: expanded ? 1100 : 620, backgroundImage:'linear-gradient(rgba(44,61,82,.27) 1px,transparent 1px),linear-gradient(90deg,rgba(44,61,82,.27) 1px,transparent 1px)',backgroundSize:'22px 22px' }}>
        <svg viewBox="0 0 300 440" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-label="Store floor plan">
          {monitored.filter((camera) => camera.status !== 'offline').map((camera) => {
            const position = mapPosition(camera)
            const x = position.x * 3
            const y = position.y * 4.4
            const name = camera.label.toLowerCase()
            const polygon = name.includes('storage')
              ? `${x},${y} 124,76 176,76`
              : name.includes('checkout')
                ? `${x},${y} 32,404 122,404`
                : name.includes('entrance')
                  ? `${x},${y} 130,430 176,430`
                  : name.includes('aisle b')
                    ? `${x},${y} 180,166 255,166`
                    : `${x},${y} 48,166 130,166`
            return <polygon key={`coverage-${camera.id}`} points={polygon} fill={statusStyle[camera.status].color} opacity={camera.status === 'normal' ? .11 : camera.status === 'idle' ? .07 : .25}/>
          })}
          <g fill="none" stroke="#7f8fa6" strokeWidth="2.5" strokeLinejoin="round">
            <path d="M66 14H224V60H264V272H288V406H218V424H174"/>
            <path d="M126 424H82V406H28V60H66V14"/>
            <path d="M66 14V60M224 14V60M28 60H108M132 60H188M216 60H264"/>
            <path d="M188 60a24 24 0 0 1 24-24v24M82 406h44M174 406h44M126 424v-18a24 24 0 0 1 24 24M174 424v-18a24 24 0 0 0-24 24" strokeWidth="1.3"/>
          </g>
          <g fill="rgba(73,91,118,.34)" stroke="#72839b" strokeWidth="1">
            <Shelf x={40} y={150}/><Shelf x={58} y={150} wide/><Shelf x={112} y={150} wide/>
            <Shelf x={190} y={150}/><Shelf x={208} y={150} wide/><Shelf x={262} y={150}/>
            <rect x="263" y="348" width="9" height="51"/><rect x="38" y="375" width="19" height="31"/><rect x="66" y="375" width="19" height="31"/><rect x="94" y="375" width="19" height="31"/>
          </g>
          <g fill="#b5c3dc" fontSize="9" fontWeight="600" textAnchor="middle"><text x="150" y="31">STORAGE</text><text x="90" y="101">AISLE A</text><text x="198" y="101">AISLE B</text><text x="66" y="335">CHECKOUT</text><text x="210" y="345">ENTRANCE</text></g>
        </svg>
        {monitored.map((camera) => {
          const style=statusStyle[camera.status], callout=camera.status==='review'||camera.status==='alert'
          const isNormal = camera.status === 'normal'
          const position = mapPosition(camera)
          return <div key={camera.id} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{left:`${position.x}%`,top:`${position.y}%`}}>
            {camera.status==='alert'&&<><span className="absolute inset-[-9px] animate-ping rounded-full border-2 border-status-alert opacity-75"/><span className="absolute inset-[-17px] animate-pulse rounded-full bg-status-alert/20 blur-md"/></>}
            <span className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 bg-surface-2 ${camera.status==='alert'?'animate-pulse bg-status-alert/30':''}`} style={{borderColor:style.color,boxShadow:`0 0 ${camera.status==='alert'?'24px 7px':isNormal?'8px 1px':'13px 2px'} ${style.color}`}}><Video className="h-3 w-3 text-white" fill="currentColor"/></span>
            {callout&&<div className="absolute left-11 top-0 flex items-center"><span className="h-px w-5" style={{background:style.color}}/><span className="-ml-1 h-2.5 w-2.5 rounded-full" style={{background:style.color}}/><div className="ml-0 min-w-36 rounded-lg border border-[#65758d] bg-[#111a28]/95 px-3 py-2 text-xs shadow-xl"><b className="block text-text-primary">{camera.label}</b><span style={{color:style.color}}>{style.label}</span></div></div>}
          </div>
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-5 border-t border-line pt-4 text-sm"><Legend color="#2bd879" label="Normal" value={count('normal')}/><Legend color="#ffb31f" label="Review" value={count('review')}/><Legend color="#ef334d" label="Alert" value={count('alert')}/></div>
    </div>
  </Card>

  return expanded ? <><div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm" onClick={()=>setExpanded(false)}/><div className="fixed inset-5 z-[90]">{content}</div></> : content
}

function Shelf({ x, y, wide=false }: { x:number; y:number; wide?:boolean }) {
  const width=wide?22:9
  return <g><rect x={x} y={y} width={width} height="142"/>{Array.from({length:7},(_,index)=><line key={index} x1={x} x2={x+width} y1={y+index*23} y2={y+index*23}/>)}</g>
}

function Legend({ color, label, value }: { color:string; label:string; value:number }) {
  return <span className="flex items-center gap-2 text-[#aab7d2]"><span className="h-3 w-3 rounded-full" style={{background:color}}/>{label} {value}</span>
}
