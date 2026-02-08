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
    <section className="panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="panel-title">Add Images</h2>
        <span className="meta-text">JPEG, PNG, WEBP, AVIF</span>
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
          relative block cursor-pointer rounded-sm border border-dashed px-3 py-6 text-center transition
          ${
            isDragging
              ? 'border-zinc-500 bg-zinc-800'
              : 'border-zinc-700 bg-zinc-950 hover:border-zinc-600 hover:bg-zinc-900'
          }
          ${disabled ? 'cursor-not-allowed opacity-60' : ''}
        `}
      >
        <div className="space-y-1">
          <p className="text-sm font-medium text-zinc-100">Drag files here or click to browse</p>
          <p className="meta-text">Multiple files supported</p>
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
