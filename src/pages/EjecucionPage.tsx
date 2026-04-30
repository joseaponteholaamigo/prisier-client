import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Plot from '../lib/plotly'
import { TrendingUp, TrendingDown, AlertTriangle, Box, Store } from 'lucide-react'
import api from '../lib/api'
import { fmtCOP } from '../lib/format'
import SeverityBadge from '../components/SeverityBadge'
import SearchableSelect from '../components/SearchableSelect'
import Drawer from '../components/Drawer'
import SearchInput from '../components/SearchInput'
import { useTableSearch } from '../components/useTableSearch'
import type { DashboardKpis, BrandExecution, DetailRow, ProfitPoolItem, PivotResponse } from '../lib/types'
import { SkeletonKpiCards, SkeletonTable } from '../components/Skeleton'
import QueryErrorState from '../components/QueryErrorState'
import { CATEGORIAS } from '../shared/catalog'

// Tab type — profit-pool ocultado en la barra de navegación
type Tab = 'dashboard' | 'detalle' | 'profit-pool'

export default function EjecucionPage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [marca, setMarca] = useState('')
  const [retailer, setRetailer] = useState('')
  const [categoria, setCategoria] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const { data: filterOptions } = useQuery({
    queryKey: ['execution-filters'],
    queryFn: () => api.get<{ marcas: string[]; retailers: string[] }>('/execution/filters').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const filters = [
    marca      && `marca=${marca}`,
    retailer   && `retailer=${retailer}`,
    categoria  && `categoria=${categoria}`,
    fechaDesde && `fechaDesde=${fechaDesde}`,
    fechaHasta && `fechaHasta=${fechaHasta}`,
  ].filter(Boolean).join('&')

  const marcaOptions = (filterOptions?.marcas ?? []).map(m => ({ value: m, label: m }))
  const retailerOptions = (filterOptions?.retailers ?? []).map(r => ({ value: r, label: r }))

  return (
    <div>
      {/* Filters row */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <SearchableSelect
          options={marcaOptions}
          value={marca}
          onChange={setMarca}
          placeholder="Todas las marcas"
          clearLabel="Todas las marcas"
          aria-label="Filtrar por marca"
        />
        <SearchableSelect
          options={retailerOptions}
          value={retailer}
          onChange={setRetailer}
          placeholder="Todos los retailers"
          clearLabel="Todos los retailers"
          aria-label="Filtrar por retailer"
        />
        <SearchableSelect
          options={CATEGORIAS.map(c => ({ value: c.value, label: c.label }))}
          value={categoria}
          onChange={setCategoria}
          placeholder="Todas las categorías"
          clearLabel="Todas las categorías"
          aria-label="Filtrar por categoría"
        />
        <input
          type="date"
          value={fechaDesde}
          onChange={e => setFechaDesde(e.target.value)}
          className="glass-select w-36"
          title="Desde"
          aria-label="Fecha desde"
        />
        <input
          type="date"
          value={fechaHasta}
          onChange={e => setFechaHasta(e.target.value)}
          className="glass-select w-36"
          title="Hasta"
          aria-label="Fecha hasta"
        />
      </div>

      {/* Sub-tabs — profit-pool oculto (diferido) */}
      <div className="flex gap-4 border-b border-p-border mb-6">
        {([
          ['dashboard', 'Dashboard'],
          ['detalle', 'Detalle por producto'],
          // TODO: reactivar Priorizar por margen — diferido
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`sub-tab ${tab === key ? 'sub-tab-active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab key={filters} filters={filters} />}
      {tab === 'detalle' && <DetalleTab key={filters} filters={filters} />}
      {tab === 'profit-pool' && <ProfitPoolTab key={filters} filters={filters} />}
    </div>
  )
}

const BRAND_PAGE_SIZE = 10

function DashboardTab({ filters }: { filters: string }) {
  const [brandPage, setBrandPage] = useState(1)
  const [drawerMarca, setDrawerMarca] = useState<BrandExecution | null>(null)

  const { data: kpis, isLoading: kpisLoading, isError: kpisError, refetch: refetchKpis } = useQuery({
    queryKey: ['execution-dashboard', filters],
    queryFn: () => api.get<DashboardKpis>(`/execution/dashboard?${filters}`).then(r => r.data),
    staleTime: 2 * 60_000,
  })

  const { data: brandsRaw = [] } = useQuery({
    queryKey: ['execution-brand', filters],
    queryFn: () => api.get<BrandExecution[]>(`/execution/brand?${filters}`).then(r => r.data),
    staleTime: 2 * 60_000,
  })

  // Ordenar descendente: mayor índice de ejecución primero
  const brands = [...brandsRaw].sort((a, b) => b.desviacionPct - a.desviacionPct)

  if (kpisLoading) {
    return (
      <div className="space-y-6">
        <SkeletonKpiCards count={4} />
        <div className="glass-panel p-6 space-y-3" aria-hidden="true">
          <div className="animate-pulse bg-white/10 rounded-lg h-4 w-1/4" />
          <div className="animate-pulse bg-white/10 rounded-lg h-48 w-full" />
        </div>
      </div>
    )
  }

  if (kpisError) {
    return (
      <div className="glass-panel">
        <QueryErrorState onRetry={refetchKpis} message="No se pudo cargar el dashboard de ejecución." />
      </div>
    )
  }

  const desviacion = kpis?.desviacionPromedio ?? 100
  const indice = desviacion / 100
  const desviacionDiff = desviacion - 100

  return (
    <div className="space-y-6">
      {/* KPI Cards - 4 columns */}
      <div className="grid grid-cols-4 gap-5">
        <KpiCard
          label="Marca por Índice de ejecución de precios"
          value={indice.toFixed(1)}
          icon={desviacionDiff >= 0 ? TrendingUp : TrendingDown}
          color={Math.abs(desviacionDiff) <= 5 ? 'text-p-lime' : 'text-p-red'}
          sub={desviacionDiff === 0
            ? 'En línea con el precio sugerido'
            : `${desviacionDiff > 0 ? '+' : ''}${desviacionDiff.toFixed(1)}% ${desviacionDiff > 0 ? 'por encima del sugerido' : 'por debajo del sugerido'}`}
          subColor={Math.abs(desviacionDiff) <= 5 ? 'text-p-lime' : 'text-p-red'}
        />
        <KpiCard
          label="Total SKUs Monitoreados"
          value={String(kpis?.totalSkus ?? 0)}
          icon={Box}
          color="text-p-blue"
          sub="Cobertura del 100%"
          subColor="text-p-muted"
        />
        <KpiCard
          label="SKUs con Desviación Crítica"
          value={String(kpis?.skusCriticos ?? 0)}
          icon={AlertTriangle}
          color="text-p-red"
          sub="Revisar con los principales clientes"
          subColor="text-p-red"
          alert={!!kpis?.skusCriticos}
        />
        <KpiCard
          label="Retailer con Mayor Desviación"
          value={kpis?.retailerMayorDesviacion?.retailer ?? '—'}
          icon={Store}
          color="text-p-blue"
          sub={kpis?.retailerMayorDesviacion && !isNaN(kpis.retailerMayorDesviacion.desviacion)
            ? `${Math.abs(kpis.retailerMayorDesviacion.desviacion - 100).toFixed(0)}% de diferencia`
            : 'Sin datos disponibles'}
          subColor="text-p-red"
        />
      </div>

      {/* Brand Chart + Table (paginated together) */}
      {brands.length > 0 && (() => {
        const brandTotalPages = Math.ceil(brands.length / BRAND_PAGE_SIZE)
        const pagedBrands = brands.slice((brandPage - 1) * BRAND_PAGE_SIZE, brandPage * BRAND_PAGE_SIZE)

        return (
          <>
            <div className="glass-panel p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Marca por Índice de ejecución de precios</h3>
                {brands.length > BRAND_PAGE_SIZE && (
                  <span className="text-xs text-p-muted">{brandPage} / {brandTotalPages} — {brands.length} marcas</span>
                )}
              </div>
              <Plot
                data={[
                  {
                    x: pagedBrands.map(b => b.marca),
                    y: pagedBrands.map(b => b.desviacionPct / 100),
                    type: 'bar',
                    marker: {
                      color: pagedBrands.map(b => {
                        const dev = Math.abs(b.desviacionPct - 100)
                        return dev > 5 ? '#FF5757' : dev > 3 ? '#F4CD29' : '#AEC911'
                      }),
                      borderRadius: 4,
                    },
                    text: pagedBrands.map(b => (b.desviacionPct / 100).toFixed(1)),
                    textposition: 'outside' as const,
                    textfont: { color: '#D5D5D7', size: 12 },
                    hovertemplate: '%{x}<br>Índice de Ejecución: %{y:.1f}<extra></extra>',
                  },
                ]}
                layout={{
                  height: 280,
                  margin: { t: 30, b: 60, l: 50, r: 20 },
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
                    range: [0.80, 1.20],
                    tickformat: '.1f',
                  },
                  shapes: [{
                    type: 'line',
                    x0: -0.5,
                    x1: pagedBrands.length - 0.5,
                    y0: 1.0,
                    y1: 1.0,
                    line: { color: 'rgba(255,255,255,0.5)', width: 1, dash: 'dash' },
                  }],
                  annotations: [{
                    x: pagedBrands.length - 0.5,
                    y: 1.0,
                    text: 'Sugerido (1.0)',
                    showarrow: false,
                    font: { size: 11, color: 'rgba(255,255,255,0.6)' },
                    xanchor: 'right',
                    yanchor: 'bottom',
                  }],
                }}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full"
              />
              <div className="flex items-center gap-4 mt-2 text-xs text-p-muted">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#AEC911' }} />Dentro del rango</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#F4CD29' }} />Desviación moderada</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#FF5757' }} />Desviación crítica</span>
              </div>
            </div>

            {/* Tabla: Detalle de Ejecución por Marca y Retailer */}
            <div className="glass-panel overflow-hidden">
              <div className="px-6 py-4 border-b border-p-border flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">Detalle de Ejecución por Marca y Retailer</h3>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '20%' }}>Marca</th>
                    <th style={{ width: '20%' }} className="text-right">PVP Sugerido Prom.</th>
                    <th style={{ width: '25%' }} className="text-right">Precio Observado Prom.</th>
                    <th style={{ width: '20%' }} className="text-right">Desviación</th>
                    <th style={{ width: '15%' }} className="text-right">Productos</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedBrands.map(b => (
                    <tr key={b.marca} className="cursor-pointer" onClick={() => setDrawerMarca(b)}>
                      <td className="font-medium text-white" title={b.marca}>{b.marca}</td>
                      <td className="text-right text-p-gray-light">{fmtCOP(b.pvpSugeridoPromedio)}</td>
                      <td className="text-right text-p-gray-light">{fmtCOP(b.precioObservadoPromedio)}</td>
                      <td className="text-right">
                        <SeverityBadge value={b.desviacionPct - 100} />
                      </td>
                      <td className="text-right text-p-gray-light">{b.skuCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {brandTotalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-p-muted">{brands.length} marcas</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setBrandPage(p => Math.max(1, p - 1))}
                    disabled={brandPage === 1}
                    className="px-4 py-2 rounded-lg border border-p-border text-sm text-p-gray-light
                               disabled:opacity-30 hover:bg-white/5 transition-colors"
                  >
                    Anterior
                  </button>
                  <span className="px-4 py-2 text-sm text-p-muted">{brandPage} / {brandTotalPages}</span>
                  <button
                    onClick={() => setBrandPage(p => Math.min(brandTotalPages, p + 1))}
                    disabled={brandPage === brandTotalPages}
                    className="px-4 py-2 rounded-lg border border-p-border text-sm text-p-gray-light
                               disabled:opacity-30 hover:bg-white/5 transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )
      })()}

      <Drawer
        isOpen={!!drawerMarca}
        title={drawerMarca?.marca ?? ''}
        subtitle={drawerMarca ? `${drawerMarca.skuCount} productos · índice de ejecución: ${(drawerMarca.desviacionPct / 100).toFixed(1)}` : undefined}
        onClose={() => setDrawerMarca(null)}
      >
        {drawerMarca && <MarcaDrawerContent marca={drawerMarca} filters={filters} />}
      </Drawer>
    </div>
  )
}

function MarcaDrawerContent({ marca, filters }: { marca: BrandExecution; filters: string }) {
  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['execution-detail-marca', marca.marca, filters],
    queryFn: () => api.get<DetailRow[]>(`/execution/detail?${filters}&marca=${encodeURIComponent(marca.marca)}&pageSize=50`).then(r => r.data),
    staleTime: 2 * 60_000,
  })

  if (isLoading) {
    return (
      <table className="w-full text-sm" aria-hidden="true">
        <tbody><SkeletonTable rows={5} columns={5} /></tbody>
      </table>
    )
  }

  if (isError) {
    return <QueryErrorState onRetry={refetch} message="No se pudo cargar el detalle de la marca." />
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-p-border text-p-muted text-xs uppercase tracking-wider">
          <th className="text-left py-2 px-3">Producto</th>
          <th className="text-right py-2 px-3">Sugerido</th>
          <th className="text-right py-2 px-3">Observado</th>
          <th className="text-right py-2 px-3">Desviación</th>
          <th className="text-left py-2 px-3">Retailer</th>
          <th className="text-left py-2 px-3">Fecha</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={`${r.skuId}-${r.retailer}`} className="border-b border-p-border/50">
            <td className="py-2 px-3">
              <div className="text-white text-xs font-medium">{r.nombre}</div>
              <div className="text-p-muted text-xs">{r.codigoSku}</div>
            </td>
            <td className="py-2 px-3 text-right text-p-muted text-xs">{fmtCOP(r.pvpSugerido)}</td>
            <td className="py-2 px-3 text-right text-p-muted text-xs">{fmtCOP(r.precioObservado)}</td>
            <td className="py-2 px-3 text-right"><SeverityBadge value={r.desviacionPct - 100} /></td>
            <td className="py-2 px-3 text-p-muted text-xs">{r.retailer}</td>
            <td className="py-2 px-3 text-p-muted text-xs">{r.fechaScraping}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={6} className="text-center py-8 text-p-muted text-sm">Sin datos para esta marca</td></tr>
        )}
      </tbody>
    </table>
  )
}

type DetalleChip = 'todos' | 'con-desviacion' | 'criticos'

function DetalleTab({ filters }: { filters: string }) {
  const [page, setPage] = useState(1)
  const [chip, setChip] = useState<DetalleChip>('todos')

  const { data: pivotData, isLoading: pivotLoading, isError: pivotError, refetch: pivotRefetch } = useQuery({
    queryKey: ['execution-pivot', filters],
    queryFn: () => api.get<PivotResponse>(`/execution/pivot?${filters}`).then(r => r.data),
    staleTime: 2 * 60_000,
  })

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['execution-detail', filters, page],
    queryFn: async () => {
      const res = await api.get<DetailRow[]>(`/execution/detail?${filters}&page=${page}&pageSize=25`)
      return {
        rows: res.data,
        total: parseInt(res.headers['x-total-count'] || '0'),
      }
    },
    staleTime: 2 * 60_000,
  })

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 25)

  const [searchFiltered, search, setSearch] = useTableSearch(rows, ['nombre', 'codigoSku'])

  const chipFiltered = searchFiltered.filter(r => {
    const dev = Math.abs(r.desviacionPct - 100)
    if (chip === 'con-desviacion') return dev > 0
    if (chip === 'criticos') return dev > 5
    return true
  })

  const chipLabels: Record<DetalleChip, string> = {
    todos: 'Todos',
    'con-desviacion': 'Con desviación',
    'criticos': 'Críticos (>5%)',
  }

  if (isLoading || pivotLoading) {
    return (
      <div className="space-y-6">
        <div className="glass-panel overflow-x-auto">
          <table className="data-table">
            <tbody><SkeletonTable rows={10} columns={5} /></tbody>
          </table>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="glass-panel">
        <QueryErrorState onRetry={refetch} message="No se pudo cargar el detalle de ejecución." />
      </div>
    )
  }

  const retailers = pivotData?.retailers ?? []
  const pivotRows = pivotData?.rows ?? []

  return (
    <div className="space-y-6">
      {/* Tabla pivot: Detalle por producto */}
      <div className="glass-panel overflow-hidden">
        <div className="px-6 py-4 border-b border-p-border">
          <h3 className="text-base font-semibold text-white">Detalle por producto</h3>
        </div>
        {pivotError ? (
          <div className="p-6">
            <QueryErrorState onRetry={pivotRefetch} message="No se pudo cargar la tabla de detalle por producto." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table" style={{ minWidth: `${620 + retailers.length * 180}px` }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ width: 100 }}>SKU</th>
                  <th rowSpan={2} style={{ width: 200 }}>Producto</th>
                  <th rowSpan={2} style={{ width: 110 }}>Marca</th>
                  <th rowSpan={2} style={{ width: 110 }}>Categoría</th>
                  <th rowSpan={2} style={{ width: 110 }} className="text-right">PVP Sugerido</th>
                  {retailers.map(ret => (
                    <th key={ret} colSpan={2} className="text-center border-l border-p-border/30" style={{ width: 180 }}>
                      {ret}
                    </th>
                  ))}
                </tr>
                <tr>
                  {retailers.map(ret => (
                    <Fragment key={ret}>
                      <th className="text-right border-l border-p-border/30 text-p-muted font-normal text-xs py-1">
                        P. Obs.
                      </th>
                      <th className="text-right text-p-muted font-normal text-xs py-1">
                        Desv.
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pivotRows.map(row => (
                  <tr key={row.skuId}>
                    <td className="font-mono text-p-muted text-xs" title={row.codigoSku}>{row.codigoSku}</td>
                    <td className="font-medium text-white text-sm truncate max-w-[200px]" title={row.nombre}>{row.nombre}</td>
                    <td className="text-p-gray-light text-xs" title={row.marca}>{row.marca}</td>
                    <td className="text-p-gray-light text-xs" title={row.categoria}>{row.categoria}</td>
                    <td className="text-right text-p-lime font-semibold text-xs">{fmtCOP(row.pvpSugerido)}</td>
                    {retailers.map(ret => {
                      const cell = row.retailers[ret]
                      return (
                        <Fragment key={`${row.skuId}-${ret}`}>
                          <td className="text-right border-l border-p-border/30 text-p-gray-light text-xs">
                            {cell?.precioObservado != null ? fmtCOP(cell.precioObservado) : '—'}
                          </td>
                          <td className="text-right text-xs">
                            {cell?.desviacionPct != null
                              ? <SeverityBadge value={cell.desviacionPct} />
                              : <span className="text-p-muted">—</span>
                            }
                          </td>
                        </Fragment>
                      )
                    })}
                  </tr>
                ))}
                {pivotRows.length === 0 && (
                  <tr>
                    <td colSpan={5 + retailers.length * 2} className="text-center py-12 text-p-muted">
                      Aún no hay datos de precios para este periodo
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Búsqueda + chips para la tabla lineal */}
      <div className="flex items-center gap-3 flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar producto o código..." />
        {(Object.keys(chipLabels) as DetalleChip[]).map(c => (
          <button
            key={c}
            onClick={() => setChip(c)}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              chip === c
                ? 'bg-p-lime/20 text-p-lime border border-p-lime/40'
                : 'border border-p-border text-p-muted hover:text-white'
            }`}
          >
            {chipLabels[c]}
          </button>
        ))}
      </div>

      {/* Tabla lineal paginada */}
      <div className="glass-panel overflow-hidden">
        <div className="px-6 py-4 border-b border-p-border">
          <h3 className="text-base font-semibold text-white">Listado de precios observados</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '10%' }}>SKU</th>
              <th style={{ width: '20%' }}>Producto</th>
              <th style={{ width: '12%' }}>Marca</th>
              <th style={{ width: '13%' }} className="text-right">PVP Sugerido</th>
              <th style={{ width: '10%' }}>Retailer</th>
              <th style={{ width: '13%' }} className="text-right">Precio Obs.</th>
              <th style={{ width: '12%' }} className="text-right">Desviación</th>
              <th style={{ width: '10%' }}>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {chipFiltered.map((r, i) => (
              <tr key={`${r.skuId}-${r.retailer}-${i}`}>
                <td className="font-mono text-p-muted text-xs" title={r.codigoSku}>{r.codigoSku}</td>
                <td className="font-medium text-white" title={r.nombre}>{r.nombre}</td>
                <td className="text-p-gray-light" title={r.marca}>{r.marca}</td>
                <td className="text-right text-p-lime font-semibold">{fmtCOP(r.pvpSugerido)}</td>
                <td className="text-p-gray-light">{r.retailer}</td>
                <td className="text-right text-white font-semibold">{fmtCOP(r.precioObservado)}</td>
                <td className="text-right">
                  <SeverityBadge value={r.desviacionPct - 100} />
                </td>
                <td className="text-p-muted text-xs">{r.fechaScraping}</td>
              </tr>
            ))}
            {chipFiltered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-p-muted">
                  Aún no hay datos de precios para este periodo
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

const PROFIT_PAGE_SIZE = 25
const PROFIT_CHART_TOP = 15

function ProfitPoolTab({ filters }: { filters: string }) {
  const [page, setPage] = useState(1)

  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['execution-profit-pool', filters],
    queryFn: () => api.get<ProfitPoolItem[]>(`/execution/profit-pool?${filters}`).then(r => r.data),
    staleTime: 2 * 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="glass-panel p-6 space-y-3" aria-hidden="true">
          <div className="animate-pulse bg-white/10 rounded-lg h-4 w-1/3" />
          <div className="animate-pulse bg-white/10 rounded-lg h-48 w-full" />
        </div>
        <div className="glass-panel overflow-x-auto">
          <table className="data-table">
            <tbody><SkeletonTable rows={8} columns={5} /></tbody>
          </table>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="glass-panel">
        <QueryErrorState onRetry={refetch} message="No se pudo cargar el Profit Pool." />
      </div>
    )
  }

  const chartItems = items.slice(0, PROFIT_CHART_TOP)
  const totalPages = Math.ceil(items.length / PROFIT_PAGE_SIZE)
  const pagedItems = items.slice((page - 1) * PROFIT_PAGE_SIZE, page * PROFIT_PAGE_SIZE)

  return (
    <div className="space-y-6">
      {chartItems.length > 0 && (
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Priorización por Profit Pool</h3>
            {items.length > PROFIT_CHART_TOP && (
              <span className="text-xs text-p-muted">Top {PROFIT_CHART_TOP} de {items.length} SKUs</span>
            )}
          </div>
          <Plot
            data={[{
              x: chartItems.map(i => i.nombre),
              y: chartItems.map(i => i.pesoProfitPool),
              type: 'bar',
              marker: {
                color: chartItems.map(i =>
                  Math.abs(i.desviacionActual - 100) > 5 ? '#FF5757' : '#AEC911'
                ),
              },
              text: chartItems.map(i => `${i.pesoProfitPool}%`),
              textposition: 'outside' as const,
              textfont: { color: '#D5D5D7', size: 11 },
            }]}
            layout={{
              height: 280,
              margin: { t: 20, b: 100, l: 50, r: 20 },
              xaxis: {
                tickangle: -45,
                color: '#8e919e',
                gridcolor: 'transparent',
                tickfont: { size: 11, color: '#D5D5D7' },
              },
              yaxis: {
                title: { text: 'Peso (%)', font: { color: '#8e919e', size: 12 } },
                color: '#8e919e',
                gridcolor: 'rgba(255,255,255,0.05)',
              },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
            }}
            config={{ responsive: true, displayModeBar: false }}
            className="w-full"
          />
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-p-muted">{items.length} SKUs</p>
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

      <div className="glass-panel overflow-hidden">
        <div className="max-h-[65vh] overflow-y-auto">
          <table className="data-table">
            <thead className="sticky top-0 z-10">
              <tr>
                <th style={{ width: '25%' }}>Producto</th>
                <th style={{ width: '15%' }}>Marca</th>
                <th style={{ width: '15%' }} className="text-right">Peso (%)</th>
                <th style={{ width: '15%' }} className="text-right">PVP Sugerido</th>
                <th style={{ width: '15%' }} className="text-right">Desviación</th>
                <th style={{ width: '15%' }} className="text-center">Prioridad</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map(i => (
                <tr key={i.skuId}>
                  <td className="font-medium text-white" title={i.nombre}>{i.nombre}</td>
                  <td className="text-p-gray-light" title={i.marca}>{i.marca}</td>
                  <td className="text-right text-p-blue font-semibold">{i.pesoProfitPool}%</td>
                  <td className="text-right text-p-gray-light">{fmtCOP(i.pvpSugerido)}</td>
                  <td className="text-right">
                    <SeverityBadge value={i.desviacionActual - 100} />
                  </td>
                  <td className="text-center">
                    <PrioridadBadge value={i.prioridad} />
                  </td>
                </tr>
              ))}
              {pagedItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-p-muted">
                    No hay datos de profit pool
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, icon: Icon, color, sub, subColor, alert }: {
  label: string; value: string; icon: React.ElementType; color: string
  sub?: string; subColor?: string; alert?: boolean
}) {
  return (
    <div className={`metric-card ${alert ? 'metric-card-alert' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm text-p-gray-light font-medium">{label}</h3>
        <Icon size={20} className={color} />
      </div>
      <p className={`text-[32px] font-bold leading-none ${color}`}>{value}</p>
      {sub && <p className={`text-[13px] mt-2 ${subColor || 'text-p-muted'}`}>{sub}</p>}
    </div>
  )
}

function PrioridadBadge({ value }: { value: string }) {
  const cls = value === 'Alta' ? 'badge badge-red'
    : value === 'Media' ? 'badge badge-yellow'
    : 'badge badge-green'

  return <span className={cls}>{value}</span>
}
