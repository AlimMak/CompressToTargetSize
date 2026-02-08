import type { TargetUnit } from '../types'

const UNITS = ['B', 'KB', 'MB', 'GB'] as const

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  const value = bytes / 1024 ** exponent
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2

  return `${value.toFixed(digits)} ${UNITS[exponent]}`
}

export function toBytes(value: number, unit: TargetUnit): number {
  const normalized = Number.isFinite(value) ? Math.max(1, value) : 1

  return Math.round(normalized * (unit === 'MB' ? 1024 * 1024 : 1024))
}

export function formatReduction(reductionPercent: number): string {
  if (!Number.isFinite(reductionPercent)) {
    return '0%'
  }

  const normalized = Math.max(-999, Math.min(999, reductionPercent))

  return `${normalized.toFixed(1)}%`
}
