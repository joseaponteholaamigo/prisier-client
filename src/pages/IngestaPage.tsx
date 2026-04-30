import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import {
  FileSpreadsheet, CheckCircle2, AlertCircle, Clock, UploadCloud, Download, Loader2,
} from 'lucide-react'
import api from '../lib/api'
import type { CargaHistorialRow } from '../lib/types'
import type { TipoPlantillaCliente } from '../lib/templateSpecs'
import { TEMPLATE_SPECS } from '../lib/templateSpecs'
import UploadPlantillaModal from '../components/UploadPlantillaModal'
import EmptyState from '../components/EmptyState'
import { SkeletonTable } from '../components/Skeleton'
import QueryErrorState from '../components/QueryErrorState'

// ─── Helper descarga de plantilla ─────────────────────────────────────────────

function downloadTemplate(tipo: TipoPlantillaCliente) {
  const spec = TEMPLATE_SPECS[tipo]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([spec.headers])
  XLSX.utils.book_append_sheet(wb, ws, spec.sheetName)
  XLSX.writeFile(wb, `plantilla-${tipo}.xlsx`)
}

// ─── Tiempo relativo ──────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins} minuto${mins !== 1 ? 's' : ''}`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs} hora${hrs !== 1 ? 's' : ''}`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `hace ${days} día${days !== 1 ? 's' : ''}`
  const weeks = Math.floor(days / 7)
  return `hace ${weeks} semana${weeks !== 1 ? 's' : ''}`
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function IngestaPage() {
  const [modalTipo, setModalTipo] = useState<TipoPlantillaCliente | null>(null)
  const queryClient = useQueryClient()

  const handleConfirmed = (_previewId: string) => {
    setModalTipo(null)
    queryClient.invalidateQueries({ queryKey: ['ingesta-historial'] })
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-white">Carga de Datos</h1>

      {/* Descargar plantillas */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-p-muted">Descargar plantilla:</span>
        {(['portafolio', 'competidores'] as TipoPlantillaCliente[]).map(tipo => (
          <button
            key={tipo}
            onClick={() => downloadTemplate(tipo)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs border border-p-border rounded-lg text-p-muted hover:text-white hover:border-p-muted transition-colors"
          >
            <Download size={13} aria-hidden />
            {TEMPLATE_SPECS[tipo].label}
          </button>
        ))}
      </div>

      {/* Zonas de carga */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <UploadZoneCard
          tipo="portafolio"
          description={TEMPLATE_SPECS.portafolio.headers.join(' · ')}
          onOpen={() => setModalTipo('portafolio')}
        />
        <UploadZoneCard
          tipo="competidores"
          description={TEMPLATE_SPECS.competidores.headers.join(' · ')}
          onOpen={() => setModalTipo('competidores')}
        />
      </div>

      {/* Historial */}
      <HistorialSection />

      {/* Modal */}
      {modalTipo && (
        <UploadPlantillaModal
          tipo={modalTipo}
          isOpen={true}
          onClose={() => setModalTipo(null)}
          onConfirmed={handleConfirmed}
        />
      )}
    </div>
  )
}

// ─── Tarjeta de zona de carga ─────────────────────────────────────────────────

function UploadZoneCard({ tipo, description, onOpen }: {
  tipo: TipoPlantillaCliente
  description: string
  onOpen: () => void
}) {
  const spec = TEMPLATE_SPECS[tipo]
  return (
    <div className="glass-panel p-6 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-p-lime" aria-hidden />
          {spec.label}
        </h3>
        <p className="text-xs text-p-muted mt-1 leading-relaxed">{description}</p>
      </div>
      <button
        onClick={onOpen}
        className="btn-primary w-full justify-center flex items-center gap-2 text-sm"
        aria-label={`Subir archivo de ${spec.label}`}
      >
        <UploadCloud size={16} aria-hidden />
        Subir archivo
      </button>
    </div>
  )
}

// ─── Historial ────────────────────────────────────────────────────────────────

function HistorialSection() {
  const { data: historial = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['ingesta-historial'],
    queryFn: () => api.get<CargaHistorialRow[]>('/ingesta/historial').then(r => r.data),
    refetchInterval: (query) => {
      // Polling mientras haya filas en estado 'procesando'
      const rows = query.state.data ?? []
      return rows.some(r => r.estado === 'procesando') ? 3000 : false
    },
  })

  return (
    <div className="glass-panel overflow-x-auto">
      <div className="px-4 py-3 border-b border-p-border">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-p-muted" aria-hidden />
          Historial de Cargas
        </h3>
      </div>

      {isLoading ? (
        <table className="w-full text-sm">
          <tbody><SkeletonTable rows={4} columns={5} /></tbody>
        </table>
      ) : isError ? (
        <QueryErrorState onRetry={refetch} message="No se pudo cargar el historial de cargas." />
      ) : historial.length === 0 ? (
        <EmptyState
          icon={UploadCloud}
          title="Todavía no has cargado archivos"
          description="Sube tu portafolio de productos para que los demás módulos empiecen a funcionar."
        />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-p-border text-p-muted text-xs uppercase tracking-wider">
              <th className="text-left py-3 px-4">Fecha</th>
              <th className="text-left py-3 px-4">Tipo</th>
              <th className="text-left py-3 px-4">Archivo</th>
              <th className="text-center py-3 px-4">Estado</th>
              <th className="text-right py-3 px-4">Nuevas</th>
              <th className="text-right py-3 px-4">Actualizadas</th>
              <th className="text-right py-3 px-4">Omitidas</th>
              <th className="text-left py-3 px-4">Subido por</th>
            </tr>
          </thead>
          <tbody>
            {historial.map(row => (
              <tr key={row.id} className="border-b border-p-border/50">
                <td className="py-3 px-4 text-p-muted" title={new Date(row.fechaCarga).toLocaleString('es-CO')}>
                  {timeAgo(row.fechaCarga)}
                </td>
                <td className="py-3 px-4 text-white capitalize">{row.tipoArchivo}</td>
                <td className="py-3 px-4 text-p-muted text-xs">{row.nombreArchivo}</td>
                <td className="py-3 px-4 text-center">
                  <EstadoBadge estado={row.estado} />
                </td>
                <td className="py-3 px-4 text-right text-p-lime">{row.filasNuevas}</td>
                <td className="py-3 px-4 text-right text-p-blue">{row.filasActualizadas}</td>
                <td className="py-3 px-4 text-right">
                  {row.totalErrores > 0
                    ? <span className="text-yellow-300">{row.totalErrores}</span>
                    : <span className="text-p-muted">0</span>}
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

// ─── Badge de estado ──────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: CargaHistorialRow['estado'] }) {
  if (estado === 'exitoso') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/40 text-green-300 border border-green-700/40">
        <CheckCircle2 className="w-3 h-3" aria-hidden /> Exitoso
      </span>
    )
  }
  if (estado === 'con_advertencias') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-900/40 text-yellow-300 border border-yellow-700/40">
        <AlertCircle className="w-3 h-3" aria-hidden /> Con advertencias
      </span>
    )
  }
  if (estado === 'fallido') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/40 text-red-300 border border-red-700/40">
        <AlertCircle className="w-3 h-3" aria-hidden /> Fallido
      </span>
    )
  }
  // procesando
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-p-blue/20 text-p-blue border border-p-blue/30">
      <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> Procesando
    </span>
  )
}
