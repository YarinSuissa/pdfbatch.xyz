import { extractPDFFields, generatePDFPreview } from './pdfUtils'
import { parseCSV, validateCSVStructure } from './csvUtils'
import { UploadedFile, PDFField, CSVColumn } from '../types'
import { log } from './logger'

export async function processUploadedFiles(
  pdfFile: File,
  csvFile: File
): Promise<{
  pdfUpload: UploadedFile
  csvUpload: UploadedFile
  pdfFields: PDFField[]
  csvData: { columns: CSVColumn[], data: Record<string, string>[] }
}> {
  log.info('[FileProcessing] Processing files client-side only')
  
  const results = await Promise.allSettled([
    processPDFFile(pdfFile),
    processCSVFile(csvFile)
  ])

  const pdfResult = results[0]
  const csvResult = results[1]

  if (pdfResult.status === 'rejected') {
    throw new Error(`PDF processing failed: ${pdfResult.reason.message}`)
  }

  if (csvResult.status === 'rejected') {
    throw new Error(`CSV processing failed: ${csvResult.reason.message}`)
  }

  return {
    pdfUpload: pdfResult.value.uploadedFile,
    csvUpload: csvResult.value.uploadedFile,
    pdfFields: pdfResult.value.fields,
    csvData: csvResult.value.data
  }
}

async function processPDFFile(file: File): Promise<{
  uploadedFile: UploadedFile
  fields: PDFField[]
}> {
  const errors: string[] = []

  // Declare metadata at function scope to avoid reference errors
  let metadata = {
    fields: 0,
    pageCount: 1,
    pageWidth: 595,
    pageHeight: 842,
    rotation: 0,
    cropX: 0,
    cropY: 0,
    cropWidth: 595,
    cropHeight: 842
  }

  // Validate file size (25MB max)
  if (file.size > 25 * 1024 * 1024) {
    errors.push('PDF file is too large (max 25MB)')
  }

  // Validate file type
  if (!file.type.includes('pdf')) {
    errors.push('File must be a PDF')
  }

  let fields: PDFField[] = []
  let preview: string | undefined

  if (errors.length === 0) {
    try {
      // Extract fields and render preview
      fields = await extractPDFFields(file)
      if (fields.length === 0) {
        errors.push('PDF contains no fillable form fields')
      }

      const previewResult = await generatePDFPreview(file)
      preview = previewResult.dataUrl
          
      // Store complete crop/rotation metadata for proper overlay positioning
      metadata = {
        fields: fields.length,
        pageCount: 1,
        pageWidth: previewResult.cropWidth,   // Use crop dimensions
        pageHeight: previewResult.cropHeight,
        rotation: previewResult.rotation,
        cropX: previewResult.cropX,
        cropY: previewResult.cropY,
        cropWidth: previewResult.cropWidth,
        cropHeight: previewResult.cropHeight
      }
      
      log.info('[Processing] PDF processed successfully, fields:', fields.length)
          
      // Normalize field coordinates to CropBox coordinate space
      fields = fields.map(field => ({
        ...field,
        x: field.x - previewResult.cropX,  // Normalize to crop space
        y: field.y - previewResult.cropY   // Keep bottom-left origin
      }))
          
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      log.error('PDF processing error:', errorMessage)
      errors.push(`Failed to process PDF file: ${errorMessage}`)
    }
  }

  const uploadedFile: UploadedFile = {
    id: `pdf-${crypto.randomUUID()}`,
    file,
    preview,
    metadata: {
      fields: fields.length,
      pageCount: 1,
      pageWidth: metadata.pageWidth,
      pageHeight: metadata.pageHeight,
      rotation: metadata.rotation,
      cropX: metadata.cropX,
      cropY: metadata.cropY,
      cropWidth: metadata.cropWidth,
      cropHeight: metadata.cropHeight
    },
    valid: errors.length === 0,
    errors
  }

  return { uploadedFile, fields }
}

async function processCSVFile(file: File): Promise<{
  uploadedFile: UploadedFile
  data: { columns: CSVColumn[], data: Record<string, string>[] }
}> {
  const errors: string[] = []

  // Validate file size (10MB max)
  if (file.size > 10 * 1024 * 1024) {
    errors.push('CSV file is too large (max 10MB)')
  }

  // Validate file type
  if (!file.name.toLowerCase().endsWith('.csv') && !file.type.includes('csv')) {
    errors.push('File must be a CSV')
  }

  let columns: CSVColumn[] = []
  let data: Record<string, string>[] = []

  if (errors.length === 0) {
    try {
      // Parse CSV
      const csvResult = await parseCSV(file)
      const structureErrors = validateCSVStructure(csvResult.columns, csvResult.data)
      
      errors.push(...csvResult.errors, ...structureErrors)
      
      if (errors.length === 0) {
        columns = csvResult.columns
        data = csvResult.data
        log.info('[Processing] CSV processed successfully, rows:', data.length, 'columns:', columns.length)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      log.error('CSV processing error:', errorMessage)
      errors.push(`Failed to process CSV file: ${errorMessage}`)
    }
  }

  const uploadedFile: UploadedFile = {
    id: `csv-${crypto.randomUUID()}`,
    file,
    metadata: { 
      columns: columns.length,
      rows: data.length
    },
    valid: errors.length === 0,
    errors
  }

  return { uploadedFile, data: { columns, data } }
}