import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dropzone } from './components/Dropzone'
import { FileQueue } from './components/FileQueue'
import { Header } from './components/Header'
import { SettingsPanel } from './components/SettingsPanel'
import type { AppSettings, CompressionResult, OutputFormat, QueueItem } from './types'
import { compressToTarget } from './utils/compress'
import { createAbortError, isAbortError, runWithConcurrency } from './utils/concurrency'
import { toBytes } from './utils/format'
import { gifRejectionMessage, isGifFile } from './utils/gif'
import { detectSupportedOutputFormats } from './utils/support'
import { downloadZip } from './utils/zip'

const DEFAULT_SETTINGS: AppSettings = {
  targetSize: 200,
  targetUnit: 'KB',
  outputFormat: 'image/jpeg',
  maxWidth: '',
  qualityMin: 0.05,
  qualityMax: 0.95,
  maxIterations: 10,
  tolerance: 0.05,
  concurrency: 3,
}

function createQueueId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getFileFingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

function releaseQueueItemResources(item: QueueItem): void {
  URL.revokeObjectURL(item.previewUrl)
  if (item.result) {
    URL.revokeObjectURL(item.result.downloadUrl)
  }
}

function toUserFacingError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return 'Compression failed due to an unexpected error.'
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [supportedFormats, setSupportedFormats] = useState<OutputFormat[]>(['image/jpeg'])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [intakeMessages, setIntakeMessages] = useState<string[]>([])
  const [isCompressing, setIsCompressing] = useState(false)

  const queueRef = useRef<QueueItem[]>([])
  const batchControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    return () => {
      for (const item of queueRef.current) {
        releaseQueueItemResources(item)
      }
    }
  }, [])

  useEffect(() => {
    let isSubscribed = true

    void detectSupportedOutputFormats().then((formats) => {
      if (!isSubscribed) {
        return
      }

      setSupportedFormats(formats)
      setSettings((current) => {
        if (formats.includes(current.outputFormat)) {
          return current
        }

        return {
          ...current,
          outputFormat: formats[0] ?? 'image/jpeg',
        }
      })
    })

    return () => {
      isSubscribed = false
    }
  }, [])

  const addFilesToQueue = useCallback(async (files: File[]) => {
    const existingFingerprints = new Set(queueRef.current.map((item) => getFileFingerprint(item.file)))
    const nextItems: QueueItem[] = []
    const issues: string[] = []

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        issues.push(`${file.name}: only image files are supported.`)
        continue
      }

      if (await isGifFile(file)) {
        issues.push(gifRejectionMessage(file.name))
        continue
      }

      const fingerprint = getFileFingerprint(file)
      if (existingFingerprints.has(fingerprint)) {
        issues.push(`${file.name}: duplicate skipped.`)
        continue
      }

      existingFingerprints.add(fingerprint)

      nextItems.push({
        id: createQueueId(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'queued',
        error: null,
        result: null,
      })
    }

    if (nextItems.length > 0) {
      setQueue((current) => [...current, ...nextItems])
    }

    setIntakeMessages(issues)
  }, [])

  const removeItem = useCallback((id: string) => {
    setQueue((current) => {
      const item = current.find((entry) => entry.id === id)
      if (item) {
        releaseQueueItemResources(item)
      }

      return current.filter((entry) => entry.id !== id)
    })
  }, [])

  const clearQueue = useCallback(() => {
    setQueue((current) => {
      for (const item of current) {
        releaseQueueItemResources(item)
      }

      return []
    })
  }, [])

  const downloadSingle = useCallback((id: string) => {
    const item = queueRef.current.find((entry) => entry.id === id)
    if (!item?.result) {
      return
    }

    const anchor = document.createElement('a')
    anchor.href = item.result.downloadUrl
    anchor.download = item.result.outputFileName
    anchor.click()
  }, [])

  const pendingItems = useMemo(
    () =>
      queue.filter(
        (item) => item.status === 'queued' || item.status === 'failed' || item.status === 'cancelled',
      ),
    [queue],
  )

  const completedItems = useMemo(
    () =>
      queue.filter(
        (item): item is QueueItem & { result: CompressionResult } =>
          item.status === 'done' && item.result !== null,
      ),
    [queue],
  )

  const startCompression = useCallback(async () => {
    if (isCompressing) {
      return
    }

    const candidates = queueRef.current.filter(
      (item) => item.status === 'queued' || item.status === 'failed' || item.status === 'cancelled',
    )

    if (candidates.length === 0) {
      return
    }

    const candidateIds = new Set(candidates.map((item) => item.id))

    setQueue((current) =>
      current.map((item) => {
        if (!candidateIds.has(item.id)) {
          return item
        }

        if (item.result) {
          URL.revokeObjectURL(item.result.downloadUrl)
        }

        return {
          ...item,
          status: 'queued',
          error: null,
          result: null,
        }
      }),
    )

    const targetBytes = toBytes(settings.targetSize, settings.targetUnit)
    const maxWidth = typeof settings.maxWidth === 'number' ? settings.maxWidth : undefined
    const controller = new AbortController()

    batchControllerRef.current = controller
    setIsCompressing(true)
    setIntakeMessages([])

    const tasks = candidates.map(
      (item) => async () => {
        if (controller.signal.aborted) {
          throw createAbortError()
        }

        setQueue((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  status: 'compressing',
                  error: null,
                }
              : entry,
          ),
        )

        try {
          const result = await compressToTarget({
            file: item.file,
            targetBytes,
            outputFormat: settings.outputFormat,
            minQuality: settings.qualityMin,
            maxQuality: settings.qualityMax,
            maxIterations: settings.maxIterations,
            tolerance: settings.tolerance,
            maxWidth,
            signal: controller.signal,
          })

          setQueue((current) =>
            current.map((entry) =>
              entry.id === item.id
                ? {
                    ...entry,
                    status: 'done',
                    error: null,
                    result,
                  }
                : entry,
            ),
          )

          return result
        } catch (error) {
          if (isAbortError(error) || controller.signal.aborted) {
            setQueue((current) =>
              current.map((entry) =>
                entry.id === item.id
                  ? {
                      ...entry,
                      status: 'cancelled',
                      error: 'Compression cancelled by user.',
                    }
                  : entry,
              ),
            )
          } else {
            setQueue((current) =>
              current.map((entry) =>
                entry.id === item.id
                  ? {
                      ...entry,
                      status: 'failed',
                      error: toUserFacingError(error),
                    }
                  : entry,
              ),
            )
          }

          throw error
        }
      },
    )

    await runWithConcurrency(tasks, settings.concurrency, controller.signal)

    if (controller.signal.aborted) {
      setQueue((current) =>
        current.map((item) => {
          if (!candidateIds.has(item.id)) {
            return item
          }

          if (item.status === 'queued' || item.status === 'compressing') {
            return {
              ...item,
              status: 'cancelled',
              error: 'Compression cancelled by user.',
            }
          }

          return item
        }),
      )
    }

    if (batchControllerRef.current === controller) {
      batchControllerRef.current = null
    }

    setIsCompressing(false)
  }, [isCompressing, settings])

  const cancelCompression = useCallback(() => {
    batchControllerRef.current?.abort()
  }, [])

  const downloadAll = useCallback(async () => {
    if (completedItems.length === 0) {
      return
    }

    await downloadZip(
      completedItems.map((item) => ({
        fileName: item.result.outputFileName,
        blob: item.result.blob,
      })),
      'compressed-images.zip',
    )
  }, [completedItems])

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-6 sm:py-8">
      <Header />

      <div className="mt-4 space-y-3">
        <SettingsPanel
          settings={settings}
          supportedFormats={supportedFormats}
          disabled={isCompressing}
          onChange={setSettings}
        />

        <Dropzone disabled={isCompressing} onFilesSelected={addFilesToQueue} />
        <FileQueue items={queue} onRemove={removeItem} onClear={clearQueue} onDownload={downloadSingle} />

        <section className="panel p-3">
          <h2 className="panel-title mb-3">Results</h2>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={pendingItems.length === 0 || isCompressing}
              onClick={() => {
                void startCompression()
              }}
            >
              Compress All ({pendingItems.length})
            </button>

            <button
              type="button"
              className="btn-secondary"
              disabled={!isCompressing}
              onClick={cancelCompression}
            >
              Cancel Batch
            </button>

            <button
              type="button"
              className="btn-secondary"
              disabled={completedItems.length === 0}
              onClick={() => {
                void downloadAll()
              }}
            >
              Download All (ZIP)
            </button>
          </div>

          <p className="meta-text mt-3">
            Completed files: <span className="mono text-zinc-300">{completedItems.length}</span>
          </p>
          <p className="meta-text mt-1">
            No analytics or tracking. Metadata is stripped during canvas re-encoding.
          </p>
        </section>

        {intakeMessages.length > 0 ? (
          <section className="panel p-3">
            <h2 className="panel-title mb-2">Validation Messages</h2>
            <ul className="space-y-1 text-xs text-amber-300">
              {intakeMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}
