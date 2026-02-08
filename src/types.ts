export type OutputFormat = 'image/jpeg' | 'image/webp' | 'image/avif'

export type TargetUnit = 'KB' | 'MB'

export type QueueStatus = 'queued' | 'compressing' | 'done' | 'failed' | 'cancelled'

export interface AppSettings {
  targetSize: number
  targetUnit: TargetUnit
  outputFormat: OutputFormat
  maxWidth: number | ''
  qualityMin: number
  qualityMax: number
  maxIterations: number
  tolerance: number
  concurrency: 3 | 5
}

export interface CompressionResult {
  blob: Blob
  downloadUrl: string
  outputFileName: string
  originalBytes: number
  compressedBytes: number
  reductionPercent: number
  quality: number
  iterations: number
  reachedTarget: boolean
  cannotReachTarget: boolean
  mimeType: OutputFormat
  width: number
  height: number
}

export interface QueueItem {
  id: string
  file: File
  previewUrl: string
  status: QueueStatus
  error: string | null
  result: CompressionResult | null
}
