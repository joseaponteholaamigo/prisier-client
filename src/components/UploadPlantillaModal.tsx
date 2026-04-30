import { useRef, useId, useEffect, useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { Upload, X, AlertTriangle, CheckCircle2, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { useFocusTrap } from '../lib/useFocusTrap'
import { useToast } from './useToast'
import api from '../lib/api'
import type { PreviewResult, EstadoCarga } from '../lib/types'
import { TEMPLATE_SPECS, MAX_FILE_SIZE_BYTES, type TipoPlantillaCliente } from '../lib/templateSpecs'

// ─── Props ────────────────────────────────────────────────────────────────────

interface UploadPlantillaModalProps {
  tipo: TipoPlantillaCliente
  isOpen: boolean
  onClose: () => void
  onConfirmed: (previewId: string) => void
}

// ─── Tipos internos ───────────────────────────────────────────────────────────

type Phase = 'dropzone' | 'preview' | 'processing' | 'finalizado'

interface DropzoneError {
  message: string
  details?: string
}

// ─── Validación frontend ligera ───────────────────────────────────────────────

async function validateFile(file: File, tipo: TipoPlantillaCliente): Promise<DropzoneError | null> {
  const spec = TEMPLATE_SPECS[tipo]

  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return { message: 'El archivo debe tener extensión .xlsx' }
  }

  if (file.size >= MAX_FILE_SIZE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return { message: `Archivo muy grande (${mb} MB). El límite es 10 MB.` }
  }

  try {
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })

    const sheetExists = wb.SheetNames.some(
      name => name.trim().toLowerCase() === spec.sheetName.trim().toLowerCase()
    )
    if (!sheetExists) {
      return {
        message: `Falta la hoja "${spec.sheetName}"`,
        details: `Hojas encontradas: ${wb.SheetNames.join(', ') || '(ninguna)'}`,
      }
    }

    const sheet = wb.Sheets[spec.sheetName] ?? wb.Sheets[
      wb.SheetNames.find(n => n.trim().toLowerCase() === spec.sheetName.trim().toLowerCase()) ?? ''
    ]
    if (!sheet) return { message: `No se pudo leer la hoja "${spec.sheetName}"` }

    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
    const headerRow = (rows[0] ?? []) as string[]
    const normalizedFound = headerRow.map(h => String(h ?? '').trim())
    const missing = spec.headers.filter(h => !normalizedFound.includes(h))

    if (missing.length > 0) {
      return {
        message: `Faltan columnas en la hoja "${spec.sheetName}"`,
        details: `Esperadas: ${spec.headers.join(', ')} | Faltantes: ${missing.join(', ')}`,
      }
    }
  } catch {
    return { message: 'No se pudo leer el archivo .xlsx. Verificá que no esté corrupto.' }
  }

  return null
}

// ─── Sub-componente: tabla de errores ─────────────────────────────────────────

function ErroresTable({ errores }: { errores: PreviewResult['errores'] }) {
  const [expanded, setExpanded] = useState(false)
  const VISIBLE = 5
  const shown = expanded ? errores : errores.slice(0, VISIBLE)

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-p-muted uppercase tracking-wider mb-2">
        Errores / omisiones ({errores.length})
      </p>
      <div className="rounded-lg border border-p-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-p-border text-p-muted">
              <th className="text-left py-1.5 px-3 w-12">Fila</th>
              <th className="text-left py-1.5 px-3 w-28">Columna</th>
              <th className="text-left py-1.5 px-3">Mensaje</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((e, i) => (
              <tr key={i} className="border-b border-p-border/50">
                <td className="py-1.5 px-3 text-white">{e.fila}</td>
                <td className="py-1.5 px-3 text-p-muted">{e.columna ?? '—'}</td>
                <td className="py-1.5 px-3 text-red-400">{e.mensaje}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {errores.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs text-p-blue flex items-center gap-1 hover:underline"
        >
          {expanded
            ? <><ChevronUp size={12} aria-hidden /> Mostrar menos</>
            : <><ChevronDown size={12} aria-hidden /> Ver {errores.length - VISIBLE} más</>}
        </button>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function UploadPlantillaModal({
  tipo,
  isOpen,
  onClose,
  onConfirmed,
}: UploadPlantillaModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const spec = TEMPLATE_SPECS[tipo]

  const [phase, setPhase] = useState<Phase>('dropzone')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [dropError, setDropError] = useState<DropzoneError | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [estadoTerminal, setEstadoTerminal] = useState<Exclude<EstadoCarga, 'procesando'> | null>(null)

  useFocusTrap(dialogRef, isOpen)

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (phase === 'dropzone' || phase === 'finalizado') handleClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) {
      setPhase('dropzone')
      setDropError(null)
      setSelectedFile(null)
      setPreview(null)
      setEstadoTerminal(null)
    }
  }, [isOpen])

  const handleClose = useCallback(() => {
    if (preview?.previewId && phase === 'preview') {
      api.delete(`ingesta/preview/${preview.previewId}`).catch(() => { /* silent */ })
    }
    onClose()
  }, [preview, phase, onClose])

  const processFile = useCallback(async (file: File) => {
    setDropError(null)
    setIsValidating(true)
    try {
      const err = await validateFile(file, tipo)
      if (err) {
        setDropError(err)
        return
      }
      setSelectedFile(file)
      setIsSending(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await api.post<PreviewResult>(`ingesta/preview/${tipo}`, formData)
        setPreview(res.data)
        setPhase('preview')
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error
        toast.error(msg ?? 'Error al procesar el archivo. Intentá de nuevo.')
        setSelectedFile(null)
      } finally {
        setIsSending(false)
      }
    } finally {
      setIsValidating(false)
    }
  }, [tipo, toast])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleConfirm = useCallback(async () => {
    if (!preview) return
    setIsConfirming(true)
    try {
      await api.post(`ingesta/confirmar/${preview.previewId}`)
      setPhase('processing')

      // Poll hasta que el historial refleje el estado terminal (~3s en mock)
      setTimeout(async () => {
        try {
          const detail = await api.get<{ estado: EstadoCarga }>(`ingesta/preview/${preview.previewId}/estado`)
          const estado = detail.data.estado
          setEstadoTerminal(estado !== 'procesando' ? estado : 'exitoso')
        } catch {
          setEstadoTerminal('exitoso')
        }
        setPhase('finalizado')
        onConfirmed(preview.previewId)
        toast.success(`Importación de ${spec.label} procesada`)
      }, 3000)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { error?: string } } }).response?.status
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error
      if (status === 410) {
        toast.error('El preview expiró. Volvé a subir el archivo.')
        setPhase('dropzone')
        setPreview(null)
        setSelectedFile(null)
      } else {
        toast.error(msg ?? 'Error al confirmar. Intentá de nuevo.')
      }
    } finally {
      setIsConfirming(false)
    }
  }, [preview, spec.label, onConfirmed, toast])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={e => {
        if (e.target === e.currentTarget && (phase === 'dropzone' || phase === 'finalizado')) {
          handleClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="glass-panel w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-p-border">
          <h2 id={titleId} className="text-base font-semibold text-white">
            Importar {spec.label}
          </h2>
          {(phase === 'dropzone' || phase === 'finalizado') && (
            <button
              type="button"
              onClick={handleClose}
              aria-label="Cerrar modal"
              className="btn-icon text-p-muted hover:text-white"
            >
              <X size={18} aria-hidden />
            </button>
          )}
        </div>

        <div className="px-5 py-4">
          {/* ── FASE 1: DROP-ZONE ───────────────────────────────────────── */}
          {phase === 'dropzone' && (
            <>
              <p className="text-sm text-p-muted mb-4">
                Arrastrá o seleccioná un archivo{' '}
                <code className="text-xs bg-white/10 px-1 rounded">.xlsx</code>{' '}
                con la plantilla de <strong className="text-white">{spec.label}</strong>.
              </p>

              <div
                role="button"
                tabIndex={0}
                aria-label={`Seleccionar archivo Excel para importar ${spec.label}`}
                onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                  ${isDragOver ? 'border-p-lime bg-p-lime/10' : 'border-p-border hover:border-p-muted hover:bg-white/5'}
                  ${(isValidating || isSending) ? 'pointer-events-none opacity-60' : ''}`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  aria-hidden="true"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) processFile(f)
                    e.target.value = ''
                  }}
                />
                {(isValidating || isSending) ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 size={32} className="text-p-lime animate-spin" aria-hidden />
                    <p className="text-sm text-p-muted">
                      {isValidating ? 'Validando archivo…' : 'Enviando al servidor…'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload size={32} className={isDragOver ? 'text-p-lime' : 'text-p-muted'} aria-hidden />
                    <div>
                      <p className="text-sm font-medium text-white">
                        Arrastrá el archivo aquí o hacé clic para seleccionar
                      </p>
                      <p className="text-xs text-p-muted mt-1">Solo .xlsx · Máx. 10 MB</p>
                    </div>
                  </div>
                )}
              </div>

              {dropError && (
                <div role="alert" className="mt-3 flex flex-col gap-1 p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" aria-hidden />
                    <p className="text-sm text-red-300 font-medium">{dropError.message}</p>
                  </div>
                  {dropError.details && (
                    <p className="text-xs text-p-muted ml-5">{dropError.details}</p>
                  )}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-p-border flex justify-end">
                <button type="button" onClick={handleClose} className="btn-icon text-p-muted hover:text-white px-4 py-2 text-sm border border-p-border rounded-lg">
                  Cancelar
                </button>
              </div>
            </>
          )}

          {/* ── FASE 2: PREVIEW ────────────────────────────────────────── */}
          {phase === 'preview' && preview && (
            <>
              <p className="text-sm text-p-muted mb-4">
                Archivo: <span className="font-medium text-white">{selectedFile?.name}</span>
              </p>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl border border-p-border bg-white/5 p-3 text-center">
                  <p className="text-2xl font-bold text-p-lime">{preview.resumen.nuevas}</p>
                  <p className="text-xs text-p-muted mt-1">Nuevas</p>
                </div>
                <div className="rounded-xl border border-p-border bg-white/5 p-3 text-center">
                  <p className="text-2xl font-bold text-p-blue">{preview.resumen.actualizadas}</p>
                  <p className="text-xs text-p-muted mt-1">Actualizadas</p>
                </div>
                <div className={`rounded-xl border p-3 text-center ${preview.resumen.omitidas > 0 ? 'border-yellow-700/30 bg-yellow-900/10' : 'border-p-border bg-white/5'}`}>
                  <p className={`text-2xl font-bold ${preview.resumen.omitidas > 0 ? 'text-yellow-300' : 'text-p-muted'}`}>
                    {preview.resumen.omitidas}
                  </p>
                  <p className="text-xs text-p-muted mt-1">Omitidas</p>
                </div>
              </div>

              {preview.resumen.omitidas > 0 && (
                <div className="mb-3 flex items-start gap-2 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
                  <AlertTriangle size={15} className="text-yellow-300 shrink-0 mt-0.5" aria-hidden />
                  <p className="text-sm text-yellow-200">
                    <strong>{preview.resumen.omitidas} filas serán omitidas</strong> por errores. El resto se aplicará normalmente.
                  </p>
                </div>
              )}

              {preview.errores.length > 0 && <ErroresTable errores={preview.errores} />}

              <div className="mt-5 pt-4 border-t border-p-border flex flex-col-reverse sm:flex-row justify-between gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isConfirming}
                  className="px-4 py-2 text-sm border border-p-border rounded-lg text-p-muted hover:text-white disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isConfirming}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  {isConfirming
                    ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Confirmando…</>
                    : 'Confirmar importación'}
                </button>
              </div>
            </>
          )}

          {/* ── FASE 3: PROCESANDO ─────────────────────────────────────── */}
          {phase === 'processing' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 size={40} className="text-p-lime animate-spin" aria-hidden />
              <div className="text-center">
                <p className="text-sm font-medium text-white">Aplicando importación de {spec.label}…</p>
                <p className="text-xs text-p-muted mt-1">Esto puede tomar unos segundos</p>
              </div>
            </div>
          )}

          {/* ── FASE 4: FINALIZADO ─────────────────────────────────────── */}
          {phase === 'finalizado' && (() => {
            const esExitoso = estadoTerminal === 'exitoso'
            const esAdvertencia = estadoTerminal === 'con_advertencias'
            const bannerStyle = esExitoso
              ? 'bg-green-900/20 border-green-700/30'
              : esAdvertencia
                ? 'bg-yellow-900/20 border-yellow-700/30'
                : 'bg-red-900/20 border-red-700/30'
            const iconEl = esExitoso
              ? <CheckCircle2 size={20} className="text-p-lime shrink-0 mt-0.5" aria-hidden />
              : <AlertTriangle size={20} className={`${esAdvertencia ? 'text-yellow-300' : 'text-red-400'} shrink-0 mt-0.5`} aria-hidden />
            const titulo = esExitoso
              ? `Importación exitosa — ${spec.label}`
              : esAdvertencia
                ? `Importación con advertencias — ${spec.label}`
                : `Importación fallida — ${spec.label}`
            const subtitulo = esExitoso
              ? 'Todos los datos se aplicaron correctamente.'
              : esAdvertencia
                ? 'La importación se completó parcialmente. Revisá los errores.'
                : 'No se pudo aplicar ningún dato. Revisá los errores.'

            return (
              <>
                <div className={`flex items-start gap-3 mb-4 p-3 border rounded-xl ${bannerStyle}`} role="status" aria-live="polite">
                  {iconEl}
                  <div>
                    <p className="text-sm font-medium text-white">{titulo}</p>
                    <p className="text-xs text-p-muted mt-0.5">{subtitulo}</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-p-border flex justify-end">
                  <button type="button" onClick={onClose} className="btn-primary">
                    Cerrar
                  </button>
                </div>
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
