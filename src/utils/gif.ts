const GIF_SIGNATURES = new Set(['GIF87a', 'GIF89a'])

export const GIF_REJECTION_MESSAGE = 'Animated GIF not supported in V1.'

export function gifRejectionMessage(fileName: string): string {
  return `${fileName}: ${GIF_REJECTION_MESSAGE}`
}

export async function isGifFile(file: File): Promise<boolean> {
  if (file.type.toLowerCase() === 'image/gif') {
    return true
  }

  if (file.name.toLowerCase().endsWith('.gif')) {
    return true
  }

  try {
    const signatureBuffer = await file.slice(0, 6).arrayBuffer()
    const signatureBytes = new Uint8Array(signatureBuffer)

    if (signatureBytes.length < 6) {
      return false
    }

    const signature = String.fromCharCode(...signatureBytes)

    return GIF_SIGNATURES.has(signature)
  } catch {
    return false
  }
}
