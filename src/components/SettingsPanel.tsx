import type { AppSettings, OutputFormat, TargetUnit } from '../types'
import { formatLabelForMimeType } from '../utils/support'

interface SettingsPanelProps {
  settings: AppSettings
  supportedFormats: OutputFormat[]
  disabled?: boolean
  onChange: (nextSettings: AppSettings) => void
}

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
    })
  }

  return (
    <section className="panel p-5 sm:p-6">
      <h2 className="panel-title mb-4">Settings</h2>

      <div className="grid gap-4 sm:grid-cols-2">
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

      <details className="mt-5 rounded-xl border border-slate-700/70 bg-slate-900/45 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold text-slate-200">
          Advanced quality controls
        </summary>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
