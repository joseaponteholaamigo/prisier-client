import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, X } from 'lucide-react'
import api from '../lib/api'
import type { PortfolioRow } from '../lib/types'
import SearchInput from '../components/SearchInput'
import { useTableSearch } from '../components/useTableSearch'
import Drawer from '../components/Drawer'
import { SkeletonTable } from '../components/Skeleton'
import QueryErrorState from '../components/QueryErrorState'
import ValueMapPanel, { RecomendacionBadge } from '../components/ValueMapPanel'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024)
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 1024)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return isMobile
}

export default function PricingPage() {
  const [marca, setMarca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null)
  const isMobile = useIsMobile()

  const { data: filterOptions } = useQuery({
    queryKey: ['pricing-filters'],
    queryFn: () => api.get<{ marcas: string[]; categorias: string[] }>('/pricing/filters').then(r => r.data),
  })

  const filters = `marca=${marca}&categoria=${categoria}`

  useEffect(() => { setSelectedSkuId(null) }, [marca, categoria])

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="glass-select">
          <option value="">Todas las categorías</option>
          {filterOptions?.categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={marca} onChange={(e) => setMarca(e.target.value)} className="glass-select">
          <option value="">Todas las marcas</option>
          {filterOptions?.marcas.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-3 bg-yellow-900/30 border border-yellow-600/40 rounded-lg px-4 py-3 mb-6">
        <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
        <p className="text-sm text-yellow-200">
          <span className="font-semibold">Estimación de referencia</span> — Los precios mostrados son un punto de partida calculado con los datos disponibles. Valida los ajustes con tu equipo antes de aplicarlos.
        </p>
      </div>

      <div className="flex gap-6 items-start">
        <div className={`min-w-0 transition-all duration-200 ${selectedSkuId && !isMobile ? 'w-3/5' : 'w-full'}`}>
          <PortfolioTab filters={filters} selectedSkuId={selectedSkuId} onSkuClick={setSelectedSkuId} />
        </div>
        {selectedSkuId && !isMobile && (
          <div className="w-2/5 min-w-0 sticky top-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-white">Mapa de Valor</span>
              <button onClick={() => setSelectedSkuId(null)} className="text-p-muted hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <ValueMapPanel skuId={selectedSkuId} />
          </div>
        )}
      </div>

      <Drawer
        isOpen={!!selectedSkuId && isMobile}
        title="Mapa de Valor"
        onClose={() => setSelectedSkuId(null)}
      >
        {selectedSkuId && isMobile && <ValueMapPanel skuId={selectedSkuId} />}
      </Drawer>
    </div>
  )
}

function PortfolioTab({ filters, selectedSkuId, onSkuClick }: { filters: string; selectedSkuId: string | null; onSkuClick: (id: string | null) => void }) {
  const [filterRec, setFilterRec] = useState<string | null>(null)
  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['pricing-portfolio', filters],
    queryFn: () => api.get<PortfolioRow[]>(`/pricing/portfolio?${filters}`).then(r => r.data),
  })

  const [searchedRows, searchTerm, setSearchTerm] = useTableSearch(rows, ['nombre', 'codigoSku', 'marca', 'categoria'])

  if (isLoading) {
    return (
      <div className="glass-panel overflow-x-auto">
        <table className="data-table">
          <tbody><SkeletonTable rows={10} columns={6} /></tbody>
        </table>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="glass-panel">
        <QueryErrorState onRetry={refetch} message="No se pudo cargar el portafolio de precios." />
      </div>
    )
  }

  const withComp = rows.filter(r => r.tieneCompetidores)
  const subir = withComp.filter(r => r.recomendacion === 'Subir').length
  const bajar = withComp.filter(r => r.recomendacion === 'Bajar').length
  const mantener = withComp.filter(r => r.recomendacion === 'Mantener').length

  const filteredRows = filterRec
    ? searchedRows.filter(r => {
        if (filterRec === 'sin-datos') return !r.tieneCompetidores
        return r.recomendacion === filterRec
      })
    : searchedRows

  const chips = [
    { label: 'Todos', value: null },
    { label: '↑ Aumentar precio', value: 'Subir' },
    { label: '↓ Reducir precio', value: 'Bajar' },
    { label: '↔ Mantener precio', value: 'Mantener' },
    { label: 'Sin datos', value: 'sin-datos' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-5">
        <KpiCard label="SKUs Analizados" value={String(withComp.length)} icon={TrendingUp} color="text-p-blue" sub={`${rows.length} totales`} />
        <KpiCard label="Productos para subir precio" value={String(subir)} icon={TrendingUp} color="text-p-lime"
          sub={rows.length === 0 ? '— Configura el modelo para ver oportunidades' : subir === 0 ? 'Todos los precios están dentro del rango óptimo' : 'Oportunidad de mejora'} />
        <KpiCard label="Productos para reducir precio" value={String(bajar)} icon={TrendingDown} color="text-p-red"
          sub={rows.length === 0 ? '— Configura el modelo para ver ajustes necesarios' : bajar === 0 ? 'Ningún precio supera el óptimo actualmente' : 'Precio por encima del óptimo'} />
        <KpiCard label="Productos en precio correcto" value={String(mantener)} icon={Minus} color="text-p-muted"
          sub={rows.length === 0 ? '— Configura el modelo para confirmar' : 'Precio alineado'} />
      </div>

      <p className="text-sm text-p-muted">Selecciona un producto para ver su posición en el mercado</p>

      <div className="flex items-center gap-4 flex-wrap">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar producto, marca o SKU..." />
        <div className="flex items-center gap-2 flex-wrap">
          {chips.map(chip => (
            <button
              key={String(chip.value)}
              onClick={() => setFilterRec(chip.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filterRec === chip.value
                  ? 'bg-p-lime/20 text-p-lime border-p-lime/40'
                  : 'border-p-border text-p-muted hover:text-white hover:border-p-muted'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-p-border text-p-muted text-xs uppercase tracking-wider">
              <th className="text-left py-3 px-4" style={{ width: '25%' }}>Producto</th>
              <th className="text-left py-3 px-4" style={{ width: '12%' }}>Marca</th>
              <th className="text-right py-3 px-4" style={{ width: '13%' }}>Precio Actual</th>
              <th className="text-right py-3 px-4" style={{ width: '13%' }}>Precio Óptimo</th>
              <th className="text-right py-3 px-4" style={{ width: '12%' }}>Variación</th>
              <th className="text-center py-3 px-4" style={{ width: '15%' }}>Recomendación</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(row => (
              <tr
                key={row.skuId}
                role={row.tieneCompetidores ? 'button' : undefined}
                tabIndex={row.tieneCompetidores ? 0 : undefined}
                aria-pressed={row.tieneCompetidores ? selectedSkuId === row.skuId : undefined}
                aria-label={row.tieneCompetidores ? `Ver Mapa de Valor de ${row.nombre}` : undefined}
                onClick={() => {
                  if (!row.tieneCompetidores) return
                  onSkuClick(selectedSkuId === row.skuId ? null : row.skuId)
                }}
                onKeyDown={(e) => {
                  if (!row.tieneCompetidores) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSkuClick(selectedSkuId === row.skuId ? null : row.skuId)
                  }
                }}
                className={`border-b border-p-border/50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-p-lime ${
                  row.tieneCompetidores
                    ? selectedSkuId === row.skuId
                      ? 'bg-p-lime/10 border-l-2 border-l-p-lime cursor-pointer'
                      : 'hover:bg-white/5 cursor-pointer'
                    : 'opacity-50'
                }`}
              >
                <td className="py-3 px-4">
                  <div className="text-white">{row.nombre}</div>
                  <div className="text-xs text-p-muted">{row.codigoSku} · {row.categoria}</div>
                </td>
                <td className="py-3 px-4 text-p-muted">{row.marca}</td>
                <td className="py-3 px-4 text-right text-white">${row.precioActual.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</td>
                <td className="py-3 px-4 text-right text-white font-medium">
                  {!row.tieneCompetidores ? '—'
                    : !row.precioOptimoValido ? (
                      <span className="text-p-muted inline-flex items-center gap-1" title="Pendiente negativa: revisar configuración del SKU">
                        <AlertTriangle className="w-3 h-3 text-yellow-400" /> —
                      </span>
                    )
                    : `$${row.precioOptimo.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`}
                </td>
                <td className="py-3 px-4 text-right">
                  {row.tieneCompetidores && row.precioOptimoValido ? (
                    <span className={`${row.variacionPct > 0 ? 'text-p-lime' : row.variacionPct < 0 ? 'text-p-red' : 'text-p-muted'}`}>
                      {row.variacionPct > 0 ? '+' : ''}{row.variacionPct}%
                    </span>
                  ) : '—'}
                </td>
                <td className="py-3 px-4 text-center">
                  {row.tieneCompetidores && !row.precioOptimoValido
                    ? <span className="text-xs text-yellow-400">Revisar configuración</span>
                    : <RecomendacionBadge rec={row.recomendacion} variacion={row.variacionPct} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 && (
          <div className="text-center py-12 text-p-muted">
            {searchTerm || filterRec
              ? `Sin resultados para "${searchTerm || filterRec}"`
              : 'No hay SKUs para mostrar'}
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string; icon: React.ElementType; color: string; sub?: string
}) {
  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-p-muted uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-p-muted mt-1">{sub}</div>}
    </div>
  )
}
