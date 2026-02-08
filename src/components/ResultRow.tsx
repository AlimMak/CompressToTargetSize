import type { QueueItem, QueueStatus } from '../types'
import { formatBytes, formatReduction } from '../utils/format'

interface ResultRowProps {
  item: QueueItem
  onRemove: (id: string) => void
  onDownload: (id: string) => void
}

const STATUS_STYLES: Record<QueueStatus, string> = {
  queued: 'border-zinc-700 bg-zinc-800 text-zinc-300',
  compressing: 'border-blue-900 bg-blue-950/50 text-blue-300',
  done: 'border-emerald-900 bg-emerald-950/40 text-emerald-300',
  failed: 'border-red-900 bg-red-950/40 text-red-300',
  cancelled: 'border-amber-900 bg-amber-950/40 text-amber-300',
}

export function ResultRow({ item, onRemove, onDownload }: ResultRowProps) {
  const result = item.result

  return (
    <article className="rounded-sm border border-zinc-800 bg-zinc-950 p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <img
            src={item.previewUrl}
            alt={item.file.name}
            className="h-12 w-12 shrink-0 rounded-sm border border-zinc-800 object-cover"
            loading="lazy"
          />

          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-100">{item.file.name}</p>
            <p className="meta-text">
              Original: <span className="mono text-zinc-300">{formatBytes(item.file.size)}</span>
            </p>

            {result ? (
              <div className="mt-1 space-y-1 text-xs text-zinc-400">
                <p>
                  Compressed: <span className="mono text-zinc-200">{formatBytes(result.compressedBytes)}</span>{' '}
                  <span className="mono text-zinc-300">({formatReduction(result.reductionPercent)})</span>
                </p>
                <p>
                  Quality: <span className="mono text-zinc-200">{result.quality.toFixed(3)}</span>{' '}
                  <span className="mono text-zinc-300">({result.iterations} iterations)</span>
                </p>
                <p>
                  Output: <span className="mono text-zinc-300">{result.width}x{result.height}</span>
                </p>
                {result.cannotReachTarget ? (
                  <p className="text-amber-300">Cannot reach target exactly; showing smallest result found.</p>
                ) : null}
              </div>
            ) : null}

            {item.error ? <p className="mt-1 text-xs text-red-300">{item.error}</p> : null}
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-start">
          <span
            className={`inline-flex rounded-sm border px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${STATUS_STYLES[item.status]}`}
          >
            {item.status}
          </span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              onRemove(item.id)
            }}
          >
            Remove
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!result}
            onClick={() => {
              onDownload(item.id)
            }}
          >
            Download
          </button>
        </div>
      </div>
    </article>
  )
}
