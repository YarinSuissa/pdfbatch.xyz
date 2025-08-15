import React, { useState, useCallback } from 'react'
import { FileUploadZone } from '../ui/FileUploadZone'
import { UploadedFile, PDFField, CSVColumn } from '../../types'
import { processUploadedFiles } from '../../utils/fileProcessing'

interface UploadStepProps {
  onFilesUploaded: (pdfFile: UploadedFile, csvFile: UploadedFile, pdfFields: PDFField[], csvData: { columns: CSVColumn[], data: Record<string, string>[] }) => void
}

export function UploadStep({ onFilesUploaded }: UploadStepProps) {
  const [pdfFile, setPdfFile] = useState<UploadedFile | null>(null)
  const [csvFile, setCsvFile] = useState<UploadedFile | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileUpload = useCallback(async (file: File, type: 'pdf' | 'csv') => {
    setProcessing(true)
    setError(null)
    
    try {
      if (type === 'pdf') {
        setPdfFile({
          id: `pdf-${Date.now()}`,
          file,
          valid: false,
          errors: ['Processing...']
        })
      } else {
        setCsvFile({
          id: `csv-${Date.now()}`,
          file,
          valid: false,
          errors: ['Processing...']
        })
      }

      // If both files are selected, process them together
      const currentPdf = type === 'pdf' ? file : pdfFile?.file
      const currentCsv = type === 'csv' ? file : csvFile?.file

      if (currentPdf && currentCsv) {
        const result = await processUploadedFiles(currentPdf, currentCsv)
        
        setPdfFile(result.pdfUpload)
        setCsvFile(result.csvUpload)
        
        if (result.pdfUpload.valid && result.csvUpload.valid) {
          onFilesUploaded(
            result.pdfUpload,
            result.csvUpload,
            result.pdfFields,
            result.csvData
          )
        }
      } else {
        // Single file processing for immediate feedback
        if (type === 'pdf') {
          const { extractPDFFields, generatePDFPreview } = await import('../../utils/pdfUtils')
          const errors: string[] = []
          
          if (file.size > 25 * 1024 * 1024) {
            errors.push('PDF file is too large (max 25MB)')
          }
          
          let fields: PDFField[] = []
          let preview: string | undefined
          
          if (errors.length === 0) {
            try {
              fields = await extractPDFFields(file)
              if (fields.length === 0) {
                errors.push('PDF contains no fillable form fields')
              }
              const previewResult = await generatePDFPreview(file)
              preview = previewResult.dataUrl
            } catch (error) {
              errors.push('Failed to process PDF file')
            }
          }
          
          setPdfFile({
            id: `pdf-${crypto.randomUUID()}`,
            file,
            preview,
            metadata: { fields: fields.length },
            valid: errors.length === 0,
            errors
          })
        } else {
          const { parseCSV, validateCSVStructure } = await import('../../utils/csvUtils')
          const errors: string[] = []
          
          if (file.size > 10 * 1024 * 1024) {
            errors.push('CSV file is too large (max 10MB)')
          }
          
          let columns: CSVColumn[] = []
          let data: Record<string, string>[] = []
          
          if (errors.length === 0) {
            try {
              const csvResult = await parseCSV(file)
              const structureErrors = validateCSVStructure(csvResult.columns, csvResult.data)
              errors.push(...csvResult.errors, ...structureErrors)
              
              if (errors.length === 0) {
                columns = csvResult.columns
                data = csvResult.data
              }
            } catch (error) {
              errors.push('Failed to process CSV file')
            }
          }
          
          setCsvFile({
            id: `csv-${crypto.randomUUID()}`,
            file,
            metadata: { columns: columns.length, rows: data.length },
            valid: errors.length === 0,
            errors
          })
        }
      }
    } catch (error) {
      console.error(`Error processing ${type.toUpperCase()}:`, error)
      setError(error instanceof Error ? error.message : `Failed to process ${type.toUpperCase()} file`)
      
      if (type === 'pdf') {
        setPdfFile({
          id: `pdf-${crypto.randomUUID()}`,
          file,
          valid: false,
          errors: [error instanceof Error ? error.message : 'Processing failed']
        })
      } else {
        setCsvFile({
          id: `csv-${crypto.randomUUID()}`,
          file,
          valid: false,
          errors: [error instanceof Error ? error.message : 'Processing failed']
        })
      }
    }

    setProcessing(false)
  }, [pdfFile, csvFile, onFilesUploaded])

  const handlePDFUpload = useCallback((file: File) => {
    handleFileUpload(file, 'pdf')
  }, [handleFileUpload])

  const handleCSVUpload = useCallback((file: File) => {
    handleFileUpload(file, 'csv')
  }, [handleFileUpload])

  return (
    <div className="space-y-8">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Upload Your Files
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Start by uploading your fillable PDF form and CSV data file. We'll validate both files and extract the necessary information for mapping.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <FileUploadZone
          title="Upload PDF Form"
          description="Upload a fillable PDF form with form fields"
          acceptedTypes="Accepts: .pdf files up to 25MB"
          onFileUpload={handlePDFUpload}
          uploadedFile={pdfFile || undefined}
          errors={pdfFile?.errors}
          icon="pdf"
        />

        <FileUploadZone
          title="Upload CSV Data"
          description="Upload CSV data with headers to fill the PDF form"
          acceptedTypes="Accepts: .csv files up to 5,000 rows"
          onFileUpload={handleCSVUpload}
          uploadedFile={csvFile || undefined}
          errors={csvFile?.errors}
          icon="csv"
        />
      </div>

      {error && (
        <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 bg-red-500 rounded-full flex-shrink-0"></div>
            <p className="text-red-800 font-medium">Processing Error</p>
          </div>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      )}

      {processing && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          <span className="ml-2 text-gray-600">
            {pdfFile && csvFile ? 'Processing both files...' : 'Processing file...'}
          </span>
        </div>
      )}

      {pdfFile?.valid && csvFile?.valid && (
        <div className="text-center py-8">
          <div className="inline-flex items-center px-6 py-3 bg-green-100 border border-green-200 rounded-full">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
            <span className="text-green-800 font-medium">
              Both files uploaded successfully! You can proceed to the next step.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}