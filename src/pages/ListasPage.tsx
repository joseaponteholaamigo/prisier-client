import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, FileText, Download } from 'lucide-react'
import api from '../lib/api'
import type { ListaSkuRow } from '../lib/types'

const IVA = 1.19
const MARGEN_MAYORISTA = 0.80
const MARGEN_RETAIL = 0.65
const MARGEN_TAT = 0.85
const PAGE_SIZE = 50

export default function ListasPage() {
  const [marca, setMarca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [page, setPage] = useState(1)
  const [edits, setEdits] = useState<Map<string, number>>(new Map())
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)

  const filters = `marca=${marca}&categoria=${categoria}&page=${page}&pageSize=${PAGE_SIZE}`

  const { data: filterOptions } = useQuery({
    queryKey: ['listas-filters'],
    queryFn: () => api.get<{ marcas: string[]; categorias: string[] }>('/listas/filters').then(r => r.data),
  })

  const { data: skus = [], isLoading, dataUpdatedAt } = useQuery({
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

  const buildExportItems = () => {
    return [...edits.entries()].map(([skuId, pvp]) => ({ skuId, pvpEditado: pvp }))
  }

  const handleExportExcel = async () => {
    setExportingExcel(true)
    try {
      const res = await api.post('/listas/export/excel', { items: buildExportItems() }, { responseType: 'blob' })
      downloadBlob(res.data, `lista-precios-${today()}.xlsx`)
    } finally {
      setExportingExcel(false)
    }
  }

  const handleExportCsv = async () => {
    setExportingCsv(true)
    try {
      const res = await api.post('/listas/export/csv', { items: buildExportItems() }, { responseType: 'blob' })
      downloadBlob(res.data, `lista-precios-${today()}.csv`)
    } finally {
      setExportingCsv(false)
    }
  }

  return (
    <div>
      {/* Filters + Export row */}
      <div className="flex items-center gap-4 mb-6">
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
            <span className="badge badge-yellow text-xs">{editCount} modificado{editCount > 1 ? 's' : ''}</span>
          )}
          <button
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="flex items-center gap-2 px-4 py-2 bg-p-lime/20 text-p-lime rounded-lg hover:bg-p-lime/30 transition-colors disabled:opacity-50"
          >
            {exportingExcel ? <Spinner /> : <FileSpreadsheet size={16} />}
            Excel
          </button>
          <button
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="flex items-center gap-2 px-4 py-2 bg-p-blue/20 text-p-blue rounded-lg hover:bg-p-blue/30 transition-colors disabled:opacity-50"
          >
            {exportingCsv ? <Spinner /> : <FileText size={16} />}
            CSV
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-p-lime border-t-transparent" />
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
                  <th className="text-right" style={{ color: '#a3e635' }}>PVP Sugerido</th>
                  <th className="text-right">PVP sin IVA</th>
                  <th className="text-right">Mayorista</th>
                  <th className="text-right">Retail</th>
                  <th className="text-right">TAT</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {skus.map(row => {
                  const pvp = getPvp(row)
                  const sinIva = pvp / IVA
                  const mayorista = sinIva * MARGEN_MAYORISTA
                  const retail = sinIva * MARGEN_RETAIL
                  const tat = sinIva * MARGEN_TAT
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
                      <td className="text-right text-p-muted">{fmtPeso(mayorista)}</td>
                      <td className="text-right text-p-muted">{fmtPeso(retail)}</td>
                      <td className="text-right text-p-muted">{fmtPeso(tat)}</td>
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
                    <td colSpan={8} className="text-center text-p-muted py-8">
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
          <div className="flex items-center gap-6 mt-4 text-xs text-p-muted">
            <span>IVA: 19% · Mayorista: ×0.80 · Retail: ×0.65 · TAT: ×0.85</span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded border border-p-lime/40 inline-block" /> Editable
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-p-muted/20 inline-block" /> Calculado
            </span>
          </div>
        </>
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
