// ─── Mock API – reemplaza axios en modo VITE_MOCK_MODE=true ──────────────────
import { store } from './store'
import { SEED_USERS } from './data'

// ─── Utilidades ──────────────────────────────────────────────────────────────
function ok<T>(data: T): Promise<{ data: T; headers: Record<string, string> }> {
  return Promise.resolve({ data, headers: {} })
}

function okPaged<T>(items: T[], page: number, pageSize: number): Promise<{ data: T[]; headers: Record<string, string> }> {
  const total = items.length
  const start = (page - 1) * pageSize
  return Promise.resolve({
    data: items.slice(start, start + pageSize),
    headers: { 'x-total-count': String(total) },
  })
}

function parseUrl(url: string): { path: string; params: URLSearchParams } {
  const [path, qs = ''] = url.split('?')
  return { path: path.replace(/^\//, ''), params: new URLSearchParams(qs) }
}

function avg(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

// Último mes disponible
function latestDate(): string {
  return store.preciosMercado
    .map(p => p.fechaScraping)
    .sort()
    .reverse()[0] ?? ''
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function handleAuth(method: string, path: string, body: unknown) {
  if (method === 'POST' && path === 'auth/login') {
    const { email, password } = body as { email: string; password: string }
    const user = SEED_USERS.find(u => u.email === email && u.password === password)
    if (!user) return Promise.reject({ response: { status: 401, data: { message: 'Credenciales inválidas' } } })
    const token = `mock_${user.id}`
    return ok({
      accessToken: token,
      refreshToken: `refresh_${user.id}`,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      user: { id: user.id, email: user.email, nombreCompleto: user.nombreCompleto, rol: user.rol, tenantId: user.tenantId },
    })
  }
  if (method === 'GET' && path === 'auth/me') {
    const token = localStorage.getItem('access_token') ?? ''
    const userId = token.replace('mock_', '')
    const user = SEED_USERS.find(u => u.id === userId)
    if (!user) return Promise.reject({ response: { status: 401 } })
    return ok({ id: user.id, email: user.email, nombreCompleto: user.nombreCompleto, rol: user.rol, tenantId: user.tenantId })
  }
  if (method === 'POST' && path === 'auth/logout') {
    return ok({ message: 'ok' })
  }
  return null
}

// ─── Execution ────────────────────────────────────────────────────────────────
function handleExecution(path: string, params: URLSearchParams) {
  const subpath = path.replace('execution/', '')
  const filterMarca = params.get('marca') || ''
  const filterRetailer = params.get('retailer') || ''
  const filterCategoria = params.get('categoria') || ''

  const latestFecha = latestDate()
  let precios = store.preciosMercado.filter(p => p.fechaScraping === latestFecha)
  if (filterRetailer) precios = precios.filter(p => p.retailer === filterRetailer)

  let skus = store.skus
  if (filterMarca) skus = skus.filter(s => s.marca === filterMarca)
  if (filterCategoria) skus = skus.filter(s => s.categoria === filterCategoria)

  if (subpath === 'filters') {
    return ok({
      marcas: [...new Set(store.skus.map(s => s.marca))].sort(),
      retailers: [...new Set(store.preciosMercado.map(p => p.retailer))].sort(),
    })
  }

  if (subpath === 'dashboard') {
    const rows = skus.map(sku => {
      const preciosSku = precios.filter(p => p.skuId === sku.id)
      const precioObs = avg(preciosSku.map(p => p.precioObservado))
      return { sku, desviacion: precioObs ? (precioObs - sku.pvpSugerido) / sku.pvpSugerido : 0 }
    }).filter(r => r.desviacion !== 0)

    // índice: 100 = precio en PVP, >100 = sobre PVP, <100 = bajo PVP
    const desviacionPromedio = round2(100 + avg(rows.map(r => r.desviacion)) * 100)
    const skusCriticos = rows.filter(r => Math.abs(r.desviacion) > 0.05).length
    const totalSkus = skus.length

    // retailer con mayor desviación
    const retailers = [...new Set(store.preciosMercado.map(p => p.retailer))]
    let maxRetailer = retailers[0]
    let maxDev = 0
    for (const ret of retailers) {
      const ps = precios.filter(p => p.retailer === ret)
      const devs = ps.map(p => {
        const sku = store.skus.find(s => s.id === p.skuId)
        return sku ? Math.abs((p.precioObservado - sku.pvpSugerido) / sku.pvpSugerido) : 0
      })
      const d = avg(devs)
      if (d > maxDev) { maxDev = d; maxRetailer = ret }
    }

    return ok({
      desviacionPromedio,
      totalSkus,
      skusCriticos,
      retailerMayorDesviacion: maxRetailer,
      totalRetailers: retailers.length,
    })
  }

  if (subpath === 'brand') {
    const marcas = [...new Set(skus.map(s => s.marca))]
    return ok(marcas.map(marca => {
      const skusMarca = skus.filter(s => s.marca === marca)
      const ids = new Set(skusMarca.map(s => s.id))
      const ps = precios.filter(p => ids.has(p.skuId))
      const pvpProm = avg(skusMarca.map(s => s.pvpSugerido))
      const obsProm = avg(ps.map(p => p.precioObservado))
      // índice: obsProm / pvpProm * 100 → 100 = en PVP, 97 = 3% bajo, 103 = 3% sobre
      const desv = pvpProm ? round2(obsProm / pvpProm * 100) : 100
      return { marca, pvpSugeridoPromedio: round2(pvpProm), precioObservadoPromedio: round2(obsProm), desviacionPct: desv, skuCount: skusMarca.length }
    }))
  }

  if (subpath === 'detail') {
    const page = parseInt(params.get('page') || '1')
    const pageSize = parseInt(params.get('pageSize') || '25')
    const rows = skus.flatMap(sku => {
      const ps = precios.filter(p => p.skuId === sku.id)
      return ps.map(p => ({
        skuId: sku.id,
        codigoSku: sku.codigoSku,
        nombre: sku.nombre,
        marca: sku.marca,
        categoria: sku.categoria,
        pvpSugerido: sku.pvpSugerido,
        retailer: p.retailer,
        precioObservado: p.precioObservado,
        fechaScraping: p.fechaScraping,
        desviacionPct: round2((p.precioObservado - sku.pvpSugerido) / sku.pvpSugerido * 100),
      }))
    })
    return okPaged(rows, page, pageSize)
  }

  if (subpath === 'profit-pool') {
    return ok([...skus]
      .sort((a, b) => b.pesoProfitPool - a.pesoProfitPool)
      .map(sku => {
        const ps = precios.filter(p => p.skuId === sku.id)
        const obsAvg = avg(ps.map(p => p.precioObservado))
        const desv = obsAvg ? round2((obsAvg - sku.pvpSugerido) / sku.pvpSugerido * 100) : 0
        const prioridad = sku.pesoProfitPool >= 8 ? 'alta' : sku.pesoProfitPool >= 4 ? 'media' : 'baja'
        return { skuId: sku.id, codigoSku: sku.codigoSku, nombre: sku.nombre, marca: sku.marca, pesoProfitPool: sku.pesoProfitPool, pvpSugerido: sku.pvpSugerido, desviacionActual: desv, prioridad }
      })
    )
  }

  if (subpath === 'pivot') {
    const allRetailers = filterRetailer
      ? [filterRetailer]
      : [...new Set(store.preciosMercado.map(p => p.retailer))].sort()
    const rows = skus.map(sku => {
      const retailerMap: Record<string, { precioObservado: number | null; desviacionPct: number | null }> = {}
      for (const ret of allRetailers) {
        const ps = precios.filter(p => p.skuId === sku.id && p.retailer === ret)
        if (ps.length > 0) {
          const obs = round2(avg(ps.map(p => p.precioObservado)))
          const dev = round2((obs - sku.pvpSugerido) / sku.pvpSugerido * 100)
          retailerMap[ret] = { precioObservado: obs, desviacionPct: dev }
        } else {
          retailerMap[ret] = { precioObservado: null, desviacionPct: null }
        }
      }
      return { skuId: sku.id, codigoSku: sku.codigoSku, nombre: sku.nombre, marca: sku.marca, categoria: sku.categoria, pvpSugerido: sku.pvpSugerido, retailers: retailerMap }
    })
    return ok({ retailers: allRetailers, rows })
  }

  return null
}

// ─── Competition ──────────────────────────────────────────────────────────────
function handleCompetition(path: string, params: URLSearchParams) {
  const subpath = path.replace('competition/', '')
  const filterMarca = params.get('marca') || ''
  const filterCategoria = params.get('categoria') || ''
  const filterRetailer = params.get('retailer') || ''

  const latestFecha = latestDate()
  let preciosMercado = store.preciosMercado.filter(p => p.fechaScraping === latestFecha)
  let preciosComp = store.preciosCompetidor.filter(p => p.fechaScraping === latestFecha)
  if (filterRetailer) {
    preciosMercado = preciosMercado.filter(p => p.retailer === filterRetailer)
    preciosComp = preciosComp.filter(p => p.retailer === filterRetailer)
  }

  let skus = store.skus
  if (filterMarca) skus = skus.filter(s => s.marca === filterMarca)
  if (filterCategoria) skus = skus.filter(s => s.categoria === filterCategoria)

  if (subpath === 'filters') {
    return ok({
      marcas: [...new Set(store.skus.map(s => s.marca))].sort(),
      categorias: [...new Set(store.skus.map(s => s.categoria))].sort(),
      retailers: [...new Set(store.preciosMercado.map(p => p.retailer))].sort(),
    })
  }

  if (subpath === 'dashboard') {
    const diferenciales: number[] = []
    let skuMasCaro = { nombre: '', diferencialPct: 0 }
    let skuMasBarato = { nombre: '', diferencialPct: 0 }
    const competidoresSet = new Set<string>()

    for (const sku of skus) {
      const comp = store.competidores.find(c => c.skuId === sku.id && c.esPrincipal)
      if (!comp) continue
      competidoresSet.add(comp.nombreCompetidor)
      const psCliente = avg(preciosMercado.filter(p => p.skuId === sku.id).map(p => p.precioObservado))
      const psComp = avg(preciosComp.filter(p => p.competidorId === comp.id).map(p => p.precioObservado))
      if (!psCliente || !psComp) continue
      const dif = round2((psCliente - psComp) / psComp * 100)
      diferenciales.push(dif)
      if (dif > skuMasCaro.diferencialPct) skuMasCaro = { nombre: sku.nombre, diferencialPct: dif }
      if (dif < skuMasBarato.diferencialPct) skuMasBarato = { nombre: sku.nombre, diferencialPct: dif }
    }

    return ok({
      diferencialPromedio: round2(avg(diferenciales)),
      totalSkusComparados: diferenciales.length,
      skuMasCaro,
      skuMasBarato,
      totalCompetidores: competidoresSet.size,
    })
  }

  if (subpath === 'brand') {
    const marcas = [...new Set(skus.map(s => s.marca))]
    return ok(marcas.map(marca => {
      const skusMarca = skus.filter(s => s.marca === marca)
      const ids = new Set(skusMarca.map(s => s.id))
      const psCliente = avg(preciosMercado.filter(p => ids.has(p.skuId)).map(p => p.precioObservado))
      const comps = store.competidores.filter(c => ids.has(c.skuId) && c.esPrincipal)
      const compIds = new Set(comps.map(c => c.id))
      const psComp = avg(preciosComp.filter(p => compIds.has(p.competidorId)).map(p => p.precioObservado))
      const dif = psComp ? round2((psCliente - psComp) / psComp * 100) : 0
      return { marca, precioPromedioCliente: round2(psCliente), precioPromedioCompetidor: round2(psComp), diferencialPct: dif, skuCount: skusMarca.length }
    }))
  }

  if (subpath === 'detail') {
    return ok(skus.map(sku => {
      const comp = store.competidores.find(c => c.skuId === sku.id && c.esPrincipal)
      const psCliente = avg(preciosMercado.filter(p => p.skuId === sku.id).map(p => p.precioObservado))
      const psComp = comp ? avg(preciosComp.filter(p => p.competidorId === comp.id).map(p => p.precioObservado)) : 0
      const difAbs = round2(psCliente - psComp)
      const difPct = psComp ? round2((psCliente - psComp) / psComp * 100) : 0
      return {
        skuId: sku.id, codigoSku: sku.codigoSku, nombre: sku.nombre, marca: sku.marca,
        precioPromedioCliente: round2(psCliente),
        competidorPrincipal: comp?.nombreCompetidor ?? 'N/A',
        precioCompetidor: round2(psComp),
        diferencialAbsoluto: difAbs,
        diferencialPct: difPct,
      }
    }))
  }

  if (subpath === 'scatter') {
    const points: unknown[] = []
    for (const sku of skus) {
      const ps = preciosMercado.filter(p => p.skuId === sku.id)
      for (const p of ps) {
        points.push({ nombreProducto: sku.nombre, tipo: 'cliente', retailer: p.retailer, precio: p.precioObservado, skuClienteNombre: sku.nombre })
      }
      const comps = store.competidores.filter(c => c.skuId === sku.id)
      for (const comp of comps) {
        const ps2 = preciosComp.filter(p => p.competidorId === comp.id)
        for (const p of ps2) {
          points.push({ nombreProducto: comp.skuCompetidor, tipo: 'competidor', retailer: p.retailer, precio: p.precioObservado, skuClienteNombre: sku.nombre })
        }
      }
    }
    return ok(points)
  }

  if (subpath === 'boxplot') {
    const retailers = filterRetailer ? [filterRetailer] : [...new Set(store.preciosMercado.map(p => p.retailer))]
    const skuIds = new Set(skus.map(s => s.id))
    const compIds = store.competidores.filter(c => skuIds.has(c.skuId)).map(c => c.id)
    const series: unknown[] = []
    for (const ret of retailers) {
      const clientPs = skus.flatMap(sku => preciosMercado.filter(p => p.skuId === sku.id && p.retailer === ret).map(p => p.precioObservado))
      series.push({ nombre: 'Cliente', retailer: ret, precios: clientPs })
      const compPs = preciosComp.filter(p => compIds.includes(p.competidorId) && p.retailer === ret).map(p => p.precioObservado)
      series.push({ nombre: 'Competidores', retailer: ret, precios: compPs })
    }
    return ok(series)
  }

  return null
}

import * as XLSX from 'xlsx'

// ─── Helper compartido: precio óptimo (módulo 3a) ────────────────────────────
type SkuLike = (typeof store.skus)[number]
type PrecioObs = (typeof store.preciosMercado)[number]

function computePrecioOptimo(sku: SkuLike, precios: PrecioObs[]) {
  const atribs = store.categoriaAtributos.filter(a => a.categoria === sku.categoria)
  const vp = atribs.reduce((acc, a) => acc + a.peso * a.calificacion, 0)
  const precioActual = avg(precios.filter(p => p.skuId === sku.id).map(p => p.precioObservado)) || sku.pvpSugerido
  const vpMax = 5
  const factor = 0.85 + (vp / vpMax) * 0.30
  const precioOptimo = Math.round(sku.costoVariable / (1 - 0.35) * factor)
  const variacion = precioActual ? round2((precioOptimo - precioActual) / precioActual * 100) : 0
  const recomendacion = variacion > 3 ? 'aumentar' : variacion < -3 ? 'reducir' : 'mantener'
  const tieneCompetidores = store.competidores.some(c => c.skuId === sku.id)
  const skuHash = sku.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const precioOptimoValido = tieneCompetidores && skuHash % 10 !== 0
  return { precioActual, precioOptimo, variacion, recomendacion, tieneCompetidores, precioOptimoValido }
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
function handlePricing(path: string, params: URLSearchParams) {
  const subpath = path.replace('pricing/', '')
  const filterMarca = params.get('marca') || ''
  const filterCategoria = params.get('categoria') || ''

  let skus = store.skus
  if (filterMarca) skus = skus.filter(s => s.marca === filterMarca)
  if (filterCategoria) skus = skus.filter(s => s.categoria === filterCategoria)

  const latestFecha = latestDate()
  const precios = store.preciosMercado.filter(p => p.fechaScraping === latestFecha)

  if (subpath === 'filters') {
    return ok({
      marcas: [...new Set(store.skus.map(s => s.marca))].sort(),
      categorias: [...new Set(store.skus.map(s => s.categoria))].sort(),
    })
  }

  if (subpath === 'portfolio') {
    return ok(skus.map(sku => {
      const r = computePrecioOptimo(sku, precios)
      return { skuId: sku.id, codigoSku: sku.codigoSku, nombre: sku.nombre, marca: sku.marca, categoria: sku.categoria, precioActual: round2(r.precioActual), precioOptimo: r.precioOptimo, variacionPct: r.variacion, recomendacion: r.recomendacion, tieneCompetidores: r.tieneCompetidores, precioOptimoValido: r.precioOptimoValido }
    }))
  }

  // valuemap/{skuId}
  if (subpath.startsWith('valuemap/')) {
    const skuId = subpath.replace('valuemap/', '')
    const sku = store.skus.find(s => s.id === skuId)
    if (!sku) return Promise.reject({ response: { status: 404 } })

    const atribs = store.categoriaAtributos.filter(a => a.categoria === sku.categoria)
    const vpCliente = round2(atribs.reduce((acc, a) => acc + a.peso * a.calificacion, 0))
    const precioActual = avg(precios.filter(p => p.skuId === sku.id).map(p => p.precioObservado)) || sku.pvpSugerido

    const comps = store.competidores.filter(c => c.skuId === sku.id)
    const latestComp = store.preciosCompetidor.filter(p => p.fechaScraping === latestFecha)
    const competidoresPuntos = comps.map(comp => {
      const ps = avg(latestComp.filter(p => p.competidorId === comp.id).map(p => p.precioObservado))
      const vpComp = round2(vpCliente * (0.85 + Math.random() * 0.30))
      return { nombre: comp.skuCompetidor, valorPercibido: vpComp, precio: round2(ps || precioActual * 0.95), tipo: 'competidor' }
    })

    // línea de regresión simple sobre puntos cliente + competidores
    const puntos = [
      { nombre: sku.nombre, valorPercibido: vpCliente, precio: round2(precioActual), tipo: 'cliente' },
      ...competidoresPuntos,
    ]
    const n = puntos.length
    const sumX = puntos.reduce((a, p) => a + p.valorPercibido, 0)
    const sumY = puntos.reduce((a, p) => a + p.precio, 0)
    const sumXY = puntos.reduce((a, p) => a + p.valorPercibido * p.precio, 0)
    const sumX2 = puntos.reduce((a, p) => a + p.valorPercibido * p.valorPercibido, 0)
    const denom = n * sumX2 - sumX * sumX
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0
    const intercept = (sumY - slope * sumX) / n
    const xMin = Math.min(...puntos.map(p => p.valorPercibido)) - 0.2
    const xMax = Math.max(...puntos.map(p => p.valorPercibido)) + 0.2
    const precioOptimoValor = round2(slope * vpCliente + intercept)

    // Sincronizar el flag con la lógica de portfolio para que la tabla y el mapa coincidan
    const skuHash = sku.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    const precioOptimoValido = slope > 0 && skuHash % 10 !== 0

    return ok({
      producto: { nombre: sku.nombre, valorPercibido: vpCliente, precio: round2(precioActual), tipo: 'cliente' },
      precioOptimoPunto: precioOptimoValor,
      competidores: competidoresPuntos,
      lineaValorJusto: { slope: round2(slope), intercept: round2(intercept), xMin: round2(xMin), xMax: round2(xMax) },
      precioOptimoValor,
      variacionPct: precioActual ? round2((precioOptimoValor - precioActual) / precioActual * 100) : 0,
      recomendacion: precioOptimoValor > precioActual * 1.03 ? 'aumentar' : precioOptimoValor < precioActual * 0.97 ? 'reducir' : 'mantener',
      precioOptimoValido,
    })
  }

  return null
}

// ─── Elasticidad ──────────────────────────────────────────────────────────────
function handleElasticidad(path: string, params: URLSearchParams) {
  const subpath = path.replace('elasticidad/', '')
  const filterMarca = params.get('marca') || ''
  const filterCategoria = params.get('categoria') || ''

  let skus = store.skus
  if (filterMarca) skus = skus.filter(s => s.marca === filterMarca)
  if (filterCategoria) skus = skus.filter(s => s.categoria === filterCategoria)

  const latestFecha = latestDate()
  const precios = store.preciosMercado.filter(p => p.fechaScraping === latestFecha)

  if (subpath === 'filters') {
    return ok({
      marcas: [...new Set(store.skus.map(s => s.marca))].sort(),
      categorias: [...new Set(store.skus.map(s => s.categoria))].sort(),
    })
  }

  const elasticidades = store.elasticidades.filter(e => skus.some(s => s.id === e.skuId))

  if (subpath === 'kpis') {
    const coefs = elasticidades.map(e => e.coeficiente)
    const confs = elasticidades.map(e => e.confianza)
    const masElastico = elasticidades.reduce((a, b) => Math.abs(a.coeficiente) > Math.abs(b.coeficiente) ? a : b, elasticidades[0])
    const skuMasElastico = masElastico ? store.skus.find(s => s.id === masElastico.skuId) : null
    return ok({
      totalSkusConElasticidad: elasticidades.length,
      coeficientePromedio: round2(avg(coefs)),
      confianzaPromedio: round2(avg(confs)),
      skuMasElastico: skuMasElastico
        ? { nombre: skuMasElastico.nombre, coeficiente: round2(masElastico.coeficiente) }
        : null,
    })
  }

  if (subpath === 'summary') {
    return ok(elasticidades.map(e => {
      const sku = store.skus.find(s => s.id === e.skuId)!
      const opt = computePrecioOptimo(sku, precios)
      const precioActual = opt.precioActual
      const precioRec = opt.precioOptimoValido ? opt.precioOptimo : precioActual
      const cambio = precioActual ? (precioRec - precioActual) / precioActual : 0
      const impactoVolumen = round2(e.coeficiente * cambio * 100)
      const nuevoVolumen = e.volumenBase * (1 + e.coeficiente * cambio)
      const impactoIngresos = round2(((nuevoVolumen * precioRec) - (e.volumenBase * precioActual)) / (e.volumenBase * precioActual) * 100)
      const margen = precioActual - sku.costoVariable
      const margenNuevo = precioRec - sku.costoVariable
      const impactoMargen = margen !== 0
        ? round2(((nuevoVolumen * margenNuevo) - (e.volumenBase * margen)) / (e.volumenBase * margen) * 100)
        : 0
      return {
        skuId: sku.id, codigoSku: sku.codigoSku, nombre: sku.nombre, marca: sku.marca,
        volumenBase: e.volumenBase,
        coeficiente: round2(e.coeficiente),
        precioActual: round2(precioActual),
        precioRecomendado: round2(precioRec),
        costoVariable: sku.costoVariable,
        impactoVolumenPct: impactoVolumen,
        impactoIngresosPct: impactoIngresos,
        impactoMargenPct: impactoMargen,
        nivelConfianza: round2(e.confianza),
      }
    }))
  }

  if (subpath.startsWith('sku/')) {
    const skuId = subpath.replace('sku/', '')
    const e = store.elasticidades.find(e => e.skuId === skuId)
    const sku = store.skus.find(s => s.id === skuId)
    if (!e || !sku) return Promise.reject({ response: { status: 404 } })
    const opt = computePrecioOptimo(sku, precios)
    const precioRec = opt.precioOptimoValido ? opt.precioOptimo : opt.precioActual
    return ok({
      skuId: sku.id,
      codigoSku: sku.codigoSku,
      nombre: sku.nombre,
      precioActual: round2(opt.precioActual),
      precioRecomendado: round2(precioRec),
      costoVariable: sku.costoVariable,
      volumenBase: e.volumenBase,
      coeficiente: round2(e.coeficiente),
      confianza: round2(e.confianza),
    })
  }

  return null
}

// ─── Listas ───────────────────────────────────────────────────────────────────
function handleListas(path: string, params: URLSearchParams) {
  const subpath = path.replace('listas/', '')
  const filterMarca = params.get('marca') || ''
  const filterCategoria = params.get('categoria') || ''
  const page = parseInt(params.get('page') || '1', 10)
  const pageSize = parseInt(params.get('pageSize') || '20', 10)

  let skus = store.skus
  if (filterMarca) skus = skus.filter(s => s.marca === filterMarca)
  if (filterCategoria) skus = skus.filter(s => s.categoria === filterCategoria)

  if (subpath === 'filters') {
    return ok({
      marcas: [...new Set(store.skus.map(s => s.marca))].sort(),
      categorias: [...new Set(store.skus.map(s => s.categoria))].sort(),
    })
  }

  if (subpath === 'skus') {
    const total = skus.length
    const paginated = skus.slice((page - 1) * pageSize, page * pageSize)
    return Promise.resolve({
      data: paginated.map(sku => ({
        skuId: sku.id,
        codigoSku: sku.codigoSku,
        nombre: sku.nombre,
        marca: sku.marca,
        categoria: sku.categoria,
        pvpSugerido: store.preciosEditados[sku.id] ?? sku.pvpSugerido,
      })),
      headers: { 'x-total-count': String(total) },
    })
  }

  if (subpath === 'canales') {
    const categorias = [...new Set(store.skus.map(s => s.categoria))]
    const buildMargenes = (m: number) => Object.fromEntries(categorias.map(c => [c, m]))
    return ok({
      iva: 0.19,
      canales: [
        { nombre: 'Lista Mayorista', margenes: buildMargenes(0.20) },
        { nombre: 'Lista Retail',    margenes: buildMargenes(0.35) },
        { nombre: 'Lista TAT',       margenes: buildMargenes(0.15) },
      ],
    })
  }

  return null
}

// Export Excel/CSV de Listas — implementaciones simples para mock
function handleListasExport(method: string, path: string, body: unknown): Promise<{ data: Blob; headers: Record<string, string> }> | null {
  if (method !== 'POST') return null
  if (path !== 'listas/export/excel' && path !== 'listas/export/csv') return null

  const { items } = body as { items: Array<{ skuId: string; pvpEditado: number }> }
  const editsMap = new Map(items.map(i => [i.skuId, i.pvpEditado]))
  const iva = 0.19
  const canales = [
    { nombre: 'Lista Mayorista', margen: 0.20 },
    { nombre: 'Lista Retail',    margen: 0.35 },
    { nombre: 'Lista TAT',       margen: 0.15 },
  ]

  const rows = store.skus.map(sku => {
    const pvp = editsMap.get(sku.id) ?? sku.pvpSugerido
    const sinIva = pvp / (1 + iva)
    const row: Record<string, unknown> = {
      'Código': sku.codigoSku,
      'Producto': sku.nombre,
      'Marca': sku.marca,
      'Categoría': sku.categoria,
      'PVP': Math.round(pvp),
      'PVP sin IVA': Math.round(sinIva),
    }
    for (const c of canales) {
      row[`${c.nombre} (-${(c.margen * 100).toFixed(0)}%)`] = Math.round(sinIva * (1 - c.margen))
    }
    return row
  })

  if (path === 'listas/export/excel') {
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Listas de precios')
    const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
    const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    return Promise.resolve({ data: blob, headers: {} })
  }

  // CSV
  const headers = Object.keys(rows[0] ?? { Código: '' })
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push(headers.map(h => {
      const v = r[h]
      const s = typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v ?? '')
      return s
    }).join(','))
  }
  const csv = lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  return Promise.resolve({ data: blob, headers: {} })
}

// ─── Ingesta ──────────────────────────────────────────────────────────────────
function handleIngesta(method: string, path: string, body: unknown) {
  const subpath = path.replace('ingesta/', '')

  // GET /ingesta/historial
  if (method === 'GET' && subpath === 'historial') {
    return ok(store.cargasHistorial)
  }

  // POST /ingesta/preview/{tipo}  → dry-run con 2 errores de ejemplo
  if (method === 'POST' && (subpath === 'preview/portafolio' || subpath === 'preview/competidores')) {
    const tipo = subpath.replace('preview/', '') as 'portafolio' | 'competidores'
    const nombre = (body as FormData)?.get?.('file') instanceof File
      ? ((body as FormData).get('file') as File).name
      : 'archivo.xlsx'
    store._previewCounter++
    const previewId = `prev-${store._previewCounter}`
    const resumen = { nuevas: 45, actualizadas: 12, omitidas: 2 }
    store.previews[previewId] = {
      previewId,
      tipo,
      nombre: typeof nombre === 'string' ? nombre : 'archivo.xlsx',
      estado: 'procesando',
      resumen,
    }
    return ok({
      previewId,
      resumen,
      errores: [
        { fila: 3, columna: tipo === 'portafolio' ? 'EAN' : 'EAN Propio', mensaje: 'Valor vacío o inválido' },
        { fila: 17, columna: tipo === 'portafolio' ? 'PVP Sugerido' : 'Retailer', mensaje: 'El valor debe ser numérico' },
      ],
    })
  }

  // POST /ingesta/confirmar/{previewId}  → crea entrada en historial como 'procesando'
  if (method === 'POST' && subpath.startsWith('confirmar/')) {
    const previewId = subpath.replace('confirmar/', '')
    const entry = store.previews[previewId]
    if (!entry) {
      return Promise.reject({ response: { status: 410, data: { error: 'Preview no encontrado o expirado.' } } })
    }
    store._uploadCounter++
    const histId = `carga-${store._uploadCounter}`
    store.cargasHistorial.unshift({
      id: histId,
      tipoArchivo: entry.tipo,
      nombreArchivo: entry.nombre,
      estado: 'procesando',
      filasNuevas: 0,
      filasActualizadas: 0,
      totalErrores: entry.resumen.omitidas,
      subidoPor: 'Cliente ConGrupo',
      fechaCarga: new Date().toISOString(),
    })
    // Transitar a estado terminal tras 2.5s
    setTimeout(() => {
      const row = store.cargasHistorial.find(r => r.id === histId)
      if (row) {
        row.estado = entry.resumen.omitidas > 0 ? 'con_advertencias' : 'exitoso'
        row.filasNuevas = entry.resumen.nuevas
        row.filasActualizadas = entry.resumen.actualizadas
      }
      entry.estado = row?.estado ?? 'exitoso'
    }, 2500)
    return ok({ histId })
  }

  // GET /ingesta/preview/{previewId}/estado  → estado terminal para polling del modal
  if (method === 'GET' && subpath.startsWith('preview/') && subpath.endsWith('/estado')) {
    const previewId = subpath.replace('preview/', '').replace('/estado', '')
    const entry = store.previews[previewId]
    return ok({ estado: entry?.estado ?? 'exitoso' })
  }

  // DELETE /ingesta/preview/{previewId}  → cancelar preview
  if (method === 'DELETE' && subpath.startsWith('preview/')) {
    const previewId = subpath.replace('preview/', '')
    delete store.previews[previewId]
    return ok({ ok: true })
  }

  return null
}

// ─── Reglas ───────────────────────────────────────────────────────────────────
function handleReglas(method: string, path: string, params: URLSearchParams, body: unknown) {
  const subpath = path.replace('reglas/', '')

  if (subpath === 'resumen') {
    return ok(store.reglas.map(r => ({
      tipoRegla: r.tipoRegla,
      descripcion: r.descripcion,
      configurada: r.configurada,
      ultimaActualizacion: r.configurada ? new Date().toISOString() : null,
      actualizadoPorNombre: r.configurada ? 'Consultor Demo' : null,
    })))
  }

  if (subpath === 'valor-percibido') {
    if (method === 'GET') {
      const categorias = [...new Set(store.categoriaAtributos.map(a => a.categoria))].sort()
      return ok(categorias.map(cat => {
        const atribs = store.categoriaAtributos.filter(a => a.categoria === cat)
        const vp = round2(atribs.reduce((acc, a) => acc + a.peso * a.calificacion, 0))
        return {
          categoria: cat,
          atributos: atribs.map(a => ({ id: a.id, nombreAtributo: a.nombreAtributo, peso: a.peso, calificacion: a.calificacion, orden: a.orden })),
          valorPercibido: vp,
        }
      }))
    }
    if (method === 'PUT') {
      const req = body as { categoria: string; atributos: Array<{ id?: string; nombreAtributo: string; peso: number; calificacion: number; orden: number }> }
      // actualizar en store
      store.categoriaAtributos = store.categoriaAtributos.filter(a => a.categoria !== req.categoria)
      req.atributos.forEach((a, i) => {
        store.categoriaAtributos.push({ id: a.id || `attr-${req.categoria}-${i + 1}`, categoria: req.categoria, nombreAtributo: a.nombreAtributo, peso: a.peso, calificacion: a.calificacion, orden: a.orden })
      })
      const vp = round2(req.atributos.reduce((acc, a) => acc + a.peso * a.calificacion, 0))
      return ok({ categoria: req.categoria, atributos: req.atributos, valorPercibido: vp })
    }
  }

  if (subpath === 'canales-margenes') {
    if (method === 'GET') return ok(store.canalesMargenesConfig)
    if (method === 'PUT') {
      const req = body as typeof store.canalesMargenesConfig
      store.canalesMargenesConfig = { ...req, updatedAt: new Date().toISOString(), actualizadoPor: 'Consultor Demo' }
      return ok(store.canalesMargenesConfig)
    }
  }

  return null
}

// ─── Router principal ─────────────────────────────────────────────────────────
function route<T>(method: string, rawUrl: string, body?: unknown): Promise<{ data: T; headers?: Record<string, string> }> {
  const { path, params } = parseUrl(rawUrl)

  // Auth
  const authResult = handleAuth(method, path, body)
  if (authResult) return authResult as Promise<{ data: T }>

  // Execution
  if (path.startsWith('execution/') || path === 'execution/filters') {
    const r = handleExecution(path, params)
    if (r) return r as Promise<{ data: T }>
  }

  // Competition
  if (path.startsWith('competition/') || path === 'competition/filters') {
    const r = handleCompetition(path, params)
    if (r) return r as Promise<{ data: T }>
  }

  // Pricing
  if (path.startsWith('pricing/') || path === 'pricing/filters') {
    const r = handlePricing(path, params)
    if (r) return r as Promise<{ data: T }>
  }

  // Elasticidad
  if (path.startsWith('elasticidad/') || path === 'elasticidad/filters') {
    const r = handleElasticidad(path, params)
    if (r) return r as Promise<{ data: T }>
  }

  // Listas — export Excel/CSV (POST)
  if (path === 'listas/export/excel' || path === 'listas/export/csv') {
    const r = handleListasExport(method, path, body)
    if (r) return r as Promise<{ data: T }>
  }

  // Listas
  if (path.startsWith('listas/') || path === 'listas/filters') {
    const r = handleListas(path, params)
    if (r) return r as Promise<{ data: T }>
  }

  // Ingesta
  if (path.startsWith('ingesta/')) {
    const r = handleIngesta(method, path, body)
    if (r) return r as Promise<{ data: T }>
  }

  // Reglas
  if (path.startsWith('reglas/')) {
    const r = handleReglas(method, path, params, body)
    if (r) return r as Promise<{ data: T }>
  }

  console.warn(`[mockApi] Unhandled: ${method} /${path}`)
  return Promise.reject({ response: { status: 404, data: { message: `Mock: ruta no encontrada: ${method} /${path}` } } })
}

// ─── Interfaz pública (compatible con axios) ──────────────────────────────────

export interface ApiClient {
  get<T = unknown>(url: string, config?: Record<string, unknown>): Promise<{ data: T; headers: Record<string, string> }>
  post<T = unknown>(url: string, body?: unknown, config?: Record<string, unknown>): Promise<{ data: T; headers: Record<string, string> }>
  put<T = unknown>(url: string, body?: unknown): Promise<{ data: T; headers: Record<string, string> }>
  delete<T = unknown>(url: string): Promise<{ data: T; headers: Record<string, string> }>
  patch<T = unknown>(url: string, body?: unknown): Promise<{ data: T; headers: Record<string, string> }>
}

const mockApi: ApiClient = {
  get: <T>(url: string) => route<T>('GET', url) as Promise<{ data: T; headers: Record<string, string> }>,
  post: <T>(url: string, body?: unknown) => route<T>('POST', url, body) as Promise<{ data: T; headers: Record<string, string> }>,
  put: <T>(url: string, body?: unknown) => route<T>('PUT', url, body) as Promise<{ data: T; headers: Record<string, string> }>,
  delete: <T>(url: string) => route<T>('DELETE', url) as Promise<{ data: T; headers: Record<string, string> }>,
  patch: <T>(url: string, body?: unknown) => route<T>('PATCH', url, body) as Promise<{ data: T; headers: Record<string, string> }>,
}

export default mockApi
