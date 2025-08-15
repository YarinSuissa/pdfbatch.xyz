import React, { useState, useEffect } from 'react'
import { GenerationProgress, FieldMapping, NamingTemplate } from '../../types'
import { Download, Clock, CheckCircle, AlertCircle, Package } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import JSZip from 'jszip'
import { log } from '../../utils/logger'

interface GenerateStepProps {
  fieldMappings: FieldMapping[]
  namingTemplate: NamingTemplate
  csvData: Record<string, string>[]
  pdfFile: { file: File }
  onGenerationComplete: (downloadUrl: string, expiresAt: string) => void
  onGenerationStarted?: () => void
}

function KoFiNudge({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="rounded-xl shadow-lg border border-slate-200 bg-white/95 backdrop-blur px-3 py-2 flex items-center gap-3">
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-100 text-slate-500"
          aria-label="Dismiss"
          title="Dismiss"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
        <a
          href="https://ko-fi.com/M4M11I0T5G"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
            <path d="M3 7h12a3 3 0 0 1 3 3c0 1.437-.982 2.64-2.298 2.93A6.5 6.5 0 0 1 9.5 19H7A4 4 0 0 1 3 15V7zm14 3a1 1 0 0 0-1-1h-1v2h1a1 1 0 0 0 1-1z" fill="currentColor"/>
          </svg>
          Support me on Ko-fi
        </a>
      </div>
    </div>
  );
}

export function GenerateStep({
  fieldMappings,
  namingTemplate,
  csvData,
  pdfFile,
  onGenerationComplete,
  onGenerationStarted
}: GenerateStepProps) {
  const [progress, setProgress] = useState<GenerationProgress>({
    current: 0,
    total: csvData.length,
    status: 'idle',
    message: 'Ready to generate PDFs'
  })
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [fileCount, setFileCount] = useState<number>(0)
  const [detailedStatus, setDetailedStatus] = useState<string>('')
  const [showDetails, setShowDetails] = useState(false)
  const [showKoFiNudge, setShowKoFiNudge] = useState(false)

  useEffect(() => {
    if (!downloadUrl) return;
    setShowKoFiNudge(true);
    const t = setTimeout(() => setShowKoFiNudge(false), 12000);
    return () => clearTimeout(t);
  }, [downloadUrl]);

  const generateZipInBrowser = async ({
    templateFile,
    rows,
    mappings,
    namingTemplate,
    onProgress
  }: {
    templateFile: File
    rows: Record<string, string>[]
    mappings: FieldMapping[]
    namingTemplate: NamingTemplate
    onProgress: (current: number, message: string) => void
  }) => {
    log.info('[Client PDF Generation] Starting browser-based PDF generation...')
    
    // Fetch template and font in parallel
    onProgress(0, 'Downloading template and font files...')
    const [fontBytes] = await Promise.all([
      fetch('/fonts/DavidLibre-Regular.ttf').then(r => {
        if (!r.ok) throw new Error(`Failed to fetch Hebrew font: ${r.statusText}`)
        return r.arrayBuffer()
      })
    ])
    
    // Read template file directly
    const templateBytes = await templateFile.arrayBuffer()
    
    log.info('[Client PDF Generation] Template and font downloaded successfully')
    log.debug('[Client PDF Generation] Template size:', templateBytes.byteLength, 'bytes')
    log.debug('[Client PDF Generation] Font size:', fontBytes.byteLength, 'bytes')
    
    const zip = new JSZip()
    const usedFilenames = new Set<string>()

    // Process in small chunks to keep UI responsive
    const chunkSize = 5 // Smaller chunks for better responsiveness
    for (let i = 0; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize)
      
      for (const [chunkIdx, row] of slice.entries()) {
        const globalIdx = i + chunkIdx
        const rowNumber = globalIdx + 1
        
        log.debug(`[Client PDF Generation] Processing row ${rowNumber}/${rows.length}`)
        onProgress(globalIdx, `Generating PDF ${rowNumber} of ${rows.length}...`)
        
        try {
          // Load PDF document for this row
          const pdfDoc = await PDFDocument.load(templateBytes)
          pdfDoc.registerFontkit(fontkit)
          
          // Embed Hebrew font
          const hebrewFont = await pdfDoc.embedFont(fontBytes, { subset: true })
          const form = pdfDoc.getForm()
          
          // Fill form fields
          for (const mapping of mappings) {
            try {
              const field = form.getField(mapping.fieldName)
              const value = String(row[mapping.columnName] || '')
              
              if (field && value) {
                // Remove bidi controls and normalize, then add RTL marks for Hebrew
                const cleanValue = value.normalize('NFC').replace(/[\u202A-\u202E]/g, '')
                const processedValue = bidiHebrewForFields(cleanValue)
                
                if (typeof (field as any).setText === 'function') {
                  (field as any).setText(processedValue)
                  
                  // Set right alignment for Hebrew text  
                  const hasHebrew = /\p{Script=Hebrew}/u.test(cleanValue)
                  if (hasHebrew && typeof (field as any).setAlignment === 'function') {
                    (field as any).setAlignment('Right')
                  }
                }
              }
            } catch (fieldError) {
              log.warn(`[Client PDF Generation] Error filling field ${mapping.fieldName}:`, fieldError)
            }
          }
          
          // Update all field appearances with Hebrew font
          form.updateFieldAppearances(hebrewFont)
          
          // Generate filename using naming template
          let filename = namingTemplate.template
          namingTemplate.placeholders.forEach(placeholder => {
            let value = ''
            if (placeholder === 'Row_Number') {
              value = String(rowNumber)
            } else if (placeholder === 'Timestamp') {
              value = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')
            } else if (row[placeholder]) {
              value = row[placeholder]
            }
            
            // Sanitize filename with Unicode support
            const sanitizeFilename = (input: string) => {
              let s = String(input).normalize('NFC')
              s = s.replace(/[\u200E\u200F\u202A-\u202E]/g, '')
              s = s.replace(/[^\p{L}\p{N} ._\-\u05F3\u05F4]/gu, '_')
              s = s.replace(/\s+/g, ' ').replace(/_+/g, '_').trim()
              return s.slice(0, 120)
            }
            
            value = sanitizeFilename(value)
            filename = filename.replace(`{${placeholder}}`, value)
          })
          
          // Ensure .pdf extension
          if (!filename.toLowerCase().endsWith('.pdf')) {
            filename += '.pdf'
          }
          
          // Handle duplicates
          let uniqueFilename = filename
          let counter = 1
          while (usedFilenames.has(uniqueFilename)) {
            const extensionIndex = filename.lastIndexOf('.')
            const name = filename.substring(0, extensionIndex)
            const ext = filename.substring(extensionIndex)
            uniqueFilename = `${name}_${counter}${ext}`
            counter++
          }
          usedFilenames.add(uniqueFilename)
          
          // Save PDF and add to ZIP
          const pdfBytes = await pdfDoc.save()
          zip.file(uniqueFilename, pdfBytes)
          
          log.debug(`[Client PDF Generation] Generated ${uniqueFilename}, size: ${pdfBytes.byteLength} bytes`)
          
        } catch (rowError) {
          log.error(`[Client PDF Generation] Error processing row ${rowNumber}:`, rowError)
          throw new Error(`Failed to process row ${rowNumber}: ${rowError.message}`)
        }
      }
      
      // Yield back to the main thread between chunks
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    onProgress(rows.length, 'Creating ZIP archive...')
    log.info('[Client PDF Generation] Creating ZIP archive...')
    
    const zipBlob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })
    
    log.info('[Client PDF Generation] ZIP archive created, size:', zipBlob.size, 'bytes')
    return zipBlob
  }

  // Bidi control characters that PDF viewers actually respect in form fields
  const LRM = '\u200E' // Left-to-Right Mark
  const RLM = '\u200F' // Right-to-Left Mark
  const LRE = '\u202A' // Left-to-Right Embedding
  const PDF_BIDI = '\u202C' // Pop Directional Formatting
  const NUMBER_RE = /\d+(?:[.,]\d+)*/g

  /**
   * Robust bidi fix for Hebrew-with-digits inside PDF form fields.
   * 1) Set base to RTL with a single RLM at the start (if Hebrew present).
   * 2) Wrap each numeric run with LRE...PDF (older control that PDF viewers honor).
   * 3) Also sandwich numbers with LRM on both sides in case the viewer ignores LRE/PDF.
   */
  function bidiHebrewForFields(input: unknown): string {
    let s = String(input ?? '').normalize('NFC')

    const hasHebrew = /\p{Script=Hebrew}/u.test(s)
    // Strong LTR for numbers (LRE/PDF) + LRMs as guard rails
    s = s.replace(NUMBER_RE, (m) => `${LRM}${LRE}${m}${PDF_BIDI}${LRM}`)

    // Base RTL bias if Hebrew exists
    if (hasHebrew) s = `${RLM}${s}`

    return s
  }

  const downloadZipDirectly = (zipBlob: Blob) => {
    log.info('[Client PDF Generation] Triggering direct download...')
    
    const filename = `generated-pdfs-${Date.now()}.zip`
    
    // Create object URL for direct download
    const url = URL.createObjectURL(zipBlob)
    
    // Create temporary download link and click it
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    
    // Clean up object URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    
    log.info('[Client PDF Generation] Download initiated')
    
    return {
      url,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
    }
  }

  const startGeneration = async () => {
    // Track that generation has started
    onGenerationStarted?.()
    
    setProgress({
      current: 0,
      total: csvData.length,
      status: 'processing',
      message: 'Initializing PDF generation...'
    })
    setDetailedStatus('Starting client-side PDF generation...')

    try {
      setDetailedStatus(`Processing ${csvData.length} PDFs in browser...`)

      // Generate ZIP in browser with progress tracking
      const zipBlob = await generateZipInBrowser({
        templateFile: pdfFile.file,
        rows: csvData,
        mappings: fieldMappings,
        namingTemplate,
        onProgress: (current, message) => {
          const progressPercent = Math.round((current / csvData.length) * 90) // Reserve 10% for upload
          setProgress({
            current,
            total: csvData.length,
            status: 'processing',
            message
          })
          setDetailedStatus(`${message} (${current}/${csvData.length})`)
        }
      })

      setProgress({
        current: csvData.length,
        total: csvData.length,
        status: 'processing',
        message: 'Uploading ZIP archive...'
      })
      setDetailedStatus('Uploading ZIP archive to storage...')

      // Trigger direct download
      const { url, expiresAt } = downloadZipDirectly(zipBlob)

      setDownloadUrl(url)
      setFileCount(csvData.length)
      setProgress({
        current: csvData.length,
        total: csvData.length,
        status: 'completed',
        message: `Generated ${csvData.length} PDF files successfully!`
      })
      setDetailedStatus('Generation completed successfully!')

      onGenerationComplete(url, expiresAt)

    } catch (error) {
      log.error('Generation error:', error)
      setProgress({
        current: 0,
        total: csvData.length,
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate PDFs. Please try again.'
      })
      setDetailedStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const getProgressPercentage = () => {
    if (progress.total === 0) return 0
    return Math.round((progress.current / progress.total) * 100)
  }

  const getProgressColor = () => {
    const percentage = getProgressPercentage()
    if (percentage < 33) return 'from-yellow-400 to-yellow-500'
    if (percentage < 66) return 'from-yellow-500 to-orange-500'
    return 'from-orange-500 to-red-500'
  }

  return (
    <div className="space-y-8">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Generate & Download PDFs
        </h2>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          Review your configuration and generate the PDF files. All processing happens in your browser for maximum performance.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Configuration Summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Generation Summary
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">PDF Template</span>
                <span className="font-medium text-gray-900">{pdfFile.file.name}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">CSV Rows</span>
                <span className="font-medium text-gray-900">{csvData.length}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Field Mappings</span>
                <span className="font-medium text-gray-900">{fieldMappings.length}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Naming Template</span>
                <span className="font-medium text-gray-900 font-mono text-sm">{namingTemplate.template}</span>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Expected Output</span>
                <span className="font-medium text-gray-900">{csvData.length} PDF files + ZIP</span>
              </div>
            </div>
          </div>

          {progress.status === 'idle' && (
            <button
              onClick={startGeneration}
              className="w-full bg-red-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:bg-red-700 transition-colors flex items-center justify-center space-x-3"
            >
              <Package className="w-6 h-6" />
              <span>Generate PDF Archive</span>
            </button>
          )}
        </div>

        {/* Progress and Download */}
        <div className="space-y-6">
          {progress.status !== 'idle' && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                {progress.status === 'completed' ? (
                  <CheckCircle className="w-6 h-6 mr-2 text-green-600" />
                ) : progress.status === 'error' ? (
                  <AlertCircle className="w-6 h-6 mr-2 text-red-600" />
                ) : (
                  <Package className="w-6 h-6 mr-2 text-orange-600" />
                )}
                Generation Progress
              </h3>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>{progress.message}</span>
                    <span>{progress.current} / {progress.total}</span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full bg-gradient-to-r ${getProgressColor()} transition-all duration-300`}
                      style={{ width: `${getProgressPercentage()}%` }}
                    />
                  </div>
                  
                  <div className="text-center mt-2">
                    <span className="text-2xl font-bold text-gray-900">
                      {getProgressPercentage()}%
                    </span>
                  </div>
                </div>

                {/* Detailed Status for Development */}
                <div className="border-t pt-4">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
                  >
                    {showDetails ? 'Hide' : 'Show'} Technical Details
                  </button>
                  
                  {showDetails && (
                    <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono text-gray-600">
                      <div className="mb-2">
                        <strong>Status:</strong> {detailedStatus}
                      </div>
                      <div className="text-xs text-gray-500">
                        Check browser console for more details
                      </div>
                    </div>
                  )}
                </div>

                {progress.status === 'processing' && (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                    <span className="ml-2 text-gray-600">
                      Processing in your browser...
                    </span>
                  </div>
                )}
                
                {progress.status === 'error' && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-red-800 font-medium">Generation Failed</h4>
                        <p className="text-red-700 mt-1">{progress.message}</p>
                        <button
                          onClick={startGeneration}
                          className="mt-3 text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors"
                        >
                          Retry Generation
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {downloadUrl && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Download className="w-6 h-6 mr-2 text-green-600" />
                Download Ready
              </h3>

              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-green-800">ZIP Archive Ready</p>
                      <p className="text-sm text-green-600">
                        Contains {fileCount} PDF files
                      </p>
                    </div>
                  </div>
                </div>

                <a
                  href={downloadUrl}
                  download="generated-pdfs.zip"
                  className="w-full bg-green-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-3"
                >
                  <Download className="w-6 h-6" />
                  <span>Download ZIP Archive</span>
                </a>

                <div className="text-center">
                  <p className="text-sm text-gray-500">
                    Your {fileCount} PDF files are ready for download as a ZIP archive.
                  </p>
                </div>


                <div className="pt-2 text-center text-sm text-gray-500">
                  Found this useful?{" "}
                  <a
                    href="https://ko-fi.com/M4M11I0T5G"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 transition"
                  >
                    {/* Ko-fi cup icon (inline SVG, no external script) */}
                    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                      <path d="M3 7h12a3 3 0 0 1 3 3c0 1.437-.982 2.64-2.298 2.93A6.5 6.5 0 0 1 9.5 19H7A4 4 0 0 1 3 15V7zm14 3a1 1 0 0 0-1-1h-1v2h1a1 1 0 0 0 1-1z" fill="currentColor"/>
                    </svg>
                    Support me on Ko-fi
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showKoFiNudge && <KoFiNudge onClose={() => setShowKoFiNudge(false)} />}
    </div>
  )
}