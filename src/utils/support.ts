import type { OutputFormat } from '../types'

const OUTPUT_CANDIDATES: OutputFormat[] = ['image/jpeg', 'image/webp', 'image/avif']

async function canEncodeMimeType(mimeType: OutputFormat): Promise<boolean> {
  if (typeof document === 'undefined') {
    return false
  }

  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 2

  const context = canvas.getContext('2d')
  if (!context || typeof canvas.toBlob !== 'function') {
    return false
  }

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, 2, 2)

  return new Promise<boolean>((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(false)
          return
        }

        resolve(blob.size > 0)
      },
      mimeType,
      0.8,
    )
  })
}

export async function detectSupportedOutputFormats(): Promise<OutputFormat[]> {
  const results = await Promise.all(
    OUTPUT_CANDIDATES.map(async (mimeType) => ({
      mimeType,
      isSupported: await canEncodeMimeType(mimeType),
    })),
  )

  const supported = results.filter((entry) => entry.isSupported).map((entry) => entry.mimeType)

  if (!supported.includes('image/jpeg')) {
    supported.unshift('image/jpeg')
  }

  return [...new Set(supported)]
}

export function formatLabelForMimeType(mimeType: OutputFormat): string {
  if (mimeType === 'image/jpeg') {
    return 'JPEG'
  }

  if (mimeType === 'image/webp') {
    return 'WEBP'
  }

  return 'AVIF'
}
