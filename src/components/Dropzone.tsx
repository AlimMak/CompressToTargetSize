import { useId, useState } from 'react'

interface DropzoneProps {
  disabled?: boolean
  onFilesSelected: (files: File[]) => void
}

export function Dropzone({ disabled = false, onFilesSelected }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputId = useId()

  const handleFiles = (files: FileList | null): void => {
    if (!files || files.length === 0 || disabled) {
      return
    }

    onFilesSelected(Array.from(files))
  }

  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="panel-title">Add Images</h2>
        <span className="text-xs text-slate-400">JPEG, PNG, WEBP, AVIF</span>
      </div>

      <label
        htmlFor={inputId}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!disabled) {
            setIsDragging(true)
          }
        }}
        onDragOver={(event) => {
          event.preventDefault()
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setIsDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          handleFiles(event.dataTransfer.files)
        }}
        className={`
          relative block cursor-pointer rounded-2xl border border-dashed px-5 py-8 text-center transition
          ${
            isDragging
              ? 'border-cyan-400 bg-cyan-500/10'
              : 'border-slate-600/80 bg-slate-900/50 hover:border-cyan-500/70 hover:bg-slate-900/70'
          }
          ${disabled ? 'cursor-not-allowed opacity-60' : ''}
        `}
      >
        <div className="space-y-3">
          <p className="text-base font-semibold text-slate-100">Drag and drop images here</p>
          <p className="text-sm text-slate-400">or click to choose multiple files</p>
          <span className="inline-flex rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300">
            All processing is local in your browser
          </span>
        </div>
      </label>

      <input
        id={inputId}
        type="file"
        className="sr-only"
        accept="image/*"
        multiple
        disabled={disabled}
        onChange={(event) => {
          handleFiles(event.target.files)
          event.target.value = ''
        }}
      />
    </section>
  )
}
