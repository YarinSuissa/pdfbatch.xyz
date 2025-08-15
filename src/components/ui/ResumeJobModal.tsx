import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { StoredJobData } from '../../utils/jobStorage'
import { computeFileChecksum, filesMatch } from '../../utils/checksumUtils'
import { processUploadedFiles } from '../../utils/fileProcessing'
import { Clock, FileText, Database, ArrowRight, X, Upload, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'
import { UploadedFile, PDFField, CSVColumn } from '../../types'

interface ResumeJobModalProps {
  jobData: StoredJobData
  onResume: (
    pdfFile: UploadedFile,
    csvFile: UploadedFile,
    pdfFields: PDFField[],
    csvData: { columns: CSVColumn[], data: Record<string, string>[] }
  ) => void
  onStartNew: () => void
  onClose: () => void
}

type VerificationState = 'pending' | 'processing' | 'verified' | 'mismatch' | 'error'

export function ResumeJobModal({ jobData, onResume, onStartNew, onClose }: ResumeJobModalProps) {
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [pdfState, setPdfState] = useState<VerificationState>('pending')
  const [csvState, setCsvState] = useState<VerificationState>('pending')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [processing, setProcessing] = useState(false)

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatFileSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  }

  const handleFileUpload = useCallback(async (file: File, type: 'pdf' | 'csv') => {
    const setState = type === 'pdf' ? setPdfState : setCsvState
    const storedFile = type === 'pdf' ? jobData.pdfFile : jobData.csvFile

    setState('processing')
    setErrorMessage('')

    try {
      // First check basic file properties
      if (!filesMatch(file, storedFile)) {
        setState('mismatch')
        return
      }

      // Then verify checksum
      const checksum = await computeFileChecksum(file)
      if (checksum === storedFile.checksum) {
        setState('verified')
      } else {
        setState('mismatch')
      }
    } catch (error) {
      console.error(`Error verifying ${type} file:`, error)
      setState('error')
      setErrorMessage(`Failed to verify ${type.toUpperCase()} file`)
    }
  }, [jobData])

  const handlePdfUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPdfFile(file)
      handleFileUpload(file, 'pdf')
    }
  }, [handleFileUpload])

  const handleCsvUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCsvFile(file)
      handleFileUpload(file, 'csv')
    }
  }, [handleFileUpload])

  const onPdfDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      setPdfFile(file)
      handleFileUpload(file, 'pdf')
    }
  }, [handleFileUpload])

  const onCsvDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      setCsvFile(file)
      handleFileUpload(file, 'csv')
    }
  }, [handleFileUpload])

  const { getRootProps: getPdfRootProps, getInputProps: getPdfInputProps, isDragActive: isPdfDragActive } = useDropzone({
    onDrop: onPdfDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    noClick: true // We'll handle clicks manually
  })

  const { getRootProps: getCsvRootProps, getInputProps: getCsvInputProps, isDragActive: isCsvDragActive } = useDropzone({
    onDrop: onCsvDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    noClick: true // We'll handle clicks manually
  })

  const handleResumeWithFiles = async () => {
    if (!pdfFile || !csvFile || pdfState !== 'verified' || csvState !== 'verified') {
      return
    }

    setProcessing(true)
    setErrorMessage('')

    try {
      // Process the files to extract data
      const result = await processUploadedFiles(pdfFile, csvFile)
      
      if (result.pdfUpload.valid && result.csvUpload.valid) {
        onResume(result.pdfUpload, result.csvUpload, result.pdfFields, result.csvData)
      } else {
        const errors = [...(result.pdfUpload.errors || []), ...(result.csvUpload.errors || [])]
        setErrorMessage(`File processing failed: ${errors.join(', ')}`)
        setProcessing(false)
      }
    } catch (error) {
      console.error('Error processing files:', error)
      setErrorMessage('Failed to process files. Please try again.')
      setProcessing(false)
    }
  }

  const canResume = pdfState === 'verified' && csvState === 'verified' && !processing

  const getStateIcon = (state: VerificationState) => {
    switch (state) {
      case 'pending':
        return <Upload className="w-5 h-5 text-gray-400" />
      case 'processing':
        return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
      case 'verified':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'mismatch':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      default:
        return <Upload className="w-5 h-5 text-gray-400" />
    }
  }

  const getStateMessage = (state: VerificationState, type: string) => {
    switch (state) {
      case 'pending':
        return `Please upload the same ${type} file`
      case 'processing':
        return 'Verifying file...'
      case 'verified':
        return 'File verified successfully!'
      case 'mismatch':
        return `This ${type} file doesn't match the original. Please upload the exact same file.`
      case 'error':
        return `Error verifying ${type} file`
      default:
        return ''
    }
  }

  const getStateColor = (state: VerificationState) => {
    switch (state) {
      case 'verified':
        return 'text-green-700 bg-green-50 border-green-200'
      case 'mismatch':
      case 'error':
        return 'text-red-700 bg-red-50 border-red-200'
      case 'processing':
        return 'text-blue-700 bg-blue-50 border-blue-200'
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Resume Previous Job?
                </h2>
                <p className="text-gray-600">
                  Re-upload the same files to continue where you left off
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Job Details */}
          <div className="mb-8">
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Job Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Job ID:</span>
                  <p className="font-mono text-gray-900 break-all">{jobData.jobId}</p>
                </div>
                <div>
                  <span className="text-gray-600">Created:</span>
                  <p className="text-gray-900">{formatDate(jobData.timestamp)}</p>
                </div>
              </div>
            </div>

            {/* Privacy Explanation */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-blue-800 font-medium mb-1">Privacy-First Design</h4>
                  <p className="text-blue-700 text-sm">
                    For your privacy and security, files are never stored on our servers. Please re-upload the same files to continue your work exactly where you left off.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PDF File Upload */}
              <div 
                {...getPdfRootProps()}
                className={`border-2 border-dashed rounded-lg p-4 transition-all duration-300 ${
                  isPdfDragActive 
                    ? 'border-red-400 bg-red-50' 
                    : pdfState === 'verified'
                    ? 'border-green-400 bg-green-50'
                    : pdfState === 'mismatch' || pdfState === 'error'
                    ? 'border-red-400 bg-red-50'
                    : 'border-gray-300 hover:border-red-300 hover:bg-red-50'
                }`}
              >
                <input {...getPdfInputProps()} />
                <div className="flex items-center mb-3">
                  <FileText className="w-5 h-5 text-red-600 mr-2" />
                  <h4 className="font-semibold text-gray-900">PDF Template</h4>
                </div>
                
                <div className="space-y-3">
                  <div className="text-sm text-gray-600">
                    <p><strong>Expected:</strong> {jobData.pdfFile.name}</p>
                    <p><strong>Size:</strong> {formatFileSize(jobData.pdfFile.size)}</p>
                  </div>
                  
                  <div className="space-y-3">
                    {isPdfDragActive ? (
                      <div className="text-center py-6">
                        <Upload className="w-8 h-8 mx-auto text-red-600 mb-2" />
                        <p className="text-red-700 font-medium">Drop PDF file here</p>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <Upload className="w-6 h-6 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600 mb-2">
                          Drag and drop your PDF file here, or
                        </p>
                        <label className="cursor-pointer">
                          <span className="text-red-600 hover:text-red-700 font-medium">
                            choose file to upload
                          </span>
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={handlePdfUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                    
                    <div className={`flex items-start space-x-2 p-3 rounded-lg border ${getStateColor(pdfState)}`}>
                      {getStateIcon(pdfState)}
                      <div className="flex-1 text-sm">
                        {getStateMessage(pdfState, 'PDF')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CSV File Upload */}
              <div 
                {...getCsvRootProps()}
                className={`border-2 border-dashed rounded-lg p-4 transition-all duration-300 ${
                  isCsvDragActive 
                    ? 'border-blue-400 bg-blue-50' 
                    : csvState === 'verified'
                    ? 'border-green-400 bg-green-50'
                    : csvState === 'mismatch' || csvState === 'error'
                    ? 'border-red-400 bg-red-50'
                    : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                <input {...getCsvInputProps()} />
                <div className="flex items-center mb-3">
                  <Database className="w-5 h-5 text-blue-600 mr-2" />
                  <h4 className="font-semibold text-gray-900">CSV Data</h4>
                </div>
                
                <div className="space-y-3">
                  <div className="text-sm text-gray-600">
                    <p><strong>Expected:</strong> {jobData.csvFile.name}</p>
                    <p><strong>Size:</strong> {formatFileSize(jobData.csvFile.size)}</p>
                  </div>
                  
                  <div className="space-y-3">
                    {isCsvDragActive ? (
                      <div className="text-center py-6">
                        <Upload className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                        <p className="text-blue-700 font-medium">Drop CSV file here</p>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <Upload className="w-6 h-6 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600 mb-2">
                          Drag and drop your CSV file here, or
                        </p>
                        <label className="cursor-pointer">
                          <span className="text-blue-600 hover:text-blue-700 font-medium">
                            choose file to upload
                          </span>
                          <input
                            type="file"
                            accept=".csv"
                            onChange={handleCsvUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                    
                    <div className={`flex items-start space-x-2 p-3 rounded-lg border ${getStateColor(csvState)}`}>
                      {getStateIcon(csvState)}
                      <div className="flex-1 text-sm">
                        {getStateMessage(csvState, 'CSV')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-red-800 font-medium">Error</h4>
                  <p className="text-red-700 text-sm mt-1">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleResumeWithFiles}
              disabled={!canResume}
              className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 ${
                canResume
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {processing ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <ArrowRight className="w-5 h-5" />
              )}
              <span>{processing ? 'Processing...' : 'Resume Job'}</span>
            </button>
            <button
              onClick={onStartNew}
              className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
            >
              Start New Job
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            Files are verified using checksums to ensure they match exactly
          </p>
        </div>
      </div>
    </div>
  )
}