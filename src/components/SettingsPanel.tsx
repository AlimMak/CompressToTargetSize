import type { AppSettings, OutputFormat, PresetId, TargetMode, TargetUnit } from '../types'
import { formatLabelForMimeType } from '../utils/support'

interface SettingsPanelProps {
  settings: AppSettings
  supportedFormats: OutputFormat[]
  disabled?: boolean
  onChange: (nextSettings: AppSettings) => void
}

interface PresetDefinition {
  id: Exclude<PresetId, 'custom'>
  label: string
  outputFormat: OutputFormat
  targetMode: TargetMode
  targetSize: number
  targetUnit: TargetUnit
  rangeMinKB: number
  rangeMaxKB: number
  maxWidth: number
}

const PRESETS: PresetDefinition[] = [
  {
    id: 'linkedin-image',
    label: 'LinkedIn image',
    outputFormat: 'image/jpeg',
    targetMode: 'under',
    targetSize: 300,
    targetUnit: 'KB',
    rangeMinKB: 200,
    rangeMaxKB: 300,
    maxWidth: 1600,
  },
  {
    id: 'email-attachment-safe',
    label: 'Email attachment safe',
    outputFormat: 'image/jpeg',
    targetMode: 'under',
    targetSize: 1,
    targetUnit: 'MB',
    rangeMinKB: 700,
    rangeMaxKB: 1024,
    maxWidth: 2000,
  },
  {
    id: 'web-hero',
    label: 'Web hero',
    outputFormat: 'image/webp',
    targetMode: 'under',
    targetSize: 500,
    targetUnit: 'KB',
    rangeMinKB: 350,
    rangeMaxKB: 500,
    maxWidth: 2400,
  },
]

export function SettingsPanel({
  settings,
  supportedFormats,
  disabled = false,
  onChange,
}: SettingsPanelProps) {
  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    onChange({
      ...settings,
      [key]: value,
      selectedPreset: key === 'selectedPreset' ? (value as PresetId) : 'custom',
    })
  }

  const applyPreset = (presetId: PresetId): void => {
    if (presetId === 'custom') {
      onChange({
        ...settings,
        selectedPreset: 'custom',
      })
      return
    }

    const preset = PRESETS.find((entry) => entry.id === presetId)
    if (!preset) {
      return
    }

    const fallbackFormat = supportedFormats[0] ?? 'image/jpeg'
    const outputFormat = supportedFormats.includes(preset.outputFormat)
      ? preset.outputFormat
      : fallbackFormat

    onChange({
      ...settings,
      selectedPreset: preset.id,
      outputFormat,
      targetMode: preset.targetMode,
      targetSize: preset.targetSize,
      targetUnit: preset.targetUnit,
      rangeMinKB: preset.rangeMinKB,
      rangeMaxKB: preset.rangeMaxKB,
      maxWidth: preset.maxWidth,
    })
  }

  const modeButtonClass = (mode: TargetMode): string => {
    const isActive = settings.targetMode === mode

    return [
      'rounded-sm border px-2.5 py-1.5 text-sm transition',
      isActive
        ? 'border-zinc-200 bg-zinc-100 text-zinc-900'
        : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800',
    ].join(' ')
  }

  return (
    <section className="panel p-3">
      <h2 className="panel-title mb-3">Settings</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field-group sm:col-span-2">
          <span className="field-label">Preset</span>
          <select
            className="field-input"
            disabled={disabled}
            value={settings.selectedPreset}
            onChange={(event) => {
              applyPreset(event.target.value as PresetId)
            }}
          >
            <option value="custom">Custom</option>
            {PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <div className="field-group sm:col-span-2">
          <span className="field-label">Target mode</span>
          <div className="mt-1 flex items-center gap-1.5">
            <button
              type="button"
              disabled={disabled}
              className={modeButtonClass('under')}
              onClick={() => {
                onChange({
                  ...settings,
                  targetMode: 'under',
                  selectedPreset: 'custom',
                })
              }}
            >
              Under
            </button>
            <button
              type="button"
              disabled={disabled}
              className={modeButtonClass('range')}
              onClick={() => {
                onChange({
                  ...settings,
                  targetMode: 'range',
                  selectedPreset: 'custom',
                })
              }}
            >
              Range
            </button>
          </div>
        </div>

        {settings.targetMode === 'under' ? (
          <>
            <label className="field-group">
              <span className="field-label">Target size</span>
              <input
                className="field-input"
                type="number"
                min={1}
                step={1}
                disabled={disabled}
                value={settings.targetSize}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  updateSetting('targetSize', Number.isFinite(value) ? Math.max(1, value) : 1)
                }}
              />
            </label>

            <label className="field-group">
              <span className="field-label">Size unit</span>
              <select
                className="field-input"
                disabled={disabled}
                value={settings.targetUnit}
                onChange={(event) => {
                  updateSetting('targetUnit', event.target.value as TargetUnit)
                }}
              >
                <option value="KB">KB</option>
                <option value="MB">MB</option>
              </select>
            </label>
          </>
        ) : (
          <>
            <label className="field-group">
              <span className="field-label">Range min (KB)</span>
              <input
                className="field-input"
                type="number"
                min={1}
                step={1}
                disabled={disabled}
                value={settings.rangeMinKB}
                onChange={(event) => {
                  const nextMin = Number(event.target.value)
                  const minValue = Number.isFinite(nextMin) ? Math.max(1, Math.round(nextMin)) : 1

                  onChange({
                    ...settings,
                    selectedPreset: 'custom',
                    rangeMinKB: minValue,
                    rangeMaxKB: Math.max(minValue, settings.rangeMaxKB),
                  })
                }}
              />
            </label>

            <label className="field-group">
              <span className="field-label">Range max (KB)</span>
              <input
                className="field-input"
                type="number"
                min={1}
                step={1}
                disabled={disabled}
                value={settings.rangeMaxKB}
                onChange={(event) => {
                  const nextMax = Number(event.target.value)
                  const maxValue = Number.isFinite(nextMax)
                    ? Math.max(settings.rangeMinKB, Math.round(nextMax))
                    : settings.rangeMinKB

                  onChange({
                    ...settings,
                    selectedPreset: 'custom',
                    rangeMaxKB: maxValue,
                  })
                }}
              />
            </label>
          </>
        )}

        <label className="field-group">
          <span className="field-label">Output format</span>
          <select
            className="field-input"
            disabled={disabled}
            value={settings.outputFormat}
            onChange={(event) => {
              updateSetting('outputFormat', event.target.value as OutputFormat)
            }}
          >
            {supportedFormats.map((format) => (
              <option key={format} value={format}>
                {formatLabelForMimeType(format)}
              </option>
            ))}
          </select>
        </label>

        <label className="field-group">
          <span className="field-label">Max width (px, optional)</span>
          <input
            className="field-input"
            type="number"
            min={64}
            step={1}
            disabled={disabled}
            value={settings.maxWidth}
            placeholder="No resize limit"
            onChange={(event) => {
              const rawValue = event.target.value.trim()
              if (!rawValue) {
                updateSetting('maxWidth', '')
                return
              }

              const parsed = Number(rawValue)
              updateSetting('maxWidth', Number.isFinite(parsed) ? Math.max(64, parsed) : '')
            }}
          />
        </label>

        <label className="field-group">
          <span className="field-label">Batch concurrency</span>
          <select
            className="field-input"
            disabled={disabled}
            value={settings.concurrency}
            onChange={(event) => {
              const next = Number(event.target.value)
              updateSetting('concurrency', next === 5 ? 5 : 3)
            }}
          >
            <option value={3}>3</option>
            <option value={5}>5</option>
          </select>
        </label>
      </div>

      <details className="mt-3 rounded-sm border border-zinc-800 bg-zinc-950 p-3">
        <summary className="cursor-pointer select-none text-sm font-medium text-zinc-300">
          Advanced quality controls
        </summary>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="field-group">
            <span className="field-label">Minimum quality</span>
            <input
              className="field-input"
              type="number"
              min={0.01}
              max={0.95}
              step={0.01}
              disabled={disabled}
              value={settings.qualityMin}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (Number.isFinite(next)) {
                  updateSetting('qualityMin', Math.max(0.01, Math.min(next, settings.qualityMax - 0.01)))
                }
              }}
            />
          </label>

          <label className="field-group">
            <span className="field-label">Maximum quality</span>
            <input
              className="field-input"
              type="number"
              min={0.05}
              max={0.99}
              step={0.01}
              disabled={disabled}
              value={settings.qualityMax}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (Number.isFinite(next)) {
                  updateSetting('qualityMax', Math.min(0.99, Math.max(next, settings.qualityMin + 0.01)))
                }
              }}
            />
          </label>

          <label className="field-group">
            <span className="field-label">Max iterations</span>
            <input
              className="field-input"
              type="number"
              min={1}
              max={20}
              step={1}
              disabled={disabled}
              value={settings.maxIterations}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (Number.isFinite(next)) {
                  updateSetting('maxIterations', Math.max(1, Math.min(20, Math.round(next))))
                }
              }}
            />
          </label>

          <label className="field-group">
            <span className="field-label">Tolerance (%)</span>
            <input
              className="field-input"
              type="number"
              min={1}
              max={50}
              step={1}
              disabled={disabled}
              value={Math.round(settings.tolerance * 100)}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (Number.isFinite(next)) {
                  updateSetting('tolerance', Math.max(0.01, Math.min(0.5, next / 100)))
                }
              }}
            />
          </label>
        </div>
      </details>
    </section>
  )
}
