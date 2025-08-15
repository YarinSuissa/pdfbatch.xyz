import React, { useState, useEffect, useRef } from 'react'
import { CSVColumn, PDFField, FieldMapping, NamingTemplate } from '../../types'
import { parseNamingTemplate, generatePreviewFilenames } from '../../utils/namingUtils'
import { HelpCircle, Eye, AlertCircle, Check, FileText } from 'lucide-react'

interface NamingStepProps {
  csvColumns: CSVColumn[]
  pdfFields: PDFField[]
  fieldMappings: FieldMapping[]
  csvData: Record<string, string>[]
  onTemplateComplete: (template: NamingTemplate) => void
  initialTemplate?: string
}

export function NamingStep({
  csvColumns,
  pdfFields,
  fieldMappings,
  csvData,
  onTemplateComplete,
  initialTemplate = 'document_{Row_Number}'
}: NamingStepProps) {
  const onTemplateCompleteRef = useRef(onTemplateComplete)
  useEffect(() => { onTemplateCompleteRef.current = onTemplateComplete }, [onTemplateComplete])

  const [template, setTemplate] = useState(initialTemplate)
  const [showHelp, setShowHelp] = useState(false)
  const [templateAnalysis, setTemplateAnalysis] = useState<{
    placeholders: string[]
    isValid: boolean
    errors: string[]
  }>({ placeholders: [], isValid: false, errors: [] })
  const [previews, setPreviews] = useState<string[]>([])

  useEffect(() => {
    const analysis = parseNamingTemplate(template)
    setTemplateAnalysis(analysis)

    if (analysis.isValid && csvData.length > 0) {
      const samplePreviews = generatePreviewFilenames(
        template,
        csvColumns,
        pdfFields,
        csvData
      )
      setPreviews(samplePreviews)

      const namingTemplate: NamingTemplate = {
        template,
        placeholders: analysis.placeholders,
        preview: samplePreviews
      }
      onTemplateCompleteRef.current(namingTemplate)
    }
  }, [template, csvColumns, pdfFields, csvData])

  const availablePlaceholders = [
    ...csvColumns.map(col => ({ name: col.name, type: 'CSV Column', description: `Data from ${col.name} column` })),
    ...fieldMappings.map(mapping => ({ 
      name: mapping.fieldName, 
      type: 'PDF Field', 
      description: `Mapped PDF field: ${mapping.fieldName}` 
    })),
    { name: 'Row_Number', type: 'System', description: 'Sequential number for each row (1, 2, 3...)' },
    { name: 'Timestamp', type: 'System', description: 'Current date and time' }
  ]

  const insertPlaceholder = (placeholderName: string) => {
    setTemplate(prev => prev + `{${placeholderName}}`)
  }

  return (
    <div className="space-y-8">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Define File Naming Scheme
        </h2>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          Create a naming template for your generated PDF files using placeholders from your CSV data and PDF fields.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Template Input */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">
                Naming Template
              </h3>
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 transition-colors"
              >
                <HelpCircle className="w-5 h-5" />
                <span className="text-sm">Help</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="template" className="block text-sm font-medium text-gray-700 mb-2">
                  File name template
                </label>
                <input
                  type="text"
                  id="template"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  placeholder="document_{Column_Name}_{Row_Number}"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                />
              </div>

              {templateAnalysis.errors.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-red-800 font-medium">Template Errors</h4>
                      <ul className="mt-1 text-sm text-red-700">
                        {templateAnalysis.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {templateAnalysis.isValid && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Check className="w-5 h-5 text-green-500" />
                    <span className="text-green-800 font-medium">
                      Template is valid with {templateAnalysis.placeholders.length} placeholder(s)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {showHelp && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-blue-800 font-medium mb-3">How to use placeholders:</h4>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• Use curly braces to insert dynamic values: <code className="bg-blue-100 px-1 rounded">{'{Column_Name}'}</code></li>
                  <li>• Combine text and placeholders: <code className="bg-blue-100 px-1 rounded">invoice_{'{Customer_Name}'}_{'{Date}'}</code></li>
                  <li>• Files automatically get .pdf extension if not specified</li>
                  <li>• Special characters in data are replaced with underscores</li>
                  <li>• Duplicate names get a number suffix automatically</li>
                </ul>
              </div>
            )}
          </div>

          {/* Preview */}
          {previews.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center mb-4">
                <Eye className="w-6 h-6 mr-2 text-green-600" />
                <h3 className="text-xl font-semibold text-gray-900">
                  Preview ({previews.length} samples)
                </h3>
              </div>
              
              <div className="space-y-2">
                {previews.map((preview, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <span className="font-mono text-sm text-gray-900">{preview}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> This shows samples from the first 3 rows. 
                  All {csvData.length} rows will be processed with unique filenames.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Available Placeholders */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Available Placeholders
            </h3>

            <div className="space-y-4">
              {availablePlaceholders.map((placeholder, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{placeholder.name}</h4>
                    <button
                      onClick={() => insertPlaceholder(placeholder.name)}
                      className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition-colors"
                    >
                      Insert
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mb-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      placeholder.type === 'CSV Column' 
                        ? 'bg-blue-100 text-blue-800'
                        : placeholder.type === 'PDF Field'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {placeholder.type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{placeholder.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}