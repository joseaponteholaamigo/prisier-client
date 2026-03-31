import { useState, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import api from '../lib/api'
import type { CargaResult, CargaHistorialRow } from '../lib/types'

type UploadType = 'skus' | 'competidores'

export default function IngestaPage() {
  return (
    <div className="space-y-8">
      {/* Upload zones */}
      <div className="grid grid-cols-2 gap-6">
        <UploadZone
          type="skus"
          title="SKUs y Precios"
          description="Código SKU, Nombre, Marca, Categoría, PVP Sugerido, Costo Variable"
          endpoint="/ingesta/upload/skus"
        />
        <UploadZone
          type="competidores"
          title="Precios de Competidores"
          description="Código SKU Cliente, Nombre Competidor, Producto Competidor, Precio, Retailer"
          endpoint="/ingesta/upload/competidores"
        />
      </div>

      {/* History */}
      <HistorialSection />
    </div>
  )
}

/* ──────────────────────────── Upload Zone ──────────────────────────── */

function UploadZone({ type, title, description, endpoint }: {
  type: UploadType; title: string; description: string; endpoint: string
}) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<CargaResult | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      setResult({ totalProcesados: 0, totalErrores: 1, errores: [{ fila: 0, columna: null, mensaje: 'Solo se aceptan archivos .xlsx' }] })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setResult({ totalProcesados: 0, totalErrores: 1, errores: [{ fila: 0, columna: null, mensaje: 'El archivo excede el límite de 5MB' }] })
      return
    }

    setUploading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await api.post<CargaResult>(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setResult(res.data)
      queryClient.invalidateQueries({ queryKey: ['ingesta-historial'] })
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { errores?: { mensaje: string }[] } } })?.response?.data?.errores?.[0]?.mensaje
        ?? 'Error al procesar el archivo'
      setResult({ totalProcesados: 0, totalErrores: 1, errores: [{ fila: 0, columna: null, mensaje: message }] })
    } finally {
      setUploading(false)
    }
  }, [endpoint, queryClient])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }, [handleFile])

  return (
    <div className="glass-panel p-6 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-p-lime" />
          {title}
        </h3>
        <p className="text-xs text-p-muted mt-1">Columnas esperadas: {description}</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
          ${isDragOver ? 'border-p-lime bg-p-lime/10' : 'border-p-border hover:border-p-muted hover:bg-white/5'}
        `}
      >
        <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={onFileSelect} />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-p-lime border-t-transparent" />
            <p className="text-sm text-p-muted">Procesando archivo...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className={`w-8 h-8 ${isDragOver ? 'text-p-lime' : 'text-p-muted'}`} />
            <div>
              <p className="text-sm text-white">Arrastra un archivo .xlsx aquí</p>
              <p className="text-xs text-p-muted mt-1">o haz clic para seleccionar (máx. 5MB)</p>
            </div>
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className={`rounded-lg p-4 ${result.totalErrores === 0 ? 'bg-green-900/30 border border-green-700/40' : result.totalProcesados > 0 ? 'bg-yellow-900/30 border border-yellow-600/40' : 'bg-red-900/30 border border-red-700/40'}`}>
          <div className="flex items-center gap-2">
            {result.totalErrores === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-400" />
            )}
            <div className="flex-1">
              <p className="text-sm text-white">
                {result.totalProcesados} registro{result.totalProcesados !== 1 ? 's' : ''} procesado{result.totalProcesados !== 1 ? 's' : ''}
                {result.totalErrores > 0 && (
                  <span className="text-yellow-300"> · {result.totalErrores} error{result.totalErrores !== 1 ? 'es' : ''}</span>
                )}
              </p>
            </div>
            {result.errores.length > 0 && (
              <button onClick={() => setShowErrors(!showErrors)} className="text-p-muted hover:text-white">
                {showErrors ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>

          {showErrors && result.errores.length > 0 && (
            <div className="mt-3 max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-p-muted border-b border-white/10">
                    <th className="text-left py-1 pr-3">Fila</th>
                    <th className="text-left py-1 pr-3">Columna</th>
                    <th className="text-left py-1">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errores.map((err, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-1 pr-3 text-white">{err.fila}</td>
                      <td className="py-1 pr-3 text-p-muted">{err.columna ?? '—'}</td>
                      <td className="py-1 text-red-300">{err.mensaje}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────── Historial ──────────────────────────── */

function HistorialSection() {
  const { data: historial = [], isLoading } = useQuery({
    queryKey: ['ingesta-historial'],
    queryFn: () => api.get<CargaHistorialRow[]>('/ingesta/historial').then(r => r.data),
  })

  return (
    <div className="glass-panel overflow-x-auto">
      <div className="px-4 py-3 border-b border-p-border">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-p-muted" />
          Historial de Cargas
        </h3>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-p-lime border-t-transparent" />
        </div>
      ) : historial.length === 0 ? (
        <div className="text-center py-8 text-p-muted text-sm">No hay cargas registradas</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-p-border text-p-muted text-xs uppercase tracking-wider">
              <th className="text-left py-3 px-4">Fecha</th>
              <th className="text-left py-3 px-4">Tipo</th>
              <th className="text-left py-3 px-4">Archivo</th>
              <th className="text-center py-3 px-4">Estado</th>
              <th className="text-right py-3 px-4">Registros</th>
              <th className="text-right py-3 px-4">Errores</th>
              <th className="text-left py-3 px-4">Subido por</th>
            </tr>
          </thead>
          <tbody>
            {historial.map(row => (
              <tr key={row.id} className="border-b border-p-border/50">
                <td className="py-3 px-4 text-p-muted">
                  {new Date(row.fechaCarga).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="py-3 px-4 text-white capitalize">{row.tipoArchivo}</td>
                <td className="py-3 px-4 text-p-muted text-xs">{row.nombreArchivo}</td>
                <td className="py-3 px-4 text-center">
                  <EstadoBadge estado={row.estado} />
                </td>
                <td className="py-3 px-4 text-right text-white">{row.registrosProcesados}</td>
                <td className="py-3 px-4 text-right">
                  {row.totalErrores > 0 ? (
                    <span className="text-yellow-300">{row.totalErrores}</span>
                  ) : (
                    <span className="text-p-muted">0</span>
                  )}
                </td>
                <td className="py-3 px-4 text-p-muted text-xs">{row.subidoPor ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function EstadoBadge({ estado }: { estado: string }) {
  if (estado === 'completado') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/40 text-green-300 border border-green-700/40">
        <CheckCircle2 className="w-3 h-3" /> Completado
      </span>
    )
  }
  if (estado === 'completado_con_errores') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-900/40 text-yellow-300 border border-yellow-700/40">
        <AlertCircle className="w-3 h-3" /> Con errores
      </span>
    )
  }
  if (estado === 'error') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/40 text-red-300 border border-red-700/40">
        <AlertCircle className="w-3 h-3" /> Error
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-800/40 text-gray-400 border border-gray-700/40">
      <Clock className="w-3 h-3" /> {estado}
    </span>
  )
}
