import Papa from 'papaparse'
import { CSVColumn } from '../types'

export function parseCSV(file: File): Promise<{
  columns: CSVColumn[]
  data: Record<string, string>[]
  errors: string[]
}> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errors: string[] = []
        
        if (results.errors.length > 0) {
          errors.push(...results.errors.map(e => e.message))
        }
        
        const data = results.data as Record<string, string>[]
        const headers = Object.keys(data[0] || {})
        
        const columns: CSVColumn[] = headers.map((header, index) => ({
          id: `column-${index}`,
          name: header,
          type: detectColumnType(data.map(row => row[header]).slice(0, 10)),
          sampleData: data.slice(0, 5).map(row => row[header] || '')
        }))
        
        resolve({ columns, data, errors })
      }
    })
  })
}

function detectColumnType(values: string[]): string {
  const nonEmptyValues = values.filter(v => v && v.trim())
  if (nonEmptyValues.length === 0) return 'text'
  
  // Check if all values are numbers
  const allNumbers = nonEmptyValues.every(v => !isNaN(Number(v)))
  if (allNumbers) return 'number'
  
  // Check if all values look like emails
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const allEmails = nonEmptyValues.every(v => emailRegex.test(v))
  if (allEmails) return 'email'
  
  // Check if all values look like dates
  const allDates = nonEmptyValues.every(v => !isNaN(Date.parse(v)))
  if (allDates) return 'date'
  
  return 'text'
}

export function validateCSVStructure(columns: CSVColumn[], data: Record<string, string>[]): string[] {
  const errors: string[] = []
  
  if (columns.length === 0) {
    errors.push('CSV file appears to be empty or has no headers')
  }
  
  if (data.length === 0) {
    errors.push('CSV file has no data rows')
  }
  
  if (data.length > 5000) {
    errors.push('CSV file exceeds maximum limit of 5,000 rows')
  }
  
  return errors
}