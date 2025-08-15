export interface PDFField {
  id: string
  name: string
  type: string
  x: number
  y: number
  width: number
  height: number
  pageIndex: number
}

export interface CSVColumn {
  id: string
  name: string
  type: string
  sampleData: string[]
}

export interface FieldMapping {
  fieldId: string
  columnId: string
  fieldName: string
  columnName: string
}

export interface NamingTemplate {
  template: string
  placeholders: string[]
  preview: string[]
}

export interface GenerationProgress {
  current: number
  total: number
  status: 'idle' | 'processing' | 'completed' | 'error'
  message: string
}

export interface WizardStep {
  id: number
  title: string
  description: string
  completed: boolean
  active: boolean
}

export interface UploadedFile {
  id: string
  file: File
  preview?: string
  metadata?: {
    fields?: number
    pageCount?: number
    columns?: number
    rows?: number
    pageWidth?: number   // CropBox width
    pageHeight?: number  // CropBox height  
    rotation?: number    // 0|90|180|270
    cropX?: number       // CropBox left
    cropY?: number       // CropBox bottom
    cropWidth?: number   // CropBox width
    cropHeight?: number  // CropBox height
  }
  valid: boolean
  errors: string[]
}