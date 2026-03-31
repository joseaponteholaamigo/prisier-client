import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Plot from '../lib/plotly'
import { TrendingUp, TrendingDown, Users, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import api from '../lib/api'
import type { CompetitionKpis, BrandComparison, CompetitionDetailRow, ScatterPoint, BoxPlotSeries } from '../lib/types'

type Tab = 'dashboard' | 'detalle' | 'por-marca'

export default function CompetenciaPage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [marca, setMarca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [retailer, setRetailer] = useState('')

  const { data: filterOptions } = useQuery({
    queryKey: ['competition-filters'],
    queryFn: () => api.get<{ marcas: string[]; categorias: string[]; retailers: string[] }>('/competition/filters').then(r => r.data),
  })

  const filters = `marca=${marca}&categoria=${categoria}&retailer=${retailer}`

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
        <select value={retailer} onChange={(e) => setRetailer(e.target.value)} className="glass-select">
          <option value="">Todos los retailers</option>
          {filterOptions?.retailers.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-4 border-b border-p-border mb-6">
        {([['dashboard', 'Dashboard'], ['detalle', 'Detalle por SKU'], ['por-marca', 'Comparación por Marca']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`sub-tab ${tab === key ? 'sub-tab-active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab filters={filters} />}
      {tab === 'detalle' && <DetalleTab filters={filters} />}
      {tab === 'por-marca' && <PorMarcaTab filters={filters} />}
    </div>
  )
}

function DashboardTab({ filters }: { filters: string }) {
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['competition-dashboard', filters],
    queryFn: () => api.get<CompetitionKpis>(`/competition/dashboard?${filters}`).then(r => r.data),
  })

  const { data: scatterData = [] } = useQuery({
    queryKey: ['competition-scatter', filters],
    queryFn: () => api.get<ScatterPoint[]>(`/competition/scatter?${filters}`).then(r => r.data),
  })

  const { data: boxData = [] } = useQuery({
    queryKey: ['competition-boxplot', filters],
    queryFn: () => api.get<BoxPlotSeries[]>(`/competition/boxplot?${filters}`).then(r => r.data),
  })

  if (kpisLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-p-lime border-t-transparent" />
      </div>
    )
  }

  const diff = kpis?.diferencialPromedio ?? 0

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-5">
        <KpiCard
          label="Diferencial Promedio"
          value={`${diff >= 0 ? '+' : ''}${diff}%`}
          icon={diff >= 0 ? TrendingUp : TrendingDown}
          color={diff > 0 ? 'text-p-red' : 'text-p-lime'}
          sub={diff > 0 ? 'Más caros que la competencia' : diff < 0 ? 'Más baratos que la competencia' : 'Alineados con la competencia'}
          subColor={diff > 0 ? 'text-p-red' : 'text-p-lime'}
        />
        <KpiCard
          label="SKUs Comparados"
          value={String(kpis?.totalSkusComparados ?? 0)}
          icon={Users}
          color="text-p-blue"
          sub={`${kpis?.totalCompetidores ?? 0} competidores`}
          subColor="text-p-muted"
        />
        <KpiCard
          label="SKU Más Caro vs Competencia"
          value={kpis?.skuMasCaro?.nombre ?? '—'}
          icon={ArrowUpRight}
          color="text-p-red"
          sub={kpis?.skuMasCaro ? `+${kpis.skuMasCaro.diferencialPct}% vs competidor` : undefined}
          subColor="text-p-red"
        />
        <KpiCard
          label="SKU Más Barato vs Competencia"
          value={kpis?.skuMasBarato?.nombre ?? '—'}
          icon={ArrowDownRight}
          color="text-p-lime"
          sub={kpis?.skuMasBarato ? `${kpis.skuMasBarato.diferencialPct}% vs competidor` : undefined}
          subColor="text-p-lime"
        />
      </div>

      {/* Scatter Plot — Top N by highest differential */}
      {scatterData.length > 0 && (() => {
        const SCATTER_TOP = 20

        // Group by client SKU name, calculate avg differential
        const bySkuCliente = new Map<string, { client: number[]; comp: number[] }>()
        for (const p of scatterData) {
          const key = p.skuClienteNombre
          if (!bySkuCliente.has(key)) bySkuCliente.set(key, { client: [], comp: [] })
          const entry = bySkuCliente.get(key)!
          if (p.tipo === 'cliente') entry.client.push(p.precio)
          else entry.comp.push(p.precio)
        }

        const diffs = [...bySkuCliente.entries()]
          .filter(([, v]) => v.client.length > 0 && v.comp.length > 0)
          .map(([name, v]) => {
            const avgClient = v.client.reduce((a, b) => a + b, 0) / v.client.length
            const avgComp = v.comp.reduce((a, b) => a + b, 0) / v.comp.length
            return { name, absDiff: Math.abs(avgClient - avgComp) }
          })
          .sort((a, b) => b.absDiff - a.absDiff)

        const topSkuNames = new Set(diffs.slice(0, SCATTER_TOP).map(d => d.name))
        const filtered = scatterData.filter(p => topSkuNames.has(p.skuClienteNombre))
        const clientPoints = filtered.filter(p => p.tipo === 'cliente')
        const compPoints = filtered.filter(p => p.tipo === 'competidor')
        const totalProducts = bySkuCliente.size

        const truncate = (s: string, max = 18) => s.length > max ? s.slice(0, max) + '...' : s

        return (
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Dispersión de Precios: Cliente vs Competidores</h3>
              {totalProducts > SCATTER_TOP && (
                <span className="text-xs text-p-muted">Top {SCATTER_TOP} de {totalProducts} productos con mayor diferencial</span>
              )}
            </div>
            <Plot
              data={[
                {
                  x: clientPoints.map(p => truncate(p.skuClienteNombre)),
                  y: clientPoints.map(p => p.precio),
                  customdata: clientPoints.map(p => [p.nombreProducto, p.retailer]),
                  type: 'scatter',
                  mode: 'markers',
                  name: 'Cliente',
                  marker: { color: '#60CAFF', size: 10, symbol: 'circle' },
                  hovertemplate: '<b>%{customdata[0]}</b><br>$%{y:,.0f} — %{customdata[1]}<extra>Cliente</extra>',
                },
                {
                  x: compPoints.map(p => truncate(p.skuClienteNombre)),
                  y: compPoints.map(p => p.precio),
                  customdata: compPoints.map(p => [p.nombreProducto, p.retailer]),
                  type: 'scatter',
                  mode: 'markers',
                  name: 'Competidores',
                  marker: { color: '#FF5757', size: 10, symbol: 'diamond' },
                  hovertemplate: '<b>%{customdata[0]}</b><br>$%{y:,.0f} — %{customdata[1]}<extra>Competidor</extra>',
                },
              ]}
              layout={{
                height: 320,
                margin: { t: 30, b: 100, l: 70, r: 20 },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                xaxis: {
                  color: '#8e919e',
                  gridcolor: 'rgba(255,255,255,0.05)',
                  tickangle: -45,
                  tickfont: { size: 11, color: '#D5D5D7' },
                },
                yaxis: {
                  color: '#8e919e',
                  gridcolor: 'rgba(255,255,255,0.05)',
                  title: { text: 'Precio ($)', font: { color: '#8e919e', size: 12 } },
                  tickprefix: '$',
                },
                legend: {
                  font: { color: '#D5D5D7' },
                  bgcolor: 'transparent',
                },
                showlegend: true,
              }}
              config={{ responsive: true, displayModeBar: false }}
              className="w-full"
            />
          </div>
        )
      })()}

      {/* Box Plot */}
      {boxData.length > 0 && (
        <div className="glass-panel p-6">
          <h3 className="text-base font-semibold text-white mb-4">Distribución de Precios por Retailer</h3>
          {(() => {
            const clientSeries = boxData.filter(b => b.nombre === 'Cliente')
            const compSeries = boxData.filter(b => b.nombre === 'Competidores')

            const traces: Plotly.Data[] = []

            if (clientSeries.length > 0) {
              traces.push({
                y: clientSeries.flatMap(s => s.precios),
                x: clientSeries.flatMap(s => s.precios.map(() => s.retailer)),
                type: 'box',
                name: 'Cliente',
                marker: { color: '#60CAFF' },
                boxpoints: false,
              })
            }
            if (compSeries.length > 0) {
              traces.push({
                y: compSeries.flatMap(s => s.precios),
                x: compSeries.flatMap(s => s.precios.map(() => s.retailer)),
                type: 'box',
                name: 'Competidores',
                marker: { color: '#FF5757' },
                boxpoints: false,
              })
            }

            return (
              <Plot
                data={traces}
                layout={{
                  height: 320,
                  margin: { t: 30, b: 60, l: 70, r: 20 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  boxmode: 'group',
                  xaxis: {
                    color: '#8e919e',
                    gridcolor: 'transparent',
                    tickfont: { size: 13, color: '#D5D5D7' },
                  },
                  yaxis: {
                    color: '#8e919e',
                    gridcolor: 'rgba(255,255,255,0.05)',
                    title: { text: 'Precio ($)', font: { color: '#8e919e', size: 12 } },
                    tickprefix: '$',
                  },
                  legend: {
                    font: { color: '#D5D5D7' },
                    bgcolor: 'transparent',
                  },
                  showlegend: true,
                }}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full"
              />
            )
          })()}
        </div>
      )}

      {scatterData.length === 0 && !kpisLoading && (
        <div className="glass-panel p-12 text-center text-p-muted">
          No hay datos de competencia para los filtros seleccionados
        </div>
      )}
    </div>
  )
}

function DetalleTab({ filters }: { filters: string }) {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['competition-detail', filters, page],
    queryFn: async () => {
      const res = await api.get<CompetitionDetailRow[]>(`/competition/detail?${filters}&page=${page}&pageSize=25`)
      return {
        rows: res.data,
        total: parseInt(res.headers['x-total-count'] || '0'),
      }
    },
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-p-lime border-t-transparent" />
      </div>
    )
  }

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 25)

  return (
    <div>
      <div className="glass-panel overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '9%' }}>SKU</th>
              <th style={{ width: '17%' }}>Producto</th>
              <th style={{ width: '10%' }}>Marca</th>
              <th style={{ width: '13%' }} className="text-right">Precio Cliente</th>
              <th style={{ width: '17%' }}>Competidor Principal</th>
              <th style={{ width: '14%' }} className="text-right">Precio Competidor</th>
              <th style={{ width: '10%' }} className="text-right">Diferencia ($)</th>
              <th style={{ width: '10%' }} className="text-right">Diferencia (%)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.skuId}>
                <td className="font-mono text-p-muted text-xs" title={r.codigoSku}>{r.codigoSku}</td>
                <td className="font-medium text-white" title={r.nombre}>{r.nombre}</td>
                <td className="text-p-gray-light" title={r.marca}>{r.marca}</td>
                <td className="text-right text-p-blue font-semibold">${r.precioPromedioCliente.toLocaleString()}</td>
                <td className="text-p-gray-light">{r.competidorPrincipal}</td>
                <td className="text-right text-white font-semibold">${r.precioCompetidor.toLocaleString()}</td>
                <td className="text-right">
                  <span className={r.diferencialAbsoluto > 0 ? 'text-p-red' : 'text-p-lime'}>
                    {r.diferencialAbsoluto > 0 ? '+' : ''}${r.diferencialAbsoluto.toLocaleString()}
                  </span>
                </td>
                <td className="text-right">
                  <DiferencialBadge value={r.diferencialPct} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-p-muted">
                  No hay competidores configurados para los productos filtrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-p-muted">{total} registros</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg border border-p-border text-sm text-p-gray-light
                         disabled:opacity-30 hover:bg-white/5 transition-colors"
            >
              Anterior
            </button>
            <span className="px-4 py-2 text-sm text-p-muted">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-lg border border-p-border text-sm text-p-gray-light
                         disabled:opacity-30 hover:bg-white/5 transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const BRAND_COMP_PAGE_SIZE = 10

function PorMarcaTab({ filters }: { filters: string }) {
  const [page, setPage] = useState(1)

  useEffect(() => { setPage(1) }, [filters])

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ['competition-brand', filters],
    queryFn: () => api.get<BrandComparison[]>(`/competition/brand?${filters}`).then(r => r.data),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-p-lime border-t-transparent" />
      </div>
    )
  }

  const totalPages = Math.ceil(brands.length / BRAND_COMP_PAGE_SIZE)
  const pagedBrands = brands.slice((page - 1) * BRAND_COMP_PAGE_SIZE, page * BRAND_COMP_PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Grouped bar chart — paginated */}
      {pagedBrands.length > 0 && (
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Precio Promedio: Cliente vs Competidor por Marca</h3>
            {brands.length > BRAND_COMP_PAGE_SIZE && (
              <span className="text-xs text-p-muted">{page} / {totalPages} — {brands.length} marcas</span>
            )}
          </div>
          <Plot
            data={[
              {
                x: pagedBrands.map(b => b.marca),
                y: pagedBrands.map(b => b.precioPromedioCliente),
                type: 'bar',
                name: 'Cliente',
                marker: { color: '#60CAFF' },
                text: pagedBrands.map(b => `$${b.precioPromedioCliente.toLocaleString()}`),
                textposition: 'outside' as const,
                textfont: { color: '#D5D5D7', size: 11 },
              },
              {
                x: pagedBrands.map(b => b.marca),
                y: pagedBrands.map(b => b.precioPromedioCompetidor),
                type: 'bar',
                name: 'Competidor Principal',
                marker: { color: 'rgba(142, 145, 158, 0.6)' },
                text: pagedBrands.map(b => `$${b.precioPromedioCompetidor.toLocaleString()}`),
                textposition: 'outside' as const,
                textfont: { color: '#D5D5D7', size: 11 },
              },
            ]}
            layout={{
              height: 300,
              margin: { t: 30, b: 60, l: 70, r: 20 },
              barmode: 'group',
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              xaxis: {
                color: '#8e919e',
                gridcolor: 'transparent',
                tickfont: { size: 13, color: '#D5D5D7' },
              },
              yaxis: {
                color: '#8e919e',
                gridcolor: 'rgba(255,255,255,0.05)',
                tickprefix: '$',
              },
              legend: {
                font: { color: '#D5D5D7' },
                bgcolor: 'transparent',
              },
              showlegend: true,
            }}
            config={{ responsive: true, displayModeBar: false }}
            className="w-full"
          />
        </div>
      )}

      {/* Brand table — synced with chart page */}
      <div className="glass-panel overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '20%' }}>Marca</th>
              <th style={{ width: '20%' }} className="text-right">Precio Prom. Cliente</th>
              <th style={{ width: '25%' }} className="text-right">Precio Prom. Competidor</th>
              <th style={{ width: '20%' }} className="text-right">Diferencial</th>
              <th style={{ width: '15%' }} className="text-right">SKUs</th>
            </tr>
          </thead>
          <tbody>
            {pagedBrands.map(b => (
              <tr key={b.marca}>
                <td className="font-medium text-white" title={b.marca}>{b.marca}</td>
                <td className="text-right text-p-blue font-semibold">${b.precioPromedioCliente.toLocaleString()}</td>
                <td className="text-right text-p-gray-light">${b.precioPromedioCompetidor.toLocaleString()}</td>
                <td className="text-right">
                  <DiferencialBadge value={b.diferencialPct} />
                </td>
                <td className="text-right text-p-gray-light">{b.skuCount}</td>
              </tr>
            ))}
            {pagedBrands.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-p-muted">
                  No hay datos de competencia para los filtros seleccionados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-p-muted">{brands.length} marcas</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg border border-p-border text-sm text-p-gray-light
                         disabled:opacity-30 hover:bg-white/5 transition-colors"
            >
              Anterior
            </button>
            <span className="px-4 py-2 text-sm text-p-muted">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-lg border border-p-border text-sm text-p-gray-light
                         disabled:opacity-30 hover:bg-white/5 transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, icon: Icon, color, sub, subColor }: {
  label: string; value: string; icon: React.ElementType; color: string
  sub?: string; subColor?: string
}) {
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm text-p-gray-light font-medium">{label}</h3>
        <Icon size={20} className={color} />
      </div>
      <p className={`text-[32px] font-bold leading-none ${color}`}>{value}</p>
      {sub && <p className={`text-[13px] mt-2 ${subColor || 'text-p-muted'}`}>{sub}</p>}
    </div>
  )
}

function DiferencialBadge({ value }: { value: number }) {
  const abs = Math.abs(value)
  const cls = abs > 10 ? 'badge badge-red'
    : abs > 5 ? 'badge badge-yellow'
    : 'badge badge-green'

  return <span className={cls}>{value > 0 ? '+' : ''}{value.toFixed(1)}%</span>
}
