import type { CompressionResult, OutputFormat, TargetMode } from '../types'
import { createAbortError } from './concurrency'

interface CompressOptions {
  file: File
  targetMode: TargetMode
  targetMinBytes: number
  targetMaxBytes: number
  outputFormat: OutputFormat
  minQuality: number
  maxQuality: number
  maxIterations: number
  tolerance: number
  maxWidth?: number
  signal?: AbortSignal
}

interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}

interface EncodedCandidate {
  blob: Blob
  quality: number
  iterations: number
  width: number
  height: number
}

interface QualitySearchResult {
  bestAtOrBelowMax: EncodedCandidate | null
  smallestCandidate: EncodedCandidate
}

const DOWNSCALE_FACTOR = 0.85
const MAX_RESIZE_ATTEMPTS = 5
const MIN_DIMENSION = 64

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError()
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeQualityRange(minQuality: number, maxQuality: number): { min: number; max: number } {
  const lower = clamp(Math.min(minQuality, maxQuality), 0.01, 0.98)
  const upper = clamp(Math.max(minQuality, maxQuality), lower + 0.01, 0.99)

  return {
    min: lower,
    max: upper,
  }
}

function normalizeMaxWidth(maxWidth?: number): number | undefined {
  if (!Number.isFinite(maxWidth)) {
    return undefined
  }

  return Math.max(MIN_DIMENSION, Math.floor(maxWidth as number))
}

function normalizePositiveBytes(value: number): number {
  if (!Number.isFinite(value)) {
    return 1024
  }

  return Math.max(1, Math.floor(value))
}

function normalizeTargetBounds(
  targetMode: TargetMode,
  targetMinBytes: number,
  targetMaxBytes: number,
): { min: number; max: number } {
  const max = normalizePositiveBytes(targetMaxBytes)

  if (targetMode === 'under') {
    return {
      min: 0,
      max,
    }
  }

  const min = normalizePositiveBytes(targetMinBytes)

  return {
    min: Math.min(min, max),
    max: Math.max(min, max),
  }
}

function normalizeIterationCount(maxIterations: number): number {
  if (!Number.isFinite(maxIterations)) {
    return 10
  }

  return Math.max(1, Math.floor(maxIterations))
}

function normalizeTolerance(tolerance: number): number {
  if (!Number.isFinite(tolerance)) {
    return 0.05
  }

  return clamp(tolerance, 0.001, 0.5)
}

function getOutputExtension(outputFormat: OutputFormat): string {
  if (outputFormat === 'image/jpeg') {
    return 'jpg'
  }

  if (outputFormat === 'image/webp') {
    return 'webp'
  }

  return 'avif'
}

function buildOutputName(sourceName: string, outputFormat: OutputFormat): string {
  const dotIndex = sourceName.lastIndexOf('.')
  const baseName = dotIndex > 0 ? sourceName.slice(0, dotIndex) : sourceName

  return `${baseName}-compressed.${getOutputExtension(outputFormat)}`
}

function formatBytesForMessage(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024)
    return `${mb >= 10 ? mb.toFixed(1) : mb.toFixed(2)} MB`
  }

  return `${(bytes / 1024).toFixed(bytes >= 10 * 1024 ? 0 : 1)} KB`
}

function calculateDimensions(
  sourceWidth: number,
  sourceHeight: number,
  preferredWidth?: number,
): { width: number; height: number } {
  if (!preferredWidth || preferredWidth <= 0 || sourceWidth <= preferredWidth) {
    return {
      width: sourceWidth,
      height: sourceHeight,
    }
  }

  const ratio = preferredWidth / sourceWidth

  return {
    width: preferredWidth,
    height: Math.max(1, Math.round(sourceHeight * ratio)),
  }
}

function renderToCanvas(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  preferredWidth?: number,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const { width, height } = calculateDimensions(sourceWidth, sourceHeight, preferredWidth)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Unable to create a canvas rendering context.')
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, width, height)

  return {
    canvas,
    width,
    height,
  }
}

async function decodeWithImageElement(file: File, signal?: AbortSignal): Promise<DecodedImage> {
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()

      const cleanup = (): void => {
        img.onload = null
        img.onerror = null
        signal?.removeEventListener('abort', onAbort)
      }

      const onAbort = (): void => {
        cleanup()
        img.src = ''
        reject(createAbortError())
      }

      img.onload = () => {
        cleanup()
        resolve(img)
      }

      img.onerror = () => {
        cleanup()
        reject(new Error('Unable to decode the selected image.'))
      }

      signal?.addEventListener('abort', onAbort, { once: true })
      img.src = objectUrl
    })

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => {
        URL.revokeObjectURL(objectUrl)
      },
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

async function decodeImage(file: File, signal?: AbortSignal): Promise<DecodedImage> {
  throwIfAborted(signal)

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      throwIfAborted(signal)

      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => {
          bitmap.close()
        },
      }
    } catch {
      return decodeWithImageElement(file, signal)
    }
  }

  return decodeWithImageElement(file, signal)
}

async function encodeCanvas(
  canvas: HTMLCanvasElement,
  outputFormat: OutputFormat,
  quality: number,
  signal?: AbortSignal,
): Promise<Blob> {
  throwIfAborted(signal)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Image encoding failed for the selected format.'))
          return
        }

        if (signal?.aborted) {
          reject(createAbortError())
          return
        }

        resolve(blob)
      },
      outputFormat,
      quality,
    )
  })
}

async function runQualitySearch(options: {
  canvas: HTMLCanvasElement
  width: number
  height: number
  outputFormat: OutputFormat
  targetMaxBytes: number
  minQuality: number
  maxQuality: number
  maxIterations: number
  tolerance: number
  signal?: AbortSignal
}): Promise<QualitySearchResult> {
  const {
    canvas,
    width,
    height,
    outputFormat,
    targetMaxBytes,
    minQuality,
    maxQuality,
    maxIterations,
    tolerance,
    signal,
  } = options

  const { min: normalizedMin, max: normalizedMax } = normalizeQualityRange(minQuality, maxQuality)
  const allowedIterations = normalizeIterationCount(maxIterations)
  const normalizedTolerance = normalizeTolerance(tolerance)

  let iterationsUsed = 0

  const encodeAtQuality = async (quality: number): Promise<EncodedCandidate> => {
    const blob = await encodeCanvas(canvas, outputFormat, quality, signal)
    iterationsUsed += 1

    return {
      blob,
      quality,
      iterations: iterationsUsed,
      width,
      height,
    }
  }

  const minCandidate = await encodeAtQuality(normalizedMin)
  let smallestCandidate = minCandidate
  let bestAtOrBelowMax: EncodedCandidate | null =
    minCandidate.blob.size <= targetMaxBytes ? minCandidate : null

  let lowerBound = normalizedMin
  let upperBound = normalizedMax

  if (normalizedMax !== normalizedMin) {
    const maxCandidate = await encodeAtQuality(normalizedMax)

    if (maxCandidate.blob.size < smallestCandidate.blob.size) {
      smallestCandidate = maxCandidate
    }

    if (
      maxCandidate.blob.size <= targetMaxBytes &&
      (!bestAtOrBelowMax || maxCandidate.blob.size > bestAtOrBelowMax.blob.size)
    ) {
      bestAtOrBelowMax = maxCandidate
    }

    if (maxCandidate.blob.size <= targetMaxBytes) {
      lowerBound = normalizedMax
    }
  }

  if (bestAtOrBelowMax) {
    const distanceToMax = targetMaxBytes - bestAtOrBelowMax.blob.size
    if (distanceToMax <= targetMaxBytes * normalizedTolerance) {
      return {
        bestAtOrBelowMax,
        smallestCandidate,
      }
    }
  }

  for (let iteration = 0; iteration < allowedIterations; iteration += 1) {
    throwIfAborted(signal)

    if (Math.abs(upperBound - lowerBound) < 0.003) {
      break
    }

    const midQuality = Number(((lowerBound + upperBound) / 2).toFixed(4))
    const candidate = await encodeAtQuality(midQuality)

    if (candidate.blob.size < smallestCandidate.blob.size) {
      smallestCandidate = candidate
    }

    if (candidate.blob.size > targetMaxBytes) {
      upperBound = midQuality
    } else {
      if (!bestAtOrBelowMax || candidate.blob.size > bestAtOrBelowMax.blob.size) {
        bestAtOrBelowMax = candidate
      }

      lowerBound = midQuality
    }

    if (bestAtOrBelowMax) {
      const distanceToMax = targetMaxBytes - bestAtOrBelowMax.blob.size
      if (distanceToMax <= targetMaxBytes * normalizedTolerance) {
        break
      }
    }
  }

  return {
    bestAtOrBelowMax,
    smallestCandidate,
  }
}

function buildResult(options: {
  file: File
  outputFormat: OutputFormat
  candidate: EncodedCandidate
  reachedTarget: boolean
  targetMode: TargetMode
  targetMinBytes: number
  targetMaxBytes: number
  targetMissReason: string | null
}): CompressionResult {
  const {
    file,
    outputFormat,
    candidate,
    reachedTarget,
    targetMode,
    targetMinBytes,
    targetMaxBytes,
    targetMissReason,
  } = options

  const downloadUrl = URL.createObjectURL(candidate.blob)
  const reductionPercent =
    file.size > 0 ? ((file.size - candidate.blob.size) / file.size) * 100 : 0

  return {
    blob: candidate.blob,
    downloadUrl,
    outputFileName: buildOutputName(file.name, outputFormat),
    originalBytes: file.size,
    compressedBytes: candidate.blob.size,
    reductionPercent,
    quality: candidate.quality,
    iterations: candidate.iterations,
    reachedTarget,
    cannotReachTarget: !reachedTarget,
    targetMode,
    targetMinBytes,
    targetMaxBytes,
    targetMissReason,
    mimeType: outputFormat,
    width: candidate.width,
    height: candidate.height,
  }
}

export async function compressToTarget(options: CompressOptions): Promise<CompressionResult> {
  const {
    file,
    outputFormat,
    signal,
    minQuality,
    maxQuality,
    maxIterations,
    tolerance,
    maxWidth,
    targetMode,
  } = options

  const bounds = normalizeTargetBounds(targetMode, options.targetMinBytes, options.targetMaxBytes)
  const normalizedMaxWidth = normalizeMaxWidth(maxWidth)

  const decoded = await decodeImage(file, signal)

  try {
    let workingWidth = normalizedMaxWidth
      ? Math.min(decoded.width, normalizedMaxWidth)
      : decoded.width

    let smallestOverall: EncodedCandidate | null = null

    for (let resizeAttempt = 0; resizeAttempt <= MAX_RESIZE_ATTEMPTS; resizeAttempt += 1) {
      throwIfAborted(signal)

      const rendered = renderToCanvas(decoded.source, decoded.width, decoded.height, workingWidth)
      const { bestAtOrBelowMax, smallestCandidate } = await runQualitySearch({
        canvas: rendered.canvas,
        width: rendered.width,
        height: rendered.height,
        outputFormat,
        targetMaxBytes: bounds.max,
        minQuality,
        maxQuality,
        maxIterations,
        tolerance,
        signal,
      })

      if (!smallestOverall || smallestCandidate.blob.size < smallestOverall.blob.size) {
        smallestOverall = smallestCandidate
      }

      if (bestAtOrBelowMax) {
        if (targetMode === 'under') {
          return buildResult({
            file,
            outputFormat,
            candidate: bestAtOrBelowMax,
            reachedTarget: true,
            targetMode,
            targetMinBytes: bounds.min,
            targetMaxBytes: bounds.max,
            targetMissReason: null,
          })
        }

        if (bestAtOrBelowMax.blob.size >= bounds.min) {
          return buildResult({
            file,
            outputFormat,
            candidate: bestAtOrBelowMax,
            reachedTarget: true,
            targetMode,
            targetMinBytes: bounds.min,
            targetMaxBytes: bounds.max,
            targetMissReason: null,
          })
        }

        return buildResult({
          file,
          outputFormat,
          candidate: bestAtOrBelowMax,
          reachedTarget: false,
          targetMode,
          targetMinBytes: bounds.min,
          targetMaxBytes: bounds.max,
          targetMissReason: `Could not reach the minimum target of ${formatBytesForMessage(
            bounds.min,
          )} without exceeding limits.`,
        })
      }

      if (!normalizedMaxWidth) {
        break
      }

      const nextWidth = Math.floor(workingWidth * DOWNSCALE_FACTOR)
      if (nextWidth >= workingWidth || nextWidth < MIN_DIMENSION) {
        break
      }

      workingWidth = nextWidth
    }

    if (!smallestOverall) {
      throw new Error('Unable to generate a compressed image output.')
    }

    const missReason =
      targetMode === 'range'
        ? `Could not compress below the maximum target of ${formatBytesForMessage(bounds.max)}.`
        : `Could not compress under ${formatBytesForMessage(bounds.max)}.`

    return buildResult({
      file,
      outputFormat,
      candidate: smallestOverall,
      reachedTarget: false,
      targetMode,
      targetMinBytes: bounds.min,
      targetMaxBytes: bounds.max,
      targetMissReason: missReason,
    })
  } finally {
    decoded.release()
  }
}
