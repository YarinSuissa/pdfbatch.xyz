import React, { useState, useCallback } from 'react'
import { useEffect } from 'react'
import { StepIndicator } from './components/ui/StepIndicator'
import { ResumeJobModal } from './components/ui/ResumeJobModal'
import { UploadStep } from './components/steps/UploadStep'
import { MappingStep } from './components/steps/MappingStep'
import { NamingStep } from './components/steps/NamingStep'
import { GenerateStep } from './components/steps/GenerateStep'
import { 
  WizardStep, 
  UploadedFile, 
  PDFField, 
  CSVColumn, 
  FieldMapping, 
  NamingTemplate 
} from './types'
import { 
  getIncompleteJob, 
  clearIncompleteJob, 
  saveIncompleteJob, 
  StoredJobData 
} from './utils/jobStorage'
import { createFileWithChecksum } from './utils/checksumUtils'
import { ArrowLeft, ArrowRight } from 'lucide-react'

function App() {
  const [currentStep, setCurrentStep] = useState(1)
  const [lastAction, setLastAction] = useState<'files_uploaded' | 'mapping_changed' | 'step2_next' | 'naming_changed' | 'step3_next' | 'generation_started'>('files_uploaded')
  const [steps, setSteps] = useState<WizardStep[]>([
    { id: 1, title: 'Upload Files', description: 'PDF form & CSV data', completed: false, active: true },
    { id: 2, title: 'Map Fields', description: 'Drag & drop mapping', completed: false, active: false },
    { id: 3, title: 'Name Files', description: 'Define naming scheme', completed: false, active: false },
    { id: 4, title: 'Generate', description: 'Create & download', completed: false, active: false }
  ])

  // Data state
  const [pdfFile, setPdfFile] = useState<UploadedFile | null>(null)
  const [csvFile, setCsvFile] = useState<UploadedFile | null>(null)
  const [pdfFields, setPdfFields] = useState<PDFField[]>([])
  const [csvData, setCsvData] = useState<{ columns: CSVColumn[], data: Record<string, string>[] }>({ columns: [], data: [] })
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([])
  const [namingTemplate, setNamingTemplate] = useState<NamingTemplate | null>(null)
  
  // Resume job state
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [incompleteJobData, setIncompleteJobData] = useState<StoredJobData | null>(null)

  // Check for incomplete job on component mount
  useEffect(() => {
    const incompleteJob = getIncompleteJob()
    if (incompleteJob) {
      setIncompleteJobData(incompleteJob)
      setShowResumeModal(true)
    }
  }, [])

  // Save job data whenever it changes (after step 1)
  useEffect(() => {
    if (pdfFile?.valid && csvFile?.valid && pdfFields.length > 0) {
      const saveJobData = async () => {
        try {
          const pdfWithChecksum = await createFileWithChecksum(pdfFile.file)
          const csvWithChecksum = await createFileWithChecksum(csvFile.file)
          
          const jobData: StoredJobData = {
            jobId: `session-${Date.now()}`,
            lastAction,
            pdfFile: {
              ...pdfWithChecksum,
              preview: pdfFile.preview,
              metadata: pdfFile.metadata
            },
            csvFile: {
              ...csvWithChecksum,
              metadata: csvFile.metadata
            },
            pdfFields,
            csvData,
            fieldMappings,
            namingTemplate: namingTemplate || { template: '', placeholders: [], preview: [] },
            timestamp: Date.now()
          }
          
          saveIncompleteJob(jobData)
        } catch (error) {
          console.error('Failed to save job data:', error)
        }
      }
      
      saveJobData()
    }
  }, [pdfFile, csvFile, pdfFields, csvData, fieldMappings, namingTemplate])

  const updateStepStatus = (stepId: number, completed: boolean, active: boolean = false) => {
    setSteps(prev => prev.map(step => ({
      ...step,
      completed: step.id === stepId ? completed : step.completed,
      active: step.id === stepId ? active : false
    })))
  }

  const canProceedToStep = (stepNumber: number): boolean => {
    switch (stepNumber) {
      case 2:
        return pdfFile?.valid && csvFile?.valid && pdfFields.length > 0
      case 3:
        return fieldMappings.length > 0
      case 4:
        return namingTemplate?.placeholders.length > 0 && namingTemplate.template.length > 0
      default:
        return true
    }
  }

  const nextStep = () => {
    if (currentStep < 4 && canProceedToStep(currentStep + 1)) {
      // Track when user presses "Next" button
      if (currentStep === 2) {
        setLastAction('step2_next')
      } else if (currentStep === 3) {
        setLastAction('step3_next')
      }
      
      updateStepStatus(currentStep, true)
      setCurrentStep(currentStep + 1)
      updateStepStatus(currentStep + 1, false, true)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      updateStepStatus(currentStep, false)
      setCurrentStep(currentStep - 1)
      updateStepStatus(currentStep - 1, false, true)
    }
  }

  const handleFilesUploaded = (
    uploadedPdfFile: UploadedFile,
    uploadedCsvFile: UploadedFile,
    extractedFields: PDFField[],
    parsedCsvData: { columns: CSVColumn[], data: Record<string, string>[] }
  ) => {
    setPdfFile(uploadedPdfFile)
    setCsvFile(uploadedCsvFile)
    setPdfFields(extractedFields)
    setCsvData(parsedCsvData)
    setLastAction('files_uploaded')
  }

  const handleMappingComplete = (mappings: FieldMapping[]) => {
    setFieldMappings(mappings)
    setLastAction('mapping_changed')
  }

  const handleTemplateComplete = useCallback((template: NamingTemplate) => {
    setNamingTemplate(template)
    setLastAction('naming_changed')
  }, [])

  const handleGenerationComplete = (downloadUrl: string, expiresAt: string) => {
    updateStepStatus(4, true)
    // Clear incomplete job data when generation is complete
    clearIncompleteJob()
  }

  const handleResumeJob = (
    pdfFile: UploadedFile,
    csvFile: UploadedFile,
    pdfFields: PDFField[],
    csvData: { columns: CSVColumn[], data: Record<string, string>[] }
  ) => {
    if (!incompleteJobData) return
    
    // Set the verified files and data
    setPdfFile(pdfFile)
    setCsvFile(csvFile)
    setPdfFields(pdfFields)
    setCsvData(csvData)
    setFieldMappings(incompleteJobData.fieldMappings)
    setNamingTemplate(incompleteJobData.namingTemplate)
    setLastAction(incompleteJobData.lastAction)
    
    // Determine which step to resume at based on last user action
    let targetStep: number
    let step1Status: boolean, step2Status: boolean, step3Status: boolean, step4Status: boolean
    
    switch (incompleteJobData.lastAction) {
      case 'files_uploaded':
        // User just uploaded files, go to mapping step
        targetStep = 2
        step1Status = true
        step2Status = false
        step3Status = false
        step4Status = false
        break
        
      case 'mapping_changed':
        // User was working on mappings, stay on mapping step
        targetStep = 2
        step1Status = true
        step2Status = false
        step3Status = false
        step4Status = false
        break
        
      case 'step2_next':
        // User pressed next from mapping, go to naming step
        targetStep = 3
        step1Status = true
        step2Status = true
        step3Status = false
        step4Status = false
        break
        
      case 'naming_changed':
        // User was working on naming, stay on naming step
        targetStep = 3
        step1Status = true
        step2Status = true
        step3Status = false
        step4Status = false
        break
        
      case 'step3_next':
        // User pressed next from naming, go to generation step
        targetStep = 4
        step1Status = true
        step2Status = true
        step3Status = true
        step4Status = false
        break
        
      case 'generation_started':
        // User was generating, stay on generation step
        targetStep = 4
        step1Status = true
        step2Status = true
        step3Status = true
        step4Status = false
        break
        
      default:
        // Fallback to step 2 if unknown action
        targetStep = 2
        step1Status = true
        step2Status = false
        step3Status = false
        step4Status = false
    }
    
    // Set current step and update all step statuses
    setCurrentStep(targetStep)
    updateStepStatus(1, step1Status, targetStep === 1)
    updateStepStatus(2, step2Status, targetStep === 2)
    updateStepStatus(3, step3Status, targetStep === 3)
    updateStepStatus(4, step4Status, targetStep === 4)
    
    setShowResumeModal(false)
    setIncompleteJobData(null)
  }

  const handleStartNewJob = () => {
    clearIncompleteJob()
    setShowResumeModal(false)
    setIncompleteJobData(null)
    
    // Reset all state to start fresh
    setPdfFile(null)
    setCsvFile(null)
    setPdfFields([])
    setCsvData({ columns: [], data: [] })
    setFieldMappings([])
    setNamingTemplate(null)
    setLastAction('files_uploaded')
    setCurrentStep(1)
    setSteps([
      { id: 1, title: 'Upload Files', description: 'PDF form & CSV data', completed: false, active: true },
      { id: 2, title: 'Map Fields', description: 'Drag & drop mapping', completed: false, active: false },
      { id: 3, title: 'Name Files', description: 'Define naming scheme', completed: false, active: false },
      { id: 4, title: 'Generate', description: 'Create & download', completed: false, active: false }
    ])
  }

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <UploadStep
            onFilesUploaded={handleFilesUploaded}
          />
        )
      case 2:
        return (
          <MappingStep
            pdfFields={pdfFields}
            csvColumns={csvData.columns}
            onMappingComplete={handleMappingComplete}
            pdfPreview={pdfFile?.preview}
            pdfFile={pdfFile}
            initialMappings={fieldMappings}
          />
        )
      case 3:
        return (
          <NamingStep
            csvColumns={csvData.columns}
            pdfFields={pdfFields}
            fieldMappings={fieldMappings}
            csvData={csvData.data}
            onTemplateComplete={handleTemplateComplete}
            initialTemplate={namingTemplate?.template || 'document_{Row_Number}'}
          />
        )
      case 4:
        return namingTemplate && pdfFile ? (
          <GenerateStep
            fieldMappings={fieldMappings}
            namingTemplate={namingTemplate}
            csvData={csvData.data}
            pdfFile={pdfFile}
            onGenerationComplete={handleGenerationComplete}
            onGenerationStarted={() => setLastAction('generation_started')}
          />
        ) : null
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Resume Job Modal */}
      {showResumeModal && incompleteJobData && (
        <ResumeJobModal
          jobData={incompleteJobData}
          onResume={handleResumeJob}
          onStartNew={handleStartNewJob}
          onClose={() => setShowResumeModal(false)}
        />
      )}
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            PDF<span className="text-red-600">Batch</span>.xyz
          </h1>
          <p className="text-xl text-gray-600">
            Transform your CSV data into personalized PDF documents
          </p>
        </div>

        {/* Step Indicator */}
        <StepIndicator steps={steps} currentStep={currentStep} />

        {/* Current Step Content */}
        <div className="max-w-7xl mx-auto">
          {renderCurrentStep()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-12 max-w-4xl mx-auto">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center space-x-2 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Previous</span>
          </button>

          <div className="text-sm text-gray-500">
            Step {currentStep} of 4
          </div>

          <button
            onClick={nextStep}
            disabled={currentStep === 4 || !canProceedToStep(currentStep + 1)}
            className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span>Next</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default App