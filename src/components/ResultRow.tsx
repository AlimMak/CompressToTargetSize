import type { QueueItem, QueueStatus } from '../types'
import { formatBytes, formatReduction } from '../utils/format'

interface ResultRowProps {
  item: QueueItem
  onRemove: (id: string) => void
  onDownload: (id: string) => void
}

const STATUS_STYLES: Record<QueueStatus, string> = {
  queued: 'bg-slate-700/80 text-slate-200 border-slate-600',
  compressing: 'bg-cyan-500/15 text-cyan-200 border-cyan-500/40',
  done: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  failed: 'bg-rose-500/15 text-rose-200 border-rose-500/40',
  cancelled: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
}

export function ResultRow({ item, onRemove, onDownload }: ResultRowProps) {
  const result = item.result

  return (
    <article className="rounded-xl border border-slate-700/70 bg-slate-900/55 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <img
            src={item.previewUrl}
            alt={item.file.name}
            className="h-16 w-16 shrink-0 rounded-lg border border-slate-700 object-cover"
            loading="lazy"
          />

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">{item.file.name}</p>
            <p className="mt-1 text-xs text-slate-400">Original: {formatBytes(item.file.size)}</p>

            {result ? (
              <div className="mt-2 space-y-1 text-xs text-slate-300">
                <p>
                  Compressed: <span className="font-semibold text-slate-100">{formatBytes(result.compressedBytes)}</span>{' '}
                  ({formatReduction(result.reductionPercent)})
                </p>
                <p>
                  Quality: <span className="font-semibold text-slate-100">{result.quality.toFixed(3)}</span>{' '}
                  in {result.iterations} iterations
                </p>
                <p>
                  Output: {result.width}x{result.height}
                </p>
                {result.cannotReachTarget ? (
                  <p className="text-amber-300">Cannot reach target exactly; showing smallest result found.</p>
                ) : null}
              </div>
            ) : null}

            {item.error ? <p className="mt-2 text-xs text-rose-300">{item.error}</p> : null}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start">
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${STATUS_STYLES[item.status]}`}
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
            className="btn-primary"
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
