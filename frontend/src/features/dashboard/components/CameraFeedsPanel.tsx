import { useRef, useState } from 'react'
import { Upload, ScanSearch, RotateCcw } from 'lucide-react'
import { Button, Modal } from '@/components/ui'
import { CameraFeedCard } from './CameraFeedCard'
import type { CameraFeed, StoreCamera } from '@/types'

interface CameraFeedsPanelProps {
  feeds: CameraFeed[]
  cameras: StoreCamera[]
  onFileSelected: (cameraId: string, file: File) => void
  onAnalyze: () => void
  onReset: () => void
}

export function CameraFeedsPanel({ feeds, cameras, onFileSelected, onAnalyze, onReset }: CameraFeedsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showCameraModal, setShowCameraModal] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const emptySlotCount = feeds.filter((f) => f && f.fileName === null).length
  const filledSlotCount = feeds.filter((f) => f && f.fileName !== null).length
  const hasAnyVideo = filledSlotCount > 0

  const availableCameras = cameras.filter(
    (cam) => cam && cam.monitored && !feeds.some((f) => f && f.id === cam.id && f.fileName !== null)
  )

  const addTimestampToFile = (file: File): File => {
    const timestamp = Date.now()
    const nameParts = file.name.split('.')
    const extension = nameParts.pop()
    const baseName = nameParts.join('.')
    return new File([file], `${timestamp}_${baseName}.${extension}`, {
      type: file.type,
    })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      if (!file) return

      if (availableCameras.length === 0) {
        alert('No available camera slots. All feeds are occupied.')
        e.target.value = ''
        return
      }

      const timestampedFile = addTimestampToFile(file)

      if (availableCameras.length === 1 && availableCameras[0]) {
        onFileSelected(availableCameras[0].id, timestampedFile)
        e.target.value = ''
        return
      }

      setPendingFile(timestampedFile)
      setShowCameraModal(true)
    }
    e.target.value = ''
  }

  const handleCameraSelect = (cameraId: string) => {
    if (pendingFile) {
      onFileSelected(cameraId, pendingFile)
      setPendingFile(null)
      setShowCameraModal(false)
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <h2 className="text-sm font-semibold tracking-wider text-text-secondary uppercase">
          Live Camera Feeds
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs text-text-muted">
            Upload one video per camera
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,.mov,.avi,.mkv,.webm,video/mp4,video/webm"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="secondary"
            size="sm"
            icon={<Upload className="h-3.5 w-3.5" strokeWidth={1.75} />}
            onClick={() => fileInputRef.current?.click()}
            disabled={emptySlotCount === 0}
          >
            Choose File
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!hasAnyVideo || feeds.every((f) => !f || !f.fileName || f.isAnalyzing)}
            icon={<ScanSearch className="h-3.5 w-3.5" strokeWidth={1.75} />}
            onClick={onAnalyze}
          >
            Analyze
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasAnyVideo}
            icon={<RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />}
            onClick={onReset}
          >
            Reset
          </Button>
        </div>
      </div>

      <Modal
        open={showCameraModal}
        onClose={() => {
          setShowCameraModal(false)
          setPendingFile(null)
        }}
        title="Select Camera"
      >
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            Choose which camera to upload the video to:
          </p>
          <div className="grid grid-cols-2 gap-3">
            {availableCameras.map((camera) => (
              <button
                key={camera.id}
                onClick={() => handleCameraSelect(camera.id)}
                className="rounded-lg border border-line bg-surface-2 p-4 text-center transition-colors hover:bg-surface-3 hover:border-brand-red"
              >
                <div className="text-sm font-medium text-text-primary">{camera.label}</div>
                <div className="text-xs text-text-muted mt-1">Upload video</div>
              </button>
            ))}
          </div>
          {availableCameras.length === 0 && (
            <p className="text-center text-text-muted py-4">
              No available camera slots. All feeds are occupied.
            </p>
          )}
          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={() => setShowCameraModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {feeds.map((feed) => (
          <CameraFeedCard key={feed.id} feed={feed} />
        ))}
      </div>
    </section>
  )
}
