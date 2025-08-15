// Job storage utilities for managing incomplete jobs via cookies
import { log } from './logger'
import { FileWithChecksum } from './checksumUtils'

export interface StoredJobData {
  jobId: string
  lastAction: 'files_uploaded' | 'mapping_changed' | 'step2_next' | 'naming_changed' | 'step3_next' | 'generation_started'
  pdfFile: FileWithChecksum & {
    preview?: string
    metadata?: any
  }
  csvFile: FileWithChecksum & {
    metadata?: any
  }
  pdfFields: Array<{
    id: string
    name: string
    type: string
    x: number
    y: number
    width: number
    height: number
    pageIndex: number
  }>
  csvData: {
    columns: Array<{
      id: string
      name: string
      type: string
      sampleData: string[]
    }>
    data: Record<string, string>[]
  }
  fieldMappings: Array<{
    fieldId: string
    columnId: string
    fieldName: string
    columnName: string
  }>
  namingTemplate: {
    template: string
    placeholders: string[]
    preview: string[]
  }
  timestamp: number
}

const STORAGE_KEY = 'pdf_generator_incomplete_job'
const EXPIRY_DAYS = 7 // Jobs expire after 7 days

export function saveIncompleteJob(data: StoredJobData): void {
  try {
    const jobData = {
      ...data,
      timestamp: Date.now()
    }
    
    // Store in cookie (for cross-session persistence)
    const cookieValue = encodeURIComponent(JSON.stringify(jobData))
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + EXPIRY_DAYS)
    
    document.cookie = `${STORAGE_KEY}=${cookieValue}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Strict`
    
    // Also store in localStorage as backup
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobData))
    
    log.debug('[JobStorage] Incomplete job saved:', data.jobId)
  } catch (error) {
    log.error('[JobStorage] Failed to save incomplete job:', error)
  }
}

export function getIncompleteJob(): StoredJobData | null {
  try {
    // Try cookie first
    const cookies = document.cookie.split(';')
    const jobCookie = cookies.find(cookie => cookie.trim().startsWith(`${STORAGE_KEY}=`))
    
    let jobDataStr: string | null = null
    
    if (jobCookie) {
      jobDataStr = decodeURIComponent(jobCookie.split('=')[1])
    } else {
      // Fallback to localStorage
      jobDataStr = localStorage.getItem(STORAGE_KEY)
    }
    
    if (!jobDataStr) {
      return null
    }
    
    const jobData: StoredJobData = JSON.parse(jobDataStr)
    
    // Check if job has expired
    const daysSinceStored = (Date.now() - jobData.timestamp) / (1000 * 60 * 60 * 24)
    if (daysSinceStored > EXPIRY_DAYS) {
      log.debug('[JobStorage] Incomplete job expired, removing')
      clearIncompleteJob()
      return null
    }
    
    log.debug('[JobStorage] Incomplete job found:', jobData.jobId)
    return jobData
    
  } catch (error) {
    log.error('[JobStorage] Failed to retrieve incomplete job:', error)
    clearIncompleteJob() // Clear corrupted data
    return null
  }
}

export function clearIncompleteJob(): void {
  try {
    // Clear cookie
    document.cookie = `${STORAGE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`
    
    // Clear localStorage
    localStorage.removeItem(STORAGE_KEY)
    
    log.debug('[JobStorage] Incomplete job cleared')
  } catch (error) {
    log.error('[JobStorage] Failed to clear incomplete job:', error)
  }
}

export function hasIncompleteJob(): boolean {
  return getIncompleteJob() !== null
}