// ─── Mock data basado en SeedData.cs ────────────────────────────────────────
// Generado con misma semilla (42) y lógica que el backend .NET

// Helper: LCG seeded random (reproduce variaciones del backend Random(42))
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

// ─── Tipos ──────────────────────────────────────────────────────────────────
export interface Sku {
  id: string
  codigoSku: string
  nombre: string
  marca: string
  categoria: string
  pvpSugerido: number
  costoVariable: number
  pesoProfitPool: number
}

export interface Competidor {
  id: string
  skuId: string
  nombreCompetidor: string
  skuCompetidor: string
  esPrincipal: boolean
}

export interface PrecioMercado {
  id: string
  skuId: string
  retailer: string
  precioObservado: number
  fechaScraping: string // ISO date
  fuenteDato: string
}

export interface PrecioCompetidor {
  id: string
  competidorId: string
  retailer: string
  precioObservado: number
  fechaScraping: string
}

export interface Elasticidad {
  id: string
  skuId: string
  coeficiente: number
  confianza: number
  volumenBase: number
}

export interface CategoriaAtributo {
  id: string
  categoria: string
  nombreAtributo: string
  peso: number
  calificacion: number
  orden: number
}

// ─── SKUs ────────────────────────────────────────────────────────────────────
const skuRaw: [string, string, string, string, number, number, number][] = [
  // [codigo, nombre, marca, categoria, pvp, costo, peso]
  ['SKU-001','Arroz Premium 1kg','ArroStar','Arroz',4500,2800,12.0],
  ['SKU-002','Arroz Integral 1kg','ArroStar','Arroz',5200,3100,8.5],
  ['SKU-003','Arroz Saborizado 500g','ArroStar','Arroz',3800,2200,4.2],
  ['SKU-004','Arroz Parboiled 1kg','ArroStar','Arroz',4900,2900,6.1],
  ['SKU-005','Arroz Jazmín 500g','ArroStar','Arroz',6200,3800,3.5],
  ['SKU-006','Arroz para Sushi 500g','ArroStar','Arroz',7100,4200,2.8],
  ['SKU-007','Aceite Vegetal 1L','OleoVida','Aceites',8900,5500,15.0],
  ['SKU-008','Aceite Oliva Extra 500ml','OleoVida','Aceites',15800,9200,10.2],
  ['SKU-009','Aceite de Canola 1L','OleoVida','Aceites',9500,5800,7.3],
  ['SKU-010','Aceite de Coco 250ml','OleoVida','Aceites',12400,7100,5.1],
  ['SKU-011','Aceite de Aguacate 250ml','OleoVida','Aceites',18500,10200,4.0],
  ['SKU-012','Aceite Girasol 1L','OleoVida','Aceites',7800,4600,6.5],
  ['SKU-013','Leche Entera 1L','LecheSur','Lacteos',3800,2400,18.0],
  ['SKU-014','Yogurt Natural 150g','LecheSur','Lacteos',2100,1200,5.5],
  ['SKU-015','Leche Deslactosada 1L','LecheSur','Lacteos',4200,2700,9.0],
  ['SKU-016','Queso Crema 200g','LecheSur','Lacteos',5600,3100,4.8],
  ['SKU-017','Leche en Polvo 400g','LecheSur','Lacteos',9800,5900,7.2],
  ['SKU-018','Yogurt Griego 200g','LecheSur','Lacteos',3500,1900,3.1],
  ['SKU-019','Mantequilla 250g','LecheSur','Lacteos',6200,3600,2.5],
  ['SKU-020','Crema de Leche 200ml','LecheSur','Lacteos',3100,1700,2.0],
  ['SKU-021','Pasta Spaghetti 500g','PastaMia','Pastas',3200,1800,6.0],
  ['SKU-022','Pasta Penne 500g','PastaMia','Pastas',3400,1900,3.8],
  ['SKU-023','Lasagna 500g','PastaMia','Pastas',4800,2600,2.9],
  ['SKU-024','Pasta Fusilli 500g','PastaMia','Pastas',3300,1850,2.2],
  ['SKU-025','Fideos Cabello Angel 250g','PastaMia','Pastas',2100,1100,1.5],
  ['SKU-026','Atun en Lata 170g','MarAzul','Enlatados',5600,3200,8.0],
  ['SKU-027','Sardinas en Aceite 125g','MarAzul','Enlatados',3800,2100,4.5],
  ['SKU-028','Atun en Agua 170g','MarAzul','Enlatados',5200,3000,5.0],
  ['SKU-029','Salmon Ahumado 200g','MarAzul','Enlatados',22000,13000,3.2],
  ['SKU-030','Camarones Cocidos 250g','MarAzul','Enlatados',18500,10800,2.8],
  ['SKU-031','Mejillones en Escabeche 120g','MarAzul','Enlatados',11200,6500,1.9],
  ['SKU-032','Cafe Molido 250g','CafeBueno','Bebidas',12500,7800,9.5],
  ['SKU-033','Cafe Instantaneo 100g','CafeBueno','Bebidas',8200,4500,6.0],
  ['SKU-034','Cafe en Grano 500g','CafeBueno','Bebidas',24000,14000,4.5],
  ['SKU-035','Cafe Descafeinado 250g','CafeBueno','Bebidas',13800,8200,3.0],
  ['SKU-036','Cafe Capsula x10','CafeBueno','Bebidas',15000,8800,2.5],
  ['SKU-037','Chocolate Caliente 200g','CafeBueno','Bebidas',6500,3600,1.8],
  ['SKU-038','Azucar Blanca 1kg','DulceSol','Azucar',3100,1900,7.0],
  ['SKU-039','Azucar Morena 1kg','DulceSol','Azucar',3600,2100,4.0],
  ['SKU-040','Panela Pulverizada 500g','DulceSol','Azucar',2800,1600,3.5],
  ['SKU-041','Miel de Abejas 350ml','DulceSol','Azucar',14500,8200,2.2],
  ['SKU-042','Stevia en Sobres x100','DulceSol','Azucar',8900,5100,1.8],
  ['SKU-043','Azucar Glass 250g','DulceSol','Azucar',2500,1400,1.2],
  ['SKU-044','Lenteja Roja 500g','GranoAndino','Granos',4200,2400,5.5],
  ['SKU-045','Frijol Negro 500g','GranoAndino','Granos',3800,2200,4.8],
  ['SKU-046','Garbanzo 500g','GranoAndino','Granos',5100,2900,3.5],
  ['SKU-047','Quinoa Blanca 400g','GranoAndino','Granos',11500,6500,2.8],
  ['SKU-048','Avena en Hojuelas 500g','GranoAndino','Granos',3200,1800,2.0],
  ['SKU-049','Salsa de Tomate 400g','FrescoCampo','Salsas',4100,2300,5.0],
  ['SKU-050','Mayonesa 400g','FrescoCampo','Salsas',6200,3400,4.2],
  ['SKU-051','Mostaza 250g','FrescoCampo','Salsas',3500,1900,2.0],
  ['SKU-052','Vinagre Balsámico 250ml','FrescoCampo','Salsas',8800,4800,1.5],
  ['SKU-053','Salsa BBQ 350ml','FrescoCampo','Salsas',7200,3900,1.8],
  ['SKU-054','Salsa Soya 250ml','FrescoCampo','Salsas',5500,3000,1.2],
  ['SKU-055','Jugo de Naranja 1L','VitaFresh','Bebidas',5800,3200,6.5],
  ['SKU-056','Jugo de Manzana 1L','VitaFresh','Bebidas',6200,3500,4.0],
  ['SKU-057','Agua Mineral 600ml','VitaFresh','Bebidas',1800,900,3.5],
  ['SKU-058','Gaseosa Lima 1.5L','VitaFresh','Bebidas',4500,2200,2.8],
  ['SKU-059','Té Verde Botella 500ml','VitaFresh','Bebidas',3200,1700,2.0],
  ['SKU-060','Bebida Isotonica 600ml','VitaFresh','Bebidas',4800,2500,1.5],
  ['SKU-061','Harina de Trigo 1kg','HarinaOro','Harinas',3400,1900,4.5],
  ['SKU-062','Harina Integral 1kg','HarinaOro','Harinas',4100,2300,3.2],
  ['SKU-063','Sofrito Criollo 200g','SaborCriollo','Condimentos',3900,2100,3.8],
  ['SKU-064','Achiote en Pasta 100g','SaborCriollo','Condimentos',2800,1500,2.1],
  ['SKU-065','Granola Premium 400g','NutriVerde','Cereales',9800,5400,3.0],
  ['SKU-066','Cereal Integral 500g','NutriVerde','Cereales',7200,3900,2.5],
  ['SKU-067','Pan Tajado Integral','PanDorado','Panaderia',5200,2800,4.0],
  ['SKU-068','Tostadas Multigrano x12','PanDorado','Panaderia',4600,2500,2.8],
  ['SKU-069','Hamburguesa Res x4','CarneSelect','Carnes',12500,7200,5.5],
  ['SKU-070','Salchicha Premium x6','CarneSelect','Carnes',8900,4800,3.8],
  ['SKU-071','Pechuga de Pollo 500g','PolloFresco','Carnes',11200,6500,6.0],
  ['SKU-072','Nuggets de Pollo x12','PolloFresco','Carnes',9500,5200,3.5],
  ['SKU-073','Pizza Congelada Familiar','CongelaYa','Congelados',14800,8100,4.2],
  ['SKU-074','Empanadas Congeladas x8','CongelaYa','Congelados',8200,4500,3.0],
  ['SKU-075','Detergente Liquido 1L','LimpiMax','Limpieza',9200,5000,5.0],
  ['SKU-076','Suavizante 500ml','LimpiMax','Limpieza',6800,3600,3.5],
  ['SKU-077','Lavaplatos Crema 500g','BrillaSol','Limpieza',4500,2400,2.8],
  ['SKU-078','Limpiador Multiusos 500ml','BrillaSol','Limpieza',5800,3100,2.2],
  ['SKU-079','Papel Higienico x12','PapelSuave','Higiene',12800,7000,6.5],
  ['SKU-080','Servilletas x100','PapelSuave','Higiene',4200,2200,2.8],
  ['SKU-081','Jabon Liquido Manos 250ml','JabonVital','Higiene',5600,3000,3.2],
  ['SKU-082','Jabon en Barra x3','JabonVital','Higiene',4800,2600,2.0],
  ['SKU-083','Comida Perro Adulto 2kg','MascotaFeliz','Mascotas',22000,12000,4.8],
  ['SKU-084','Comida Gato Adulto 1.5kg','MascotaFeliz','Mascotas',18500,10200,3.5],
  ['SKU-085','Pañales Talla M x30','BebeStar','Bebes',28000,15500,7.0],
  ['SKU-086','Toallitas Humedas x80','BebeStar','Bebes',9800,5200,3.8],
  ['SKU-087','Vitamina C x60 tabletas','SaludPlus','Salud',15000,8200,3.0],
  ['SKU-088','Protector Solar SPF50 120ml','SaludPlus','Salud',24000,13000,2.5],
  ['SKU-089','Chocolate de Mesa 500g','ChocoAndes','Chocolates',6800,3700,4.0],
  ['SKU-090','Cocoa en Polvo 200g','ChocoAndes','Chocolates',5200,2800,2.5],
]

export const SEED_SKUS: Sku[] = skuRaw.map(([codigo, nombre, marca, categoria, pvp, costo, peso], i) => ({
  id: `sku-${String(i + 1).padStart(3, '0')}`,
  codigoSku: codigo,
  nombre,
  marca,
  categoria,
  pvpSugerido: pvp,
  costoVariable: costo,
  pesoProfitPool: peso,
}))

// ─── Competidores ─────────────────────────────────────────────────────────────
// [skuIdx, nombreCompetidor, skuCompetidor, esPrincipal]
const competidorRaw: [number, string, string, boolean][] = [
  [0,'MarcaRival','Arroz Blanco Rival 1kg',true],
  [0,'SuperArroz','Arroz Super Premium 1kg',false],
  [1,'MarcaRival','Arroz Integral Rival 1kg',true],
  [3,'ArrozNorte','Arroz Parboiled Norte 1kg',true],
  [5,'SushiPro','Arroz Sushi Import 500g',true],
  [6,'AceiteOro','Aceite Vegetal Oro 1L',true],
  [6,'AceiteSol','Aceite Girasol Sol 1L',false],
  [7,'OlivaExtra','Aceite Oliva Import 500ml',true],
  [9,'CocoNut','Aceite de Coco Tropical 250ml',true],
  [11,'GirasolMax','Aceite Girasol Premium 1L',true],
  [12,'LecheNorte','Leche Entera Norte 1L',true],
  [12,'LecheCampo','Leche Fresca Campo 1L',false],
  [14,'LecheAlpes','Leche Deslactosada Alpes 1L',true],
  [15,'QuesoCampo','Queso Crema Campo 200g',true],
  [17,'LechePolvo','Leche en Polvo Klim 400g',true],
  [20,'PastaRoma','Spaghetti Roma 500g',true],
  [22,'LasagnaChef','Lasagna Chef 500g',true],
  [24,'FideoCasa','Fideos Caseros 250g',true],
  [25,'AtunMar','Atun Van Camps 170g',true],
  [25,'AtunIsla','Atun Isla 170g',false],
  [27,'AtunAgua','Atun en Agua Isabel 170g',true],
  [28,'SalmonPacific','Salmon Ahumado Pacific 200g',true],
  [31,'CafeAguila','Cafe Molido Aguila 250g',true],
  [33,'CafeJuan','Cafe en Grano Juan Valdez 500g',true],
  [35,'NespressoGen','Capsulas Nespresso x10',true],
  [37,'AzucarIncauca','Azucar Blanca Incauca 1kg',true],
  [38,'AzucarManuelita','Azucar Morena Manuelita 1kg',true],
  [40,'PanelaDorada','Panela Pulverizada Dorada 500g',true],
  [43,'LentejaVerde','Lenteja Verde Import 500g',true],
  [44,'FrijolTio','Frijol Negro Tio Pelon 500g',true],
  [46,'GarbanzoChef','Garbanzo Premium Chef 500g',true],
  [48,'SalsaFruco','Salsa de Tomate Fruco 400g',true],
  [49,'MayoHellm','Mayonesa Hellmanns 400g',true],
  [52,'VinagreBadia','Vinagre Balsamico Badia 250ml',true],
  [54,'JugoHit','Jugo de Naranja Hit 1L',true],
  [56,'AguaBrisa','Agua Mineral Brisa 600ml',true],
  [57,'PostobonLima','Postobon Lima 1.5L',true],
  [60,'HazDeOros','Harina de Trigo HdO 1kg',true],
  [61,'HarinaApolo','Harina Integral Apolo 1kg',true],
  [62,'SofritoMaggi','Sofrito Criollo Maggi 200g',true],
  [63,'AchioteElRey','Achiote en Pasta El Rey 100g',true],
  [64,'GranolaQuaker','Granola Quaker 400g',true],
  [65,'CerealNestle','Cereal Integral Nestle 500g',true],
  [66,'PanBimbo','Pan Integral Bimbo',true],
  [67,'TostadasBimbo','Tostadas Bimbo Multigrano x12',true],
  [68,'HamburgZenu','Hamburguesa Zenu x4',true],
  [69,'SalchichRica','Salchicha Rica Premium x6',true],
  [70,'PechugaKokoriko','Pechuga Kokoriko 500g',true],
  [71,'NuggetsZenu','Nuggets Zenu x12',true],
  [72,'PizzaDiGiorno','Pizza DiGiorno Familiar',true],
  [73,'EmpanadasMcCain','Empanadas McCain x8',true],
  [74,'DetergFab','Detergente Fab Liquido 1L',true],
  [75,'SuavitelPrem','Suavitel Premium 500ml',true],
  [76,'AxionCrema','Lavaplatos Axion 500g',true],
  [77,'FabulosoLimp','Fabuloso Multiusos 500ml',true],
  [78,'FamiliaEco','Papel Higienico Familia x12',true],
  [79,'ServilletFam','Servilletas Familia x100',true],
  [80,'JabonProtex','Jabon Liquido Protex 250ml',true],
  [81,'JabonDove','Jabon Dove en Barra x3',true],
  [82,'DogChow','Dog Chow Adulto 2kg',true],
  [83,'CatChow','Cat Chow Adulto 1.5kg',true],
  [84,'PampersPrem','Pampers Premium Talla M x30',true],
  [85,'HuggiesWipes','Huggies Toallitas x80',true],
  [86,'VitaCRedoxon','Vitamina C Redoxon x60',true],
  [87,'NeutrogenaSPF','Neutrogena SPF50 120ml',true],
  [88,'ChocoCorona','Chocolate Corona 500g',true],
  [89,'CocoaChocolyne','Cocoa Chocolyne 200g',true],
]

export const SEED_COMPETIDORES: Competidor[] = competidorRaw.map(([skuIdx, nombre, skuComp, principal], i) => ({
  id: `comp-${String(i + 1).padStart(3, '0')}`,
  skuId: SEED_SKUS[skuIdx].id,
  nombreCompetidor: nombre,
  skuCompetidor: skuComp,
  esPrincipal: principal,
}))

// ─── Precios de mercado (3 meses × 6 retailers × 90 SKUs) ────────────────────
const RETAILERS = ['Exito', 'Jumbo', 'Olimpica', 'D1', 'Ara', 'Carulla']

function isoDate(monthsAgo: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - monthsAgo)
  return d.toISOString().split('T')[0]
}

export const SEED_PRECIOS_MERCADO: PrecioMercado[] = (() => {
  const rng = makeRng(42)
  const result: PrecioMercado[] = []
  let idx = 0
  for (const sku of SEED_SKUS) {
    for (const retailer of RETAILERS) {
      for (let month = 0; month < 3; month++) {
        const variacion = 1 + (rng() * 0.1 - 0.05)
        result.push({
          id: `pm-${String(++idx).padStart(5, '0')}`,
          skuId: sku.id,
          retailer,
          precioObservado: Math.round(sku.pvpSugerido * variacion),
          fechaScraping: isoDate(month),
          fuenteDato: 'manual',
        })
      }
    }
  }
  return result
})()

// ─── Precios de competidores (3 meses × 6 retailers × cada competidor) ────────
export const SEED_PRECIOS_COMPETIDOR: PrecioCompetidor[] = (() => {
  const rng = makeRng(42)
  // consumir los mismos valores que ya usó la generación de precios mercado
  // (el backend usa el mismo objeto Random continuo)
  // primero avanzamos el RNG con los precios de mercado ya generados
  for (let i = 0; i < SEED_PRECIOS_MERCADO.length; i++) rng()

  const result: PrecioCompetidor[] = []
  let idx = 0
  for (const comp of SEED_COMPETIDORES) {
    const sku = SEED_SKUS.find(s => s.id === comp.skuId)!
    for (const retailer of RETAILERS) {
      for (let month = 0; month < 3; month++) {
        const variacion = 1 + (rng() * 0.15 - 0.07)
        result.push({
          id: `pc-${String(++idx).padStart(5, '0')}`,
          competidorId: comp.id,
          retailer,
          precioObservado: Math.round(sku.pvpSugerido * variacion),
          fechaScraping: isoDate(month),
        })
      }
    }
  }
  return result
})()

// ─── Elasticidades (primeros 5 SKUs) ─────────────────────────────────────────
const volumenes = [15000, 8000, 5500, 12000, 3200]

export const SEED_ELASTICIDADES: Elasticidad[] = (() => {
  const rng = makeRng(42)
  return SEED_SKUS.slice(0, 5).map((sku, i) => ({
    id: `elas-${i + 1}`,
    skuId: sku.id,
    coeficiente: -1.0 - rng() * 0.8,
    confianza: 0.7 + rng() * 0.25,
    volumenBase: volumenes[i],
  }))
})()

// ─── Atributos por categoría ──────────────────────────────────────────────────
const catAtribRaw: [string, string[], number[], number[]][] = [
  ['Arroz',['Calidad','Disponibilidad','Marca','Presentación','Innovación'],[0.30,0.25,0.20,0.15,0.10],[4,4,3,3,3]],
  ['Aceites',['Calidad','Marca','Innovación','Disponibilidad','Presentación'],[0.30,0.25,0.20,0.15,0.10],[4,4,4,3,3]],
  ['Lacteos',['Calidad','Disponibilidad','Marca','Frescura','Presentación'],[0.25,0.25,0.20,0.20,0.10],[4,4,3,4,3]],
  ['Pastas',['Calidad','Marca','Disponibilidad','Presentación','Precio'],[0.30,0.25,0.20,0.15,0.10],[4,3,4,3,3]],
  ['Enlatados',['Calidad','Marca','Disponibilidad','Presentación','Innovación'],[0.30,0.25,0.20,0.15,0.10],[4,4,3,3,3]],
  ['Bebidas',['Calidad','Marca','Innovación','Disponibilidad','Presentación'],[0.25,0.25,0.20,0.15,0.15],[4,4,4,3,3]],
  ['Azucar',['Calidad','Disponibilidad','Marca','Presentación','Precio'],[0.30,0.25,0.20,0.15,0.10],[3,4,3,3,3]],
  ['Granos',['Calidad','Disponibilidad','Marca','Presentación','Innovación'],[0.30,0.25,0.20,0.15,0.10],[4,4,3,3,3]],
  ['Salsas',['Calidad','Marca','Innovación','Disponibilidad','Presentación'],[0.30,0.25,0.20,0.15,0.10],[4,3,3,3,3]],
  ['Harinas',['Calidad','Disponibilidad','Marca','Presentación','Precio'],[0.30,0.25,0.20,0.15,0.10],[4,4,3,3,3]],
  ['Condimentos',['Calidad','Marca','Innovación','Disponibilidad','Presentación'],[0.30,0.25,0.20,0.15,0.10],[4,3,3,3,3]],
  ['Cereales',['Calidad','Marca','Innovación','Disponibilidad','Presentación'],[0.25,0.25,0.20,0.15,0.15],[4,4,4,3,3]],
  ['Panaderia',['Calidad','Frescura','Marca','Disponibilidad','Presentación'],[0.25,0.25,0.20,0.20,0.10],[4,4,3,3,3]],
  ['Carnes',['Calidad','Frescura','Marca','Disponibilidad','Presentación'],[0.30,0.25,0.20,0.15,0.10],[4,4,3,3,3]],
  ['Congelados',['Calidad','Marca','Innovación','Disponibilidad','Presentación'],[0.30,0.25,0.20,0.15,0.10],[4,4,4,3,3]],
  ['Limpieza',['Calidad','Marca','Disponibilidad','Precio','Presentación'],[0.30,0.25,0.20,0.15,0.10],[3,3,4,3,3]],
  ['Higiene',['Calidad','Marca','Disponibilidad','Presentación','Precio'],[0.30,0.25,0.20,0.15,0.10],[3,3,4,3,3]],
  ['Mascotas',['Calidad','Marca','Innovación','Disponibilidad','Presentación'],[0.30,0.25,0.20,0.15,0.10],[4,4,3,3,3]],
  ['Bebes',['Calidad','Marca','Disponibilidad','Innovación','Presentación'],[0.30,0.25,0.20,0.15,0.10],[4,4,3,3,3]],
  ['Salud',['Calidad','Marca','Innovación','Disponibilidad','Presentación'],[0.30,0.25,0.20,0.15,0.10],[4,4,4,3,3]],
  ['Chocolates',['Calidad','Marca','Innovación','Disponibilidad','Presentación'],[0.30,0.25,0.20,0.15,0.10],[4,4,3,3,3]],
]

export const SEED_CATEGORIA_ATRIBUTOS: CategoriaAtributo[] = catAtribRaw.flatMap(
  ([cat, nombres, pesos, califs]) =>
    nombres.map((nombre, i) => ({
      id: `attr-${cat}-${i + 1}`,
      categoria: cat,
      nombreAtributo: nombre,
      peso: pesos[i],
      calificacion: califs[i],
      orden: i + 1,
    }))
)

// ─── Configuración canales/márgenes ──────────────────────────────────────────
export const SEED_CANALES_MARGENES = {
  iva: 19,
  canales: [
    { nombre: 'mayorista', margen: 15 },
    { nombre: 'retail', margen: 25 },
    { nombre: 'tat', margen: 35 },
  ],
  updatedAt: new Date().toISOString(),
  actualizadoPor: 'Consultor Demo',
}

// ─── Reglas de pricing ────────────────────────────────────────────────────────
export const SEED_REGLAS = [
  { tipoRegla: 'R-001', descripcion: 'Precio basado en Valor Percibido (VP)', configurada: true },
  { tipoRegla: 'R-002', descripcion: 'Diferencial máximo vs competidor (%)', configurada: true },
  { tipoRegla: 'R-003', descripcion: 'Umbral de alerta por desviación de PVP', configurada: true },
  { tipoRegla: 'R-004', descripcion: 'Margen mínimo por canal', configurada: true },
  { tipoRegla: 'R-005', descripcion: 'Precio óptimo por elasticidad', configurada: false },
  { tipoRegla: 'R-006', descripcion: 'Ajuste estacional de precios', configurada: false },
  { tipoRegla: 'R-007', descripcion: 'Precio de entrada por categoría', configurada: false },
  { tipoRegla: 'R-008', descripcion: 'Regla de precio ancla', configurada: false },
  { tipoRegla: 'R-009', descripcion: 'Descuento máximo autorizado (%)', configurada: false },
  { tipoRegla: 'R-010', descripcion: 'Paridad de precios entre canales', configurada: false },
  { tipoRegla: 'R-011', descripcion: 'Precio de liquidación', configurada: false },
]

// ─── Usuarios seed (para auth) ────────────────────────────────────────────────
export const SEED_USERS = [
  {
    id: 'user-admin-001',
    email: 'admin@prisier.com',
    password: '123456',
    nombreCompleto: 'Admin Prisier',
    rol: 'admin',
    tenantId: null as string | null,
    estado: 'activo',
  },
  {
    id: 'user-consultor-001',
    email: 'consultor@prisier.com',
    password: '123456',
    nombreCompleto: 'Consultor Demo',
    rol: 'consultor_pricer',
    tenantId: null as string | null,
    estado: 'activo',
  },
  {
    id: 'user-cliente-001',
    email: 'cliente@congrupo.com',
    password: '123456',
    nombreCompleto: 'Cliente ConGrupo',
    rol: 'cliente_comercial',
    tenantId: 'tenant-001',
    estado: 'activo',
  },
]
