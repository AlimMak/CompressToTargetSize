export type OutputFormat = 'image/jpeg' | 'image/webp' | 'image/avif'

export type TargetUnit = 'KB' | 'MB'
export type TargetMode = 'under' | 'range'
export type PresetId =
  | 'custom'
  | 'linkedin-image'
  | 'email-attachment-safe'
  | 'web-hero'

export type QueueStatus = 'queued' | 'compressing' | 'done' | 'failed' | 'cancelled'

export interface AppSettings {
  selectedPreset: PresetId
  targetMode: TargetMode
  targetSize: number
  targetUnit: TargetUnit
  rangeMinKB: number
  rangeMaxKB: number
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
  targetMode: TargetMode
  targetMinBytes: number
  targetMaxBytes: number
  targetMissReason: string | null
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
