import { PDFDocument, PDFForm, PDFField as LibPDFField } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFField } from '../types'
import { log } from './logger'

// Configure PDF.js worker with ES module
if (typeof window !== 'undefined') {
  import('pdfjs-dist/build/pdf.worker.mjs?url').then(({ default: pdfjsWorker }) => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker
  })
}

export async function extractPDFFields(file: File): Promise<PDFField[]> {
  log.debug('[PDF Utils] Starting PDF field extraction for file:', file.name)
  log.debug('[PDF Utils] File size:', (file.size / 1024 / 1024).toFixed(2), 'MB')
  
  try {
    log.debug('[PDF Utils] Converting file to ArrayBuffer...')
    const arrayBuffer = await file.arrayBuffer()
    log.debug('[PDF Utils] ArrayBuffer size:', arrayBuffer.byteLength, 'bytes')
    
    log.debug('[PDF Utils] Loading PDF document with pdf-lib...')
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    log.debug('[PDF Utils] PDF document loaded successfully')
    
    log.debug('[PDF Utils] Getting form from PDF document...')
    const form = pdfDoc.getForm()
    log.debug('[PDF Utils] Form retrieved successfully')
    
    const fields: PDFField[] = []

    try {
      log.debug('[PDF Utils] Getting form fields...')
      const formFields = form.getFields()
      log.debug('[PDF Utils] Found', formFields.length, 'form fields')
      
      formFields.forEach((field: LibPDFField, index: number) => {
        try {
          log.debug(`[PDF Utils] Processing field ${index + 1}/${formFields.length}:`, field.getName())
          
          const fieldName = field.getName()
          const widgets = (field as any).acroField.getWidgets()
          
          log.debug(`[PDF Utils] Field "${fieldName}" has ${widgets.length} widgets`)
          
          if (widgets.length > 0) {
            const widget = widgets[0]
            const rect = widget.getRectangle()
            const pageRef = widget.P()
            const pages = pdfDoc.getPages()
            const pageIndex = pages.findIndex(page => (page as any).ref === pageRef) || 0
            
            const fieldData = {
              id: `field-${index}`,
              name: fieldName,
              type: field.constructor.name.replace('PDF', '').toLowerCase(),
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              pageIndex
            }
            
            log.debug(`[PDF Utils] Field "${fieldName}" processed:`, fieldData)
            fields.push(fieldData)
          } else {
            log.warn(`[PDF Utils] Field "${fieldName}" has no widgets, skipping`)
          }
        } catch (fieldError) {
          log.error(`[PDF Utils] Error processing field ${index}:`, fieldError)
        }
      })
    } catch (fieldsError) {
      log.error('[PDF Utils] Error extracting PDF fields:', fieldsError)
      throw new Error(`Failed to extract form fields: ${fieldsError.message}`)
    }

    log.debug('[PDF Utils] Field extraction completed. Total fields:', fields.length)
    return fields
    
  } catch (error) {
    log.error('[PDF Utils] Error in extractPDFFields:', error)
    throw new Error(`PDF field extraction failed: ${error.message}`)
  }
}

export async function generatePDFPreview(file: File): Promise<{
  dataUrl: string
  pageWidth: number  // CropBox width
  pageHeight: number // CropBox height
  rotation: number   // 0|90|180|270
  cropX: number      // CropBox left
  cropY: number      // CropBox bottom
  cropWidth: number  // CropBox width
  cropHeight: number // CropBox height
}> {
  log.debug('[PDF Utils] Starting PDF preview generation')
  
  try {
    log.debug('[PDF Utils] Converting file to ArrayBuffer for preview...')
    const arrayBuffer = await file.arrayBuffer()
    
    log.debug('[PDF Utils] Loading PDF with PDF.js for rendering...')
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdfDoc = await loadingTask.promise
    log.debug('[PDF Utils] PDF.js document loaded, total pages:', pdfDoc.numPages)
    
    // Get the first page
    const page = await pdfDoc.getPage(1)
    
    // Get page dimensions and rotation
    const rotation = page.rotate || 0
    const mediaBox = page.getViewport({ scale: 1.0, rotation: 0 }).viewBox  // [x1, y1, x2, y2]
    const cropBox = page.view || mediaBox // CropBox if available, otherwise MediaBox
    
    log.debug('[PDF Utils] Page rotation:', rotation)
    log.debug('[PDF Utils] MediaBox:', mediaBox)
    log.debug('[PDF Utils] CropBox:', cropBox)
    
    // Calculate crop dimensions properly
    const cropX = cropBox[0]
    const cropY = cropBox[1] 
    const cropWidth = cropBox[2] - cropBox[0]
    const cropHeight = cropBox[3] - cropBox[1]
    
    const viewport = page.getViewport({ scale: 1.5 })
    
    log.debug('[PDF Utils] Page viewport:', viewport.width, 'x', viewport.height)
    log.debug('[PDF Utils] Crop dimensions:', { cropX, cropY, cropWidth, cropHeight })
    
    // Create canvas
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
    canvas.width = viewport.width
    canvas.height = viewport.height
    
    // Render PDF page
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    }
    
    log.debug('[PDF Utils] Rendering PDF page to canvas...')
    await page.render(renderContext).promise
    log.debug('[PDF Utils] PDF page rendered successfully')
    
    const dataUrl = canvas.toDataURL()
    log.debug('[PDF Utils] Canvas converted to data URL, length:', dataUrl.length)
    
    return {
      dataUrl,
      pageWidth: cropWidth,   // Use crop dimensions for consistency
      pageHeight: cropHeight,
      rotation,
      cropX,
      cropY,
      cropWidth,
      cropHeight
    }
    
  } catch (error) {
    log.error('[PDF Utils] Error in generatePDFPreview:', error)
    throw new Error(`PDF preview generation failed: ${error.message}`)
  }
}