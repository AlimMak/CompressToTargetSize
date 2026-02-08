import { zipSync } from 'fflate'

export interface ZipEntry {
  fileName: string
  blob: Blob
}

function uniqueZipName(fileName: string, seen: Map<string, number>): string {
  const current = seen.get(fileName)
  if (current === undefined) {
    seen.set(fileName, 1)
    return fileName
  }

  const dotIndex = fileName.lastIndexOf('.')
  const base = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  const extension = dotIndex > 0 ? fileName.slice(dotIndex) : ''
  const nextCount = current + 1

  seen.set(fileName, nextCount)

  return `${base}-${nextCount}${extension}`
}

export async function buildZipBlob(entries: ZipEntry[]): Promise<Blob> {
  const namedContents = new Map<string, Uint8Array>()
  const seen = new Map<string, number>()

  for (const entry of entries) {
    const safeName = uniqueZipName(entry.fileName, seen)
    const bytes = new Uint8Array(await entry.blob.arrayBuffer())
    namedContents.set(safeName, bytes)
  }

  const zipObject: Record<string, Uint8Array> = {}
  for (const [name, bytes] of namedContents) {
    zipObject[name] = bytes
  }

  const archive = zipSync(zipObject, { level: 6 })
  const normalizedArchive = new Uint8Array(archive.byteLength)
  normalizedArchive.set(archive)

  return new Blob([normalizedArchive.buffer], { type: 'application/zip' })
}

export async function downloadZip(entries: ZipEntry[], zipName: string): Promise<void> {
  if (!entries.length) {
    return
  }

  const zipBlob = await buildZipBlob(entries)
  const downloadUrl = URL.createObjectURL(zipBlob)

  const anchor = document.createElement('a')
  anchor.href = downloadUrl
  anchor.download = zipName
  anchor.click()

  URL.revokeObjectURL(downloadUrl)
}
