import React, { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Database, AlertCircle, Check } from 'lucide-react'
import { UploadedFile } from '../../types'

interface FileUploadZoneProps {
  title: string
  description: string
  acceptedTypes: string
  onFileUpload: (file: File) => void
  uploadedFile?: UploadedFile
  errors?: string[]
  icon: 'pdf' | 'csv'
}

export function FileUploadZone({
  title,
  description,
  acceptedTypes,
  onFileUpload,
  uploadedFile,
  errors = [],
  icon
}: FileUploadZoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileUpload(acceptedFiles[0])
    }
  }, [onFileUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: icon === 'pdf' ? { 'application/pdf': ['.pdf'] } : { 'text/csv': ['.csv'] },
    maxFiles: 1
  })

  const IconComponent = icon === 'pdf' ? FileText : Database
  const borderColor = uploadedFile?.valid 
    ? 'border-green-400' 
    : errors.length > 0 
    ? 'border-red-400' 
    : isDragActive 
    ? 'border-orange-400' 
    : 'border-gray-300'

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 cursor-pointer
          bg-white hover:bg-gray-50 ${borderColor}
          ${isDragActive ? 'scale-105 shadow-lg' : 'hover:shadow-md'}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center text-center">
          {uploadedFile?.valid ? (
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
          ) : (
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              isDragActive ? 'bg-orange-100' : 'bg-gray-100'
            }`}>
              <IconComponent className={`w-8 h-8 ${
                isDragActive ? 'text-orange-600' : 'text-gray-600'
              }`} />
            </div>
          )}
          
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {uploadedFile?.valid ? 'File Uploaded Successfully' : title}
          </h3>
          
          {uploadedFile?.valid ? (
            <div className="space-y-2">
              <p className="text-green-600 font-medium">{uploadedFile.file.name}</p>
              <p className="text-sm text-gray-500">
                {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <>
              <p className="text-gray-600 mb-4">{description}</p>
              
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Upload className="w-4 h-4" />
                <span>Drop your file here or click to browse</span>
              </div>
              
              <p className="text-xs text-gray-400 mt-2">{acceptedTypes}</p>
            </>
          )}
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-red-800 font-medium">Upload Error</h4>
              <ul className="mt-1 text-sm text-red-700">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {uploadedFile?.preview && (
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Preview</h4>
          <img 
            src={uploadedFile.preview} 
            alt="PDF Preview" 
            className="max-w-full h-auto rounded border"
          />
        </div>
      )}
    </div>
  )
}