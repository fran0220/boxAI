/** Data-URL / remote-URL to Blob helpers for multipart uploads. */

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/.exec(dataUrl)
  if (!match) return null
  const mime = match[1] || 'application/octet-stream'
  try {
    if (match[2]) {
      const binary = atob(match[3])
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return new Blob([bytes], { type: mime })
    }
    return new Blob([decodeURIComponent(match[3])], { type: mime })
  } catch {
    return null
  }
}

/** Resolves any image URL (data: or http(s)) to a Blob; http fetch may fail on CORS. */
export async function imageUrlToBlob(url: string): Promise<Blob> {
  if (url.startsWith('data:')) {
    const blob = dataUrlToBlob(url)
    if (!blob) throw new Error('invalid data url')
    return blob
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return res.blob()
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
