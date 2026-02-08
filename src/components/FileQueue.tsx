import type { QueueItem } from '../types'
import { ResultRow } from './ResultRow'

interface FileQueueProps {
  items: QueueItem[]
  onRemove: (id: string) => void
  onClear: () => void
  onDownload: (id: string) => void
}

export function FileQueue({ items, onRemove, onClear, onDownload }: FileQueueProps) {
  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="panel-title">File Queue</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{items.length} item(s)</span>
          <button type="button" className="btn-secondary" disabled={!items.length} onClick={onClear}>
            Clear queue
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-slate-700/70 bg-slate-900/45 px-4 py-8 text-center text-sm text-slate-400">
          Drop images to start. Compression runs only when you click <strong>Compress All</strong>.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ResultRow key={item.id} item={item} onRemove={onRemove} onDownload={onDownload} />
          ))}
        </div>
      )}
    </section>
  )
}
