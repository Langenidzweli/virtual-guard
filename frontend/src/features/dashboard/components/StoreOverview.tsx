import { Video, ShieldAlert, RefreshCw, Activity } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui'
import { StatCard } from './StatCard'

interface StoreOverviewProps {
  camerasOnline: number
  activeAlerts: number
  videosProcessing: number
  avgConfidence: string
  isMonitoring: boolean
}

export function StoreOverview({
  camerasOnline,
  activeAlerts,
  videosProcessing,
  avgConfidence,
  isMonitoring,
}: StoreOverviewProps) {
  return (
    <Card>
      <CardHeader title="Store Overview" />
      <div className="grid grid-cols-2 gap-3 p-4">
        <StatCard label="Store Status" value="Operational" dotStatus="normal" />
        <StatCard
          label="AI Status"
          value={isMonitoring ? 'Monitoring' : 'Idle'}
          dotStatus={isMonitoring ? 'normal' : 'idle'}
        />
        <StatCard label="Cameras Online" value={camerasOnline} icon={Video} />
        <StatCard
          label="Active Alerts"
          value={activeAlerts}
          icon={ShieldAlert}
          tone={activeAlerts > 0 ? 'danger' : 'default'}
        />
        <StatCard label="Videos Processing" value={videosProcessing} icon={RefreshCw} />
        <StatCard label="Avg. Confidence" value={avgConfidence} icon={Activity} />
      </div>
    </Card>
  )
}
