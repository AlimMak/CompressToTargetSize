import type { CompressionResult, OutputFormat } from '../types'
import { createAbortError } from './concurrency'

interface CompressOptions {
  file: File
  targetBytes: number
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

function normalizeTargetBytes(targetBytes: number): number {
  if (!Number.isFinite(targetBytes)) {
    return 1024
  }

  return Math.max(1, Math.floor(targetBytes))
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
  targetBytes: number
  minQuality: number
  maxQuality: number
  maxIterations: number
  tolerance: number
  signal?: AbortSignal
}): Promise<{ bestUnderTarget: EncodedCandidate | null; smallestCandidate: EncodedCandidate }> {
  const {
    canvas,
    width,
    height,
    outputFormat,
    targetBytes,
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

  let lowerBound = normalizedMin
  let upperBound = normalizedMax

  const minCandidate = await encodeAtQuality(normalizedMin)
  let smallestCandidate = minCandidate
  let bestUnderTarget: EncodedCandidate | null =
    minCandidate.blob.size <= targetBytes ? minCandidate : null

  if (bestUnderTarget) {
    const delta = targetBytes - bestUnderTarget.blob.size
    if (delta <= targetBytes * normalizedTolerance) {
      return {
        bestUnderTarget,
        smallestCandidate,
      }
    }
  }

  while (iterationsUsed < allowedIterations) {
    throwIfAborted(signal)

    const midQuality = Number(((lowerBound + upperBound) / 2).toFixed(4))
    const candidate = await encodeAtQuality(midQuality)

    if (candidate.blob.size < smallestCandidate.blob.size) {
      smallestCandidate = candidate
    }

    if (candidate.blob.size > targetBytes) {
      upperBound = midQuality
    } else {
      if (!bestUnderTarget || candidate.blob.size > bestUnderTarget.blob.size) {
        bestUnderTarget = candidate
      }

      lowerBound = midQuality
    }

    if (bestUnderTarget) {
      const delta = targetBytes - bestUnderTarget.blob.size
      if (delta <= targetBytes * normalizedTolerance) {
        break
      }
    }

    if (Math.abs(upperBound - lowerBound) < 0.003) {
      break
    }
  }

  return {
    bestUnderTarget,
    smallestCandidate,
  }
}

function buildResult(options: {
  file: File
  outputFormat: OutputFormat
  candidate: EncodedCandidate
  reachedTarget: boolean
}): CompressionResult {
  const { file, outputFormat, candidate, reachedTarget } = options
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
  } = options

  const targetBytes = normalizeTargetBytes(options.targetBytes)
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
      const { bestUnderTarget, smallestCandidate } = await runQualitySearch({
        canvas: rendered.canvas,
        width: rendered.width,
        height: rendered.height,
        outputFormat,
        targetBytes,
        minQuality,
        maxQuality,
        maxIterations,
        tolerance,
        signal,
      })

      if (!smallestOverall || smallestCandidate.blob.size < smallestOverall.blob.size) {
        smallestOverall = smallestCandidate
      }

      if (bestUnderTarget) {
        throwIfAborted(signal)

        return buildResult({
          file,
          outputFormat,
          candidate: bestUnderTarget,
          reachedTarget: true,
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

    throwIfAborted(signal)

    return buildResult({
      file,
      outputFormat,
      candidate: smallestOverall,
      reachedTarget: false,
    })
  } finally {
    decoded.release()
  }
}
