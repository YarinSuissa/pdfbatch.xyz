// Utility for computing file checksums using Web Crypto API

export async function computeFileChecksum(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

export interface FileWithChecksum {
  name: string
  size: number
  lastModified: number
  checksum: string
}

export async function createFileWithChecksum(file: File): Promise<FileWithChecksum> {
  const checksum = await computeFileChecksum(file)
  return {
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
    checksum
  }
}

export function filesMatch(file: File, storedFile: FileWithChecksum): boolean {
  return (
    file.name === storedFile.name &&
    file.size === storedFile.size &&
    file.lastModified === storedFile.lastModified
  )
}