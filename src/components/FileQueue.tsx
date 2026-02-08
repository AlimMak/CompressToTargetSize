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
    <section className="panel p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="panel-title">File Queue</h2>
        <div className="flex items-center gap-3">
          <span className="meta-text mono">{items.length} item(s)</span>
          <button type="button" className="btn-secondary" disabled={!items.length} onClick={onClear}>
            Clear queue
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-sm border border-zinc-800 bg-zinc-950 px-3 py-5 text-center text-sm text-zinc-500">
          Drop images to start. Compression runs only when you click <strong>Compress All</strong>.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ResultRow key={item.id} item={item} onRemove={onRemove} onDownload={onDownload} />
          ))}
        </div>
      )}
    </section>
  )
}
