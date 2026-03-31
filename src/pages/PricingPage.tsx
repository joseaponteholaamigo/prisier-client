import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Plot from '../lib/plotly'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, ArrowRight } from 'lucide-react'
import api from '../lib/api'
import type { PortfolioRow, ValueMapData } from '../lib/types'

type Tab = 'portfolio' | 'valuemap'

export default function PricingPage() {
  const [tab, setTab] = useState<Tab>('portfolio')
  const [marca, setMarca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null)

  const { data: filterOptions } = useQuery({
    queryKey: ['pricing-filters'],
    queryFn: () => api.get<{ marcas: string[]; categorias: string[] }>('/pricing/filters').then(r => r.data),
  })

  const filters = `marca=${marca}&categoria=${categoria}`

  const handleSkuClick = (skuId: string) => {
    setSelectedSkuId(skuId)
    setTab('valuemap')
  }

  return (
    <div>
      {/* Filters row */}
      <div className="flex items-center gap-4 mb-6">
        <select value={marca} onChange={(e) => setMarca(e.target.value)} className="glass-select">
          <option value="">Todas las marcas</option>
          {filterOptions?.marcas.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="glass-select">
          <option value="">Todas las categorías</option>
          {filterOptions?.categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-4 border-b border-p-border mb-6">
        {([['portfolio', 'Resumen del Portafolio'], ['valuemap', 'Mapa de Valor']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`sub-tab ${tab === key ? 'sub-tab-active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Placeholder banner */}
      <div className="flex items-center gap-3 bg-yellow-900/30 border border-yellow-600/40 rounded-lg px-4 py-3 mb-6">
        <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
        <p className="text-sm text-yellow-200">
          <span className="font-semibold">Modelo simplificado</span> — Los precios óptimos mostrados usan un modelo de referencia. Pendiente fórmula definitiva (R-002/R-003).
        </p>
      </div>

      {tab === 'portfolio' && <PortfolioTab filters={filters} onSkuClick={handleSkuClick} />}
      {tab === 'valuemap' && <ValueMapTab filters={filters} selectedSkuId={selectedSkuId} onSkuChange={setSelectedSkuId} />}
    </div>
  )
}

/* ──────────────────────────── Tab 1: Portfolio ──────────────────────────── */

function PortfolioTab({ filters, onSkuClick }: { filters: string; onSkuClick: (id: string) => void }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['pricing-portfolio', filters],
    queryFn: () => api.get<PortfolioRow[]>(`/pricing/portfolio?${filters}`).then(r => r.data),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-p-lime border-t-transparent" />
      </div>
    )
  }

  const withComp = rows.filter(r => r.tieneCompetidores)
  const subir = withComp.filter(r => r.recomendacion === 'Subir').length
  const bajar = withComp.filter(r => r.recomendacion === 'Bajar').length
  const mantener = withComp.filter(r => r.recomendacion === 'Mantener').length

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-5">
        <KpiCard label="SKUs Analizados" value={String(withComp.length)} icon={TrendingUp} color="text-p-blue" sub={`${rows.length} totales`} />
        <KpiCard label="Subir Precio" value={String(subir)} icon={TrendingUp} color="text-p-lime" sub="Oportunidad de mejora" />
        <KpiCard label="Bajar Precio" value={String(bajar)} icon={TrendingDown} color="text-p-red" sub="Precio por encima del óptimo" />
        <KpiCard label="Mantener" value={String(mantener)} icon={Minus} color="text-p-muted" sub="Precio alineado" />
      </div>

      {/* Subtitle */}
      <p className="text-sm text-p-muted">Haz clic en una fila para ver el Mapa de Valor del producto</p>

      {/* Table */}
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
            {rows.map(row => (
              <tr
                key={row.skuId}
                onClick={() => row.tieneCompetidores && onSkuClick(row.skuId)}
                className={`border-b border-p-border/50 ${row.tieneCompetidores ? 'hover:bg-white/5 cursor-pointer' : 'opacity-50'}`}
              >
                <td className="py-3 px-4">
                  <div className="text-white">{row.nombre}</div>
                  <div className="text-xs text-p-muted">{row.codigoSku} · {row.categoria}</div>
                </td>
                <td className="py-3 px-4 text-p-muted">{row.marca}</td>
                <td className="py-3 px-4 text-right text-white">${row.precioActual.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</td>
                <td className="py-3 px-4 text-right text-white font-medium">
                  {row.tieneCompetidores ? `$${row.precioOptimo.toLocaleString('es-CO', { maximumFractionDigits: 0 })}` : '—'}
                </td>
                <td className="py-3 px-4 text-right">
                  {row.tieneCompetidores ? (
                    <span className={`${row.variacionPct > 0 ? 'text-p-lime' : row.variacionPct < 0 ? 'text-p-red' : 'text-p-muted'}`}>
                      {row.variacionPct > 0 ? '+' : ''}{row.variacionPct}%
                    </span>
                  ) : '—'}
                </td>
                <td className="py-3 px-4 text-center">
                  <RecomendacionBadge rec={row.recomendacion} variacion={row.variacionPct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="text-center py-12 text-p-muted">No hay SKUs para mostrar</div>
        )}
      </div>
    </div>
  )
}

/* ──────────────────────────── Tab 2: Value Map ──────────────────────────── */

function ValueMapTab({ filters, selectedSkuId, onSkuChange }: {
  filters: string
  selectedSkuId: string | null
  onSkuChange: (id: string) => void
}) {
  const navigate = useNavigate()

  // Get portfolio list for the dropdown
  const { data: portfolio = [] } = useQuery({
    queryKey: ['pricing-portfolio', filters],
    queryFn: () => api.get<PortfolioRow[]>(`/pricing/portfolio?${filters}`).then(r => r.data),
  })

  const skusWithComp = portfolio.filter(r => r.tieneCompetidores)
  const currentSkuId = selectedSkuId ?? skusWithComp[0]?.skuId ?? null

  const { data: mapData, isLoading } = useQuery({
    queryKey: ['pricing-valuemap', currentSkuId],
    queryFn: () => api.get<ValueMapData>(`/pricing/valuemap/${currentSkuId}`).then(r => r.data),
    enabled: !!currentSkuId,
  })

  if (!currentSkuId) {
    return (
      <div className="glass-panel p-12 text-center">
        <p className="text-p-muted text-lg">No hay SKUs con competidores configurados</p>
        <p className="text-p-muted text-sm mt-2">Se necesitan al menos 2 competidores para generar el Mapa de Valor</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* SKU Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-p-muted">Producto:</label>
        <select
          value={currentSkuId}
          onChange={(e) => onSkuChange(e.target.value)}
          className="glass-select flex-1 max-w-md"
        >
          {skusWithComp.map(s => (
            <option key={s.skuId} value={s.skuId}>{s.nombre} ({s.codigoSku})</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-p-lime border-t-transparent" />
        </div>
      ) : mapData ? (
        <>
          {/* Scatter Plot */}
          <div className="glass-panel p-6">
            <h3 className="text-base font-semibold text-white mb-4">Mapa de Valor — {mapData.producto.nombre}</h3>

            {mapData.competidores.length < 2 && (
              <div className="flex items-center gap-2 bg-yellow-900/30 border border-yellow-600/40 rounded px-3 py-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-yellow-200">Solo {mapData.competidores.length} competidor(es) — se recomienda mínimo 2 para mayor precisión</span>
              </div>
            )}

            <Plot
              data={[
                // Línea de valor justo (regresión)
                {
                  x: [mapData.lineaValorJusto.xMin, mapData.lineaValorJusto.xMax],
                  y: [
                    mapData.lineaValorJusto.slope * mapData.lineaValorJusto.xMin + mapData.lineaValorJusto.intercept,
                    mapData.lineaValorJusto.slope * mapData.lineaValorJusto.xMax + mapData.lineaValorJusto.intercept,
                  ],
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Línea de Valor Justo',
                  line: { color: 'rgba(255,255,255,0.2)', width: 2, dash: 'dash' },
                  hoverinfo: 'skip',
                },
                // Competidores (grises)
                {
                  x: mapData.competidores.map(c => c.valorPercibido),
                  y: mapData.competidores.map(c => c.precio),
                  text: mapData.competidores.map(c => c.nombre),
                  type: 'scatter',
                  mode: 'markers+text',
                  name: 'Competidores',
                  marker: { color: '#8e919e', size: 10, symbol: 'circle' },
                  textposition: 'top center',
                  textfont: { color: '#8e919e', size: 10 },
                  hovertemplate: '<b>%{text}</b><br>Precio: $%{y:,.0f}<extra>Competidor</extra>',
                },
                // Mi Producto (rojo)
                {
                  x: [mapData.producto.valorPercibido],
                  y: [mapData.producto.precio],
                  type: 'scatter',
                  mode: 'markers',
                  name: 'Mi Producto',
                  marker: { color: '#FF5757', size: 16, symbol: 'circle', line: { color: '#FF5757', width: 2 } },
                  hovertemplate: `<b>${mapData.producto.nombre}</b><br>Precio actual: $%{y:,.0f}<extra>Mi Producto</extra>`,
                },
                // Precio Óptimo (verde)
                {
                  x: [mapData.precioOptimoPunto.valorPercibido],
                  y: [mapData.precioOptimoPunto.precio],
                  type: 'scatter',
                  mode: 'markers',
                  name: 'Precio Óptimo',
                  marker: { color: '#AEC911', size: 16, symbol: 'star', line: { color: '#AEC911', width: 2 } },
                  hovertemplate: `<b>Precio Óptimo</b><br>$%{y:,.0f}<extra>Recomendado</extra>`,
                },
              ]}
              layout={{
                height: 420,
                margin: { t: 30, b: 60, l: 80, r: 30 },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                xaxis: {
                  title: { text: 'Índice de Valor', font: { color: '#8e919e', size: 12 } },
                  color: '#8e919e',
                  gridcolor: 'rgba(255,255,255,0.05)',
                  zeroline: false,
                },
                yaxis: {
                  title: { text: 'Precio ($)', font: { color: '#8e919e', size: 12 } },
                  color: '#8e919e',
                  gridcolor: 'rgba(255,255,255,0.05)',
                  tickprefix: '$',
                  zeroline: false,
                },
                legend: {
                  font: { color: '#D5D5D7' },
                  bgcolor: 'transparent',
                  orientation: 'h',
                  y: -0.15,
                },
                showlegend: true,
              }}
              config={{ responsive: true, displayModeBar: false }}
              className="w-full"
            />
          </div>

          {/* Result Banner */}
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-p-muted text-sm mb-1">Precio Óptimo Recomendado</p>
                <p className="text-3xl font-bold text-white">
                  ${mapData.precioOptimoValor.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <RecomendacionBadge rec={mapData.recomendacion} variacion={mapData.variacionPct} />
                  <span className={`text-sm ${mapData.variacionPct >= 0 ? 'text-p-lime' : 'text-p-red'}`}>
                    {mapData.variacionPct > 0 ? '+' : ''}{mapData.variacionPct}% respecto al precio actual
                  </span>
                </div>
              </div>
              <button
                onClick={() => navigate('/elasticidad')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-p-blue/20 text-p-blue hover:bg-p-blue/30 transition-colors text-sm"
              >
                Ver Simulador de Elasticidad <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Competitors Table */}
          {mapData.competidores.length > 0 && (
            <div className="glass-panel overflow-x-auto">
              <div className="px-4 py-3 border-b border-p-border">
                <h3 className="text-sm font-semibold text-white">Competidores en el Mapa</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-p-border text-p-muted text-xs uppercase tracking-wider">
                    <th className="text-left py-3 px-4">Competidor</th>
                    <th className="text-right py-3 px-4">Precio</th>
                    <th className="text-right py-3 px-4">Índice de Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {mapData.competidores.map((comp, i) => (
                    <tr key={i} className="border-b border-p-border/50">
                      <td className="py-3 px-4 text-white">{comp.nombre}</td>
                      <td className="py-3 px-4 text-right text-white">${comp.precio.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</td>
                      <td className="py-3 px-4 text-right text-p-muted">{comp.valorPercibido.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="glass-panel p-12 text-center">
          <p className="text-p-muted">No se pudo generar el Mapa de Valor para este producto</p>
          <p className="text-p-muted text-sm mt-2">Se necesitan competidores con precios configurados</p>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────── Shared Components ──────────────────────────── */

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

function RecomendacionBadge({ rec, variacion }: { rec: string; variacion: number }) {
  if (rec === 'Subir') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-900/40 text-green-300 border border-green-700/40">
        <TrendingUp className="w-3 h-3" /> Subir {variacion > 0 ? `+${variacion}%` : ''}
      </span>
    )
  }
  if (rec === 'Bajar') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-900/40 text-red-300 border border-red-700/40">
        <TrendingDown className="w-3 h-3" /> Bajar {variacion}%
      </span>
    )
  }
  if (rec === 'Mantener') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-800/40 text-gray-400 border border-gray-700/40">
        <Minus className="w-3 h-3" /> Mantener
      </span>
    )
  }
  return <span className="text-xs text-p-muted">{rec}</span>
}
