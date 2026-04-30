import * as XLSX from 'xlsx'

export function exportToExcel(
  rows: Record<string, unknown>[],
  options: { sheetName: string; fileName: string },
) {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, options.sheetName)
  XLSX.writeFile(wb, options.fileName)
}

export function todayStamp(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
