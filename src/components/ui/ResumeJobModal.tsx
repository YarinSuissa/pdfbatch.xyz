import React from 'react'
import { StoredJobData } from '../../utils/jobStorage'
import { Clock, FileText, Database, ArrowRight, X } from 'lucide-react'

interface ResumeJobModalProps {
  jobData: StoredJobData
  onResume: () => void
  onStartNew: () => void
  onClose: () => void
}

export function ResumeJobModal({ jobData, onResume, onStartNew, onClose }: ResumeJobModalProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatFileSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
                  We found an incomplete PDF generation job
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
          <div className="space-y-6 mb-8">
            <div className="bg-gray-50 rounded-lg p-4">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PDF File */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <FileText className="w-5 h-5 text-red-600 mr-2" />
                  <h4 className="font-semibold text-gray-900">PDF Template</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-gray-900">{jobData.pdfFile.name}</p>
                  <p className="text-gray-600">Size: {formatFileSize(jobData.pdfFile.size)}</p>
                  <p className="text-gray-600">Fields: {jobData.pdfFields.length}</p>
                </div>
              </div>

              {/* CSV File */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Database className="w-5 h-5 text-blue-600 mr-2" />
                  <h4 className="font-semibold text-gray-900">CSV Data</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-gray-900">{jobData.csvFile.name}</p>
                  <p className="text-gray-600">Size: {formatFileSize(jobData.csvFile.size)}</p>
                  <p className="text-gray-600">Rows: {jobData.csvData.data.length}</p>
                  <p className="text-gray-600">Columns: {jobData.csvData.columns.length}</p>
                </div>
              </div>
            </div>

            {/* Configuration Summary */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">Configuration</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-600">Field Mappings:</span>
                  <p className="text-gray-900">{jobData.fieldMappings.length} fields mapped</p>
                </div>
                <div>
                  <span className="text-gray-600">Naming Template:</span>
                  <p className="font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">
                    {jobData.namingTemplate.template}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Expected Output:</span>
                  <p className="text-gray-900">{jobData.csvData.data.length} PDF files</p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onResume}
              className="flex-1 bg-red-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center space-x-2"
            >
              <ArrowRight className="w-5 h-5" />
              <span>Resume Job</span>
            </button>
            <button
              onClick={onStartNew}
              className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
            >
              Start New Job
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            Incomplete jobs are automatically removed after 7 days
          </p>
        </div>
      </div>
    </div>
  )
}