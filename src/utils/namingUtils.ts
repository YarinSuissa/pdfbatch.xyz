import { CSVColumn, PDFField, NamingTemplate } from '../types'

function sanitizeFilename(input: unknown): string {
  // 1) Normalize to NFC so letters + niqqud compose consistently
  let s = String(input ?? '').normalize('NFC')

  // 2) Remove invisible bidi controls that often leak from CSV/Excel
  //    U+200E LRM, U+200F RLM, U+202A..U+202E embedding/override marks
  s = s.replace(/[\u200E\u200F\u202A-\u202E]/g, '')

  // 3) Allow: any letters/numbers (all scripts), space, dot, underscore, hyphen,
  //    and Hebrew geresh/gershayim (׳ ״). Everything else -> underscore.
  s = s.replace(/[^\p{L}\p{N} ._\-\u05F3\u05F4]/gu, '_')

  // 4) Collapse repeats and trim
  s = s.replace(/\s+/g, ' ').replace(/_+/g, '_').trim()

  // 5) Keep filenames reasonable
  return s.slice(0, 120)
}

export function parseNamingTemplate(template: string): {
  placeholders: string[]
  isValid: boolean
  errors: string[]
} {
  const placeholderRegex = /\{([^}]+)\}/g
  const placeholders: string[] = []
  const errors: string[] = []
  let match

  while ((match = placeholderRegex.exec(template)) !== null) {
    placeholders.push(match[1])
  }

  // Validate template syntax
  const openBraces = (template.match(/\{/g) || []).length
  const closeBraces = (template.match(/\}/g) || []).length
  
  if (openBraces !== closeBraces) {
    errors.push('Mismatched braces in template')
  }

  const isValid = errors.length === 0 && placeholders.length > 0

  return { placeholders, isValid, errors }
}

export function generatePreviewFilenames(
  template: string,
  columns: CSVColumn[],
  fields: PDFField[],
  sampleData: Record<string, string>[]
): string[] {
  const { placeholders } = parseNamingTemplate(template)
  const previews: string[] = []
  
  sampleData.slice(0, 3).forEach((row, index) => {
    let filename = template
    
    placeholders.forEach(placeholder => {
      let value = ''
      
      // Check if it's a column name
      const column = columns.find(col => col.name === placeholder)
      if (column) {
        value = row[column.name] || `Sample_${index + 1}`
      } else {
        // Check if it's a field name
        const field = fields.find(f => f.name === placeholder)
        if (field) {
          value = `Field_${field.name}_Value`
        } else if (placeholder === 'Row_Number') {
          value = String(index + 1)
        } else if (placeholder === 'Timestamp') {
          value = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')
        } else {
          value = `Unknown_${placeholder}`
        }
      }
      
      // Sanitize filename with Unicode support
      value = sanitizeFilename(value)
      filename = filename.replace(`{${placeholder}}`, value)
    })
    
    // Ensure .pdf extension
    if (!filename.toLowerCase().endsWith('.pdf')) {
      filename += '.pdf'
    }
    
    previews.push(filename)
  })
  
  return previews
}

export function generateUniqueFilename(
  baseFilename: string,
  existingFilenames: Set<string>
): string {
  let filename = baseFilename
  let counter = 1
  
  while (existingFilenames.has(filename)) {
    const extensionIndex = baseFilename.lastIndexOf('.')
    if (extensionIndex > 0) {
      const name = baseFilename.substring(0, extensionIndex)
      const ext = baseFilename.substring(extensionIndex)
      filename = `${name}_${counter}${ext}`
    } else {
      filename = `${baseFilename}_${counter}`
    }
    counter++
  }
  
  existingFilenames.add(filename)
  return filename
}