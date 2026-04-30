import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, FileText, AlertTriangle } from 'lucide-react'
import api from '../lib/api'
import type { ListaSkuRow } from '../lib/types'
import SearchInput from '../components/SearchInput'
import { useTableSearch } from '../components/useTableSearch'
import { SkeletonTable } from '../components/Skeleton'
import QueryErrorState from '../components/QueryErrorState'

const PAGE_SIZE = 50

interface CanalConfig {
  nombre: string
  margenes: Record<string, number>  // categoria → margen (0.0–1.0)
}
interface CanalesConfig {
  iva: number
  canales: CanalConfig[]
}

export default function ListasPage() {
  const [marca, setMarca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [page, setPage] = useState(1)
  const [edits, setEdits] = useState<Map<string, number>>(new Map())
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [exportModal, setExportModal] = useState<'excel' | 'csv' | null>(null)

  const filters = `marca=${marca}&categoria=${categoria}&page=${page}&pageSize=${PAGE_SIZE}`

  const { data: filterOptions } = useQuery({
    queryKey: ['listas-filters'],
    queryFn: () => api.get<{ marcas: string[]; categorias: string[] }>('/listas/filters').then(r => r.data),
  })

  const { data: canalesConfig } = useQuery<CanalesConfig>({
    queryKey: ['listas-canales'],
    queryFn: () => api.get<CanalesConfig>('/listas/canales').then(r => r.data),
    staleTime: 300_000,
  })

  const iva = canalesConfig?.iva ?? 0.19
  const canales = canalesConfig?.canales ?? []

  const { data: skus = [], isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['listas-skus', filters],
    queryFn: async () => {
      const r = await api.get<ListaSkuRow[]>(`/listas/skus?${filters}`)
      const total = parseInt(r.headers['x-total-count'] || '0')
      setTotalCount(total)
      return r.data
    },
  })

  const [totalCount, setTotalCount] = useState(0)
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  useEffect(() => { setPage(1) }, [marca, categoria])

  const getPvp = (row: ListaSkuRow) => edits.get(row.skuId) ?? row.pvpSugerido

  const handlePvpChange = (skuId: string, value: string) => {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0) return
    setEdits(prev => {
      const next = new Map(prev)
      next.set(skuId, num)
      return next
    })
  }

  const resetEdit = (skuId: string) => {
    setEdits(prev => {
      const next = new Map(prev)
      next.delete(skuId)
      return next
    })
  }

  const editCount = edits.size
  const [filteredSkus, skuSearch, setSkuSearch] = useTableSearch(skus, ['nombre', 'codigoSku'])

  const buildExportItems = () => {
    return [...edits.entries()].map(([skuId, pvp]) => ({ skuId, pvpEditado: pvp }))
  }

  const doExportExcel = async () => {
    setExportModal(null)
    setExportingExcel(true)
    try {
      const res = await api.post('/listas/export/excel', { items: buildExportItems() }, { responseType: 'blob' })
      downloadBlob(res.data, `lista-precios-${today()}.xlsx`)
    } finally {
      setExportingExcel(false)
    }
  }

  const doExportCsv = async () => {
    setExportModal(null)
    setExportingCsv(true)
    try {
      const res = await api.post('/listas/export/csv', { items: buildExportItems() }, { responseType: 'blob' })
      downloadBlob(res.data, `lista-precios-${today()}.csv`)
    } finally {
      setExportingCsv(false)
    }
  }

  const handleResetAll = () => {
    setEdits(new Map())
    setShowResetModal(false)
  }

  return (
    <div>
      {/* Search + Filters + Export row */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <SearchInput value={skuSearch} onChange={setSkuSearch} placeholder="Buscar producto o código..." />
        <select value={marca} onChange={(e) => setMarca(e.target.value)} className="glass-select">
          <option value="">Todas las marcas</option>
          {filterOptions?.marcas.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="glass-select">
          <option value="">Todas las categorías</option>
          {filterOptions?.categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-3">
          {editCount > 0 && (
            <>
              <span className="badge badge-yellow text-xs">{editCount} precio{editCount > 1 ? 's' : ''} modificado{editCount > 1 ? 's' : ''}</span>
              <button
                onClick={() => setShowResetModal(true)}
                className="text-xs text-p-muted hover:text-white transition-colors"
              >
                Restablecer todos
              </button>
            </>
          )}
          <button
            onClick={() => setExportModal('excel')}
            disabled={exportingExcel}
            className="flex items-center gap-2 px-4 py-2 bg-p-lime/20 text-p-lime rounded-lg hover:bg-p-lime/30 transition-colors disabled:opacity-50"
          >
            {exportingExcel ? <Spinner /> : <FileSpreadsheet size={16} />}
            Excel
          </button>
          <button
            onClick={() => setExportModal('csv')}
            disabled={exportingCsv}
            className="flex items-center gap-2 px-4 py-2 bg-p-blue/20 text-p-blue rounded-lg hover:bg-p-blue/30 transition-colors disabled:opacity-50"
          >
            {exportingCsv ? <Spinner /> : <FileText size={16} />}
            CSV
          </button>
        </div>
      </div>

      {/* Empty channels banner — solo cuando canalesConfig ya cargó y vino vacío */}
      {canalesConfig && canales.length === 0 && (
        <div className="flex items-center gap-3 bg-yellow-900/30 border border-yellow-600/40 rounded-lg px-4 py-3 mb-6">
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
          <p className="text-sm text-yellow-200">
            <span className="font-semibold">Canales no configurados</span> — Contacte a su consultor Prisier para configurar los canales y márgenes de su lista de precios.
          </p>
        </div>
      )}

      {/* Loading / Error */}
      {isLoading ? (
        <div className="glass-panel overflow-x-auto">
          <table className="data-table">
            <tbody>
              <SkeletonTable rows={8} columns={5} />
            </tbody>
          </table>
        </div>
      ) : isError ? (
        <div className="glass-panel">
          <QueryErrorState onRetry={refetch} message="No se pudo cargar la lista de precios." />
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="glass-panel overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th className="text-right" style={{ color: '#a3e635' }}>Precio sugerido</th>
                  <th className="text-right">Precio sin IVA</th>
                  {canales.map(c => {
                    const margenes = Object.values(c.margenes)
                    const uniforme = margenes.length > 0 && margenes.every(m => m === margenes[0])
                    const label = uniforme
                      ? `${c.nombre} (-${(margenes[0] * 100).toFixed(0)}%)`
                      : c.nombre
                    return <th key={c.nombre} className="text-right">{label}</th>
                  })}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {filteredSkus.map(row => {
                  const pvp = getPvp(row)
                  const sinIva = pvp / (1 + iva)
                  const isEdited = edits.has(row.skuId)

                  return (
                    <tr key={row.skuId}>
                      <td className="text-p-muted text-sm">{row.codigoSku}</td>
                      <td>
                        <div className="font-medium">{row.nombre}</div>
                        <div className="text-p-muted text-xs">{row.marca} · {row.categoria}</div>
                      </td>
                      <td className="text-right">
                        <input
                          type="number"
                          value={pvp}
                          onChange={(e) => handlePvpChange(row.skuId, e.target.value)}
                          className={`w-28 text-right px-2 py-1 rounded bg-p-bg border ${
                            isEdited ? 'border-p-lime text-p-lime' : 'border-p-lime/40 text-p-text'
                          } focus:outline-none focus:border-p-lime`}
                          min={0}
                          step={100}
                        />
                      </td>
                      <td className="text-right text-p-muted">{fmtPeso(sinIva)}</td>
                      {canales.map(c => (
                        <td key={c.nombre} className="text-right text-p-muted">
                          {fmtPeso(sinIva * (c.margenes[row.categoria] ?? 0))}
                        </td>
                      ))}
                      <td className="text-center">
                        {isEdited && (
                          <button
                            onClick={() => resetEdit(row.skuId)}
                            className="text-p-muted hover:text-p-text text-xs"
                            title="Restaurar valor original"
                          >
                            ↺
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {skus.length === 0 && (
                  <tr>
                    <td colSpan={4 + canales.length + 1} className="text-center text-p-muted py-8">
                      No hay SKUs disponibles
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-p-muted">
                {page} / {totalPages} — {totalCount} productos
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 rounded bg-p-bg-card border border-p-border text-sm disabled:opacity-40 hover:bg-p-bg-hover transition-colors"
                >
                  Anterior
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 rounded bg-p-bg-card border border-p-border text-sm disabled:opacity-40 hover:bg-p-bg-hover transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-6 mt-4 text-xs text-p-muted flex-wrap">
            <span>
              IVA: {((iva) * 100).toFixed(0)}%
              {canales.map(c => ` · ${c.nombre}`).join('')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded border border-p-lime/40 inline-block" /> Editable
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-p-muted/20 inline-block" /> Calculado
            </span>
          </div>
        </>
      )}

      {/* Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="glass-panel p-6 w-full max-w-sm mx-4 space-y-4">
            <h3 className="text-base font-semibold text-white">¿Descartar todos los cambios?</h3>
            <p className="text-sm text-p-muted">Se volverán a los precios originales. Esta acción no se puede deshacer.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowResetModal(false)} className="px-4 py-2 text-sm border border-p-border rounded-lg text-p-muted hover:text-white transition-colors">Cancelar</button>
              <button onClick={handleResetAll} className="px-4 py-2 text-sm bg-p-red/20 text-p-red border border-p-red/30 rounded-lg hover:bg-p-red/30 transition-colors">Descartar cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {exportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="glass-panel p-6 w-full max-w-md mx-4 space-y-4">
            <h3 className="text-base font-semibold text-white">Exportar lista de precios</h3>
            {editCount > 0 ? (
              <>
                <p className="text-sm text-p-muted">Estos son los precios modificados que se incluirán en la exportación:</p>
                <div className="overflow-auto max-h-48 rounded-lg border border-p-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-p-border">
                        <th className="text-left py-2 px-3 text-p-muted">Producto</th>
                        <th className="text-right py-2 px-3 text-p-muted">Precio anterior</th>
                        <th className="text-right py-2 px-3 text-p-muted">Precio nuevo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skus.filter(s => edits.has(s.skuId)).map(s => (
                        <tr key={s.skuId} className="border-b border-p-border/50">
                          <td className="py-2 px-3 text-white">{s.nombre}</td>
                          <td className="py-2 px-3 text-right text-p-muted">{fmtPeso(s.pvpSugerido)}</td>
                          <td className="py-2 px-3 text-right text-p-lime">{fmtPeso(edits.get(s.skuId)!)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-sm text-p-muted">Se exportará la lista con los precios actuales sin modificaciones.</p>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setExportModal(null)} className="px-4 py-2 text-sm border border-p-border rounded-lg text-p-muted hover:text-white transition-colors">Cancelar</button>
              <button
                onClick={exportModal === 'excel' ? doExportExcel : doExportCsv}
                className="btn-primary px-4 py-2 text-sm"
              >
                Confirmar y descargar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────

function fmtPeso(n: number): string {
  return `$${Math.round(n).toLocaleString('es-CO')}`
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function downloadBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function Spinner() {
  return <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
}
