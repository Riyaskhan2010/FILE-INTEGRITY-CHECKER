import React, { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, File, X } from 'lucide-react'

export default function FileDropzone({ onFile, file, onClear, accept, maxSize = 50 * 1024 * 1024 }) {
  const onDrop = useCallback(accepted => {
    if (accepted[0]) onFile(accepted[0])
  }, [onFile])

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize,
    accept,
  })

  const rejection = fileRejections[0]?.errors[0]

  if (file) {
    return (
      <div className="border-2 border-cyber-accent border-opacity-40 rounded-xl p-5 bg-cyber-accent bg-opacity-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyber-accent bg-opacity-10 border border-cyber-accent border-opacity-20 flex items-center justify-center flex-shrink-0">
            <File className="w-6 h-6 text-cyber-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-cyber-text truncate">{file.name}</p>
            <p className="text-xs text-cyber-muted mt-0.5">
              {formatSize(file.size)} · {file.type || 'Unknown type'}
            </p>
          </div>
          <button
            onClick={onClear}
            className="flex-shrink-0 p-1.5 rounded-lg text-cyber-muted hover:text-cyber-red hover:bg-red-900 hover:bg-opacity-20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200
          ${isDragActive
            ? 'border-cyber-accent bg-cyber-accent bg-opacity-5'
            : 'border-cyber-border hover:border-cyber-accent hover:border-opacity-60 hover:bg-cyber-surface'}
        `}
      >
        <input {...getInputProps()} />
        <div className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center
          ${isDragActive ? 'bg-cyber-accent bg-opacity-20' : 'bg-cyber-border bg-opacity-50'}`}>
          <Upload className={`w-7 h-7 ${isDragActive ? 'text-cyber-accent' : 'text-cyber-muted'}`} />
        </div>
        {isDragActive ? (
          <p className="text-cyber-accent font-semibold text-base">Drop the file here</p>
        ) : (
          <>
            <p className="text-cyber-text font-semibold text-base mb-1">Drop your file here</p>
            <p className="text-cyber-muted text-sm mb-3">or click to browse</p>
            <span className="text-xs text-cyber-muted bg-cyber-border bg-opacity-50 px-3 py-1 rounded-full">
              Max {formatSize(maxSize)} · All common file types supported
            </span>
          </>
        )}
      </div>
      {rejection && (
        <p className="text-cyber-red text-xs mt-2 ml-1">
          {rejection.code === 'file-too-large' ? `File is too large. Max ${formatSize(maxSize)}.` : rejection.message}
        </p>
      )}
    </div>
  )
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
