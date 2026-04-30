import html2canvas from 'html2canvas'

export async function exportElementAsPng(element: HTMLElement, fileName: string) {
  const canvas = await html2canvas(element, {
    backgroundColor: '#0c0e15',
    scale: 2,
    useCORS: true,
    logging: false,
  })
  const dataUrl = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
