import React, { useState, useRef, useEffect } from 'react'
import { PDFField, CSVColumn, FieldMapping } from '../../types'
import { Database, FileText, Trash2, Link, Info } from 'lucide-react'
import { log } from '../../utils/logger'

interface MappingStepProps {
  pdfFields: PDFField[]
  csvColumns: CSVColumn[]
  onMappingComplete: (mappings: FieldMapping[]) => void
  pdfPreview?: string
  pdfFile?: { metadata?: { pageWidth?: number; pageHeight?: number } }
  initialMappings?: FieldMapping[]
}

export function MappingStep({ 
  pdfFields, 
  csvColumns, 
  onMappingComplete, 
  pdfPreview,
  pdfFile,
  initialMappings = []
}: MappingStepProps) {
  const [mappings, setMappings] = useState<FieldMapping[]>(initialMappings)
  const [draggedColumn, setDraggedColumn] = useState<CSVColumn | null>(null)
  const [dragOverField, setDragOverField] = useState<string | null>(null)
  const previewRef = useRef<HTMLImageElement>(null)
  const [previewDimensions, setPreviewDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const update = () => {
      if (!previewRef.current) return
      // clientWidth/Height are CSS pixels of the displayed image
      setPreviewDimensions({
        width: previewRef.current.clientWidth,
        height: previewRef.current.clientHeight
      })
    }
    const img = previewRef.current
    if (img) {
      if (img.complete) {
        update()
      } else {
        img.onload = update
      }
    }

    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [pdfPreview])

  const handleColumnDragStart = (e: React.DragEvent, column: CSVColumn) => {
    log.debug('[MappingStep] Starting drag for column:', column.name)
    setDraggedColumn(column)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', column.id)
  }

  const handleColumnDragEnd = () => {
    log.debug('[MappingStep] Drag ended')
    setDraggedColumn(null)
    setDragOverField(null)
  }

  const handleFieldDragOver = (e: React.DragEvent, fieldId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverField(fieldId)
  }

  const handleFieldDragLeave = () => {
    setDragOverField(null)
  }

  const handleFieldDrop = (e: React.DragEvent, fieldId: string) => {
    e.preventDefault()
    setDragOverField(null)

    const columnId = e.dataTransfer.getData('text/plain')
    log.debug('[MappingStep] Dropped column ID:', columnId, 'on field:', fieldId)

    const column = csvColumns.find(c => c.id === columnId)
    const field = pdfFields.find(f => f.id === fieldId)
    
    if (!column || !field) {
      log.warn('[MappingStep] Column or field not found')
      return
    }

    // Remove existing mapping for this field
    const updatedMappings = mappings.filter(m => m.fieldId !== fieldId)
    
    // Add new mapping
    const newMapping: FieldMapping = {
      fieldId: field.id,
      columnId: column.id,
      fieldName: field.name,
      columnName: column.name
    }
    
    const finalMappings = [...updatedMappings, newMapping]
    log.debug('[MappingStep] Updated mappings:', finalMappings)
    setMappings(finalMappings)
    onMappingComplete(finalMappings)
    setDraggedColumn(null)
  }

  const removeMapping = (fieldId: string) => {
    const updatedMappings = mappings.filter(m => m.fieldId !== fieldId)
    setMappings(updatedMappings)
    onMappingComplete(updatedMappings)
  }

  const getFieldMapping = (fieldId: string) => {
    return mappings.find(m => m.fieldId === fieldId)
  }

  const getColumnTypeColor = (type: string) => {
    switch (type) {
      case 'text': return 'bg-blue-100 text-blue-800'
      case 'number': return 'bg-green-100 text-green-800'
      case 'email': return 'bg-purple-100 text-purple-800'
      case 'date': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const calculateFieldPosition = (field: PDFField) => {
    if (!previewDimensions.width || !previewDimensions.height) {
      return { left: 0, top: 0, width: 0, height: 0 }
    }

    // Read metadata (must be set correctly at source)
    const meta = pdfFile?.metadata ?? {}
    const rotation = (meta.rotation ?? 0) % 360

    // Use CropBox if provided; else fall back to page box
    const boxX = meta.cropX ?? 0
    const boxY = meta.cropY ?? 0
    const boxW = meta.cropWidth  ?? meta.pageWidth  ?? 595
    const boxH = meta.cropHeight ?? meta.pageHeight ?? 842

    // Scale from PDF points to displayed CSS pixels
    const scaleX = previewDimensions.width  / (rotation % 180 === 0 ? boxW : boxH)
    const scaleY = previewDimensions.height / (rotation % 180 === 0 ? boxH : boxW)

    // Add aspect ratio warning
    const imgAR  = previewDimensions.width / previewDimensions.height
    const pageAR = (rotation % 180 === 0 ? boxW / boxH : boxH / boxW)
    if (Math.abs(imgAR - pageAR) > 0.02) {
      log.warn('[MappingStep] Aspect mismatch', { imgAR, pageAR, boxW, boxH, rotation })
    }

    // Field rect in the *box* coordinate space (bottom-left origin)
    let x = (field.x - boxX)
    let y = (field.y - boxY)
    let w = field.width
    let h = field.height

    // Apply page rotation: compute a rect (xR, yR, wR, hR) in a 0-rotated top-left CSS space
    let leftPx = 0, topPx = 0, wPx = 0, hPx = 0

    switch (rotation) {
      case 0: {
        leftPx = x * scaleX
        topPx  = (boxH - y - h) * scaleY
        wPx    = w * scaleX
        hPx    = h * scaleY
        break
      }
      case 90: {
        // Rotate 90° clockwise around origin:
        // x' = y, y' = boxW - (x + w), w' = h, h' = w
        const xr = y
        const yr = boxW - (x + w)
        const wr = h
        const hr = w
        // Convert bottom-left to top-left CSS
        leftPx = xr * scaleX
        topPx  = (boxW - yr - hr) * scaleY // boxH' = boxW
        wPx    = wr * scaleX
        hPx    = hr * scaleY
        break
      }
      case 180: {
        // x' = boxW - (x + w), y' = boxH - (y + h)
        const xr = boxW - (x + w)
        const yr = boxH - (y + h)
        leftPx = xr * scaleX
        topPx  = (boxH - yr - h) * scaleY
        wPx    = w * scaleX
        hPx    = h * scaleY
        break
      }
      case 270: {
        // x' = boxH - (y + h), y' = x, w' = h (becomes width), h' = w
        const xr = boxH - (y + h)
        const yr = x
        const wr = h
        const hr = w
        leftPx = xr * scaleX
        topPx  = (boxW - yr - hr) * scaleY // boxH' = boxW
        wPx    = wr * scaleX
        hPx    = hr * scaleY
        break
      }
    }
    // Remove the hard minimums; they break alignment
    return { left: leftPx, top: topPx, width: wPx, height: hPx }
  }

  return (
    <div className="space-y-8">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Map CSV Columns to PDF Fields
        </h2>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          Drag CSV columns from the right panel and drop them onto the red field areas in the PDF preview.
        </p>

        {/* Mapping Status */}
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-800 border border-green-200 text-sm font-medium">
            Mappings Complete ({mappings.length}/{pdfFields.length})
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {mappings.length === pdfFields.length
              ? 'All fields have been mapped!'
              : `${pdfFields.length - mappings.length} fields remaining`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* PDF Preview and Fields */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="w-6 h-6 mr-2 text-red-600" />
              PDF Form Preview - Drop CSV columns onto red fields
            </h3>
            
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">How to map fields:</p>
                  <p>Drag CSV columns from the right panel and drop them onto the red field areas in the PDF preview.</p>
                </div>
              </div>
            </div>

            {pdfPreview && (
              <div className="relative inline-block">
                <img 
                  ref={previewRef}
                  src={pdfPreview} 
                  alt="PDF Preview" 
                  className="block w-full h-auto border border-gray-200 rounded-lg"
                />
                
                {/* Overlay sized exactly to the image */}
                <div 
                  className="absolute left-0 top-0 pointer-events-none"
                  style={{
                    width: `${previewDimensions.width}px`,
                    height: `${previewDimensions.height}px`
                  }}
                >
                  {pdfFields.map((field) => {
                    const mapping = getFieldMapping(field.id)
                    const position = calculateFieldPosition(field)
                    
                    return (
                      <div
                        key={field.id}
                        className={`
                          absolute border-2 border-dashed transition-all duration-200 pointer-events-auto cursor-pointer
                          flex items-center justify-center text-xs font-medium text-center p-1
                          ${mapping 
                            ? 'border-green-400 bg-green-200 bg-opacity-70 text-green-800' 
                            : dragOverField === field.id
                            ? 'border-orange-400 bg-orange-200 bg-opacity-80 text-orange-800' 
                            : 'border-red-400 bg-red-200 bg-opacity-60 hover:bg-opacity-80 text-red-800'
                          }
                        `}
                        style={{
                          left: `${position.left}px`,
                          top: `${position.top}px`,
                          width: `${position.width}px`,
                          height: `${position.height}px`
                        }}
                        title={`${field.name} (${field.type})`}
                      >
                        {/* Invisible larger hit area for easier drag/drop (send behind) */}
                        <div 
                          className="absolute -inset-2 pointer-events-auto z-0"
                          onDragOver={(e) => handleFieldDragOver(e, field.id)}
                          onDragLeave={handleFieldDragLeave}
                          onDrop={(e) => handleFieldDrop(e, field.id)}
                        />
                        
                        {mapping ? (
                          <div className="relative z-10 flex items-center justify-between w-full h-full">
                            <div className="flex items-center px-1 py-0.5 bg-green-600 text-white rounded text-xs max-w-full min-w-0">
                              <Link className="w-3 h-3 mr-1 flex-shrink-0" />
                              <span className="truncate">
                                {mapping.columnName}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeMapping(field.id)
                              }}
                              className="p-0.5 text-white bg-red-600 rounded hover:bg-red-700 transition-colors ml-1 flex-shrink-0 relative z-20"
                              aria-label="Remove mapping"
                              title="Remove mapping"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="relative z-10 truncate px-1">
                            *{field.name}*
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            
            {/* Field List for reference */}
            <div className="mt-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">
                Field Reference ({pdfFields.length} fields)
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {pdfFields.map((field) => {
                  const mapping = getFieldMapping(field.id)
                  return (
                    <div key={field.id} className={`p-2 rounded border ${mapping ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="font-medium">{field.name}</div>
                      <div className="text-gray-500 capitalize">{field.type}</div>
                      {mapping && (
                        <div className="text-green-600 text-xs">→ {mapping.columnName}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* CSV Columns */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Database className="w-6 h-6 mr-2 text-blue-600" />
              CSV Columns ({csvColumns.length})
            </h3>
            
            <div className="space-y-3">
              {csvColumns.map((column) => {
                const isBeingDragged = draggedColumn?.id === column.id
                const usedCount = mappings.filter(m => m.columnId === column.id).length
                
                return (
                  <div
                    key={column.id}
                    draggable={true}
                    onDragStart={(e) => handleColumnDragStart(e, column)}
                    onDragEnd={handleColumnDragEnd}
                    className={`
                      p-4 bg-white border border-gray-200 rounded-lg transition-all duration-200 select-none
                      ${isBeingDragged
                        ? 'shadow-lg scale-105 rotate-1 opacity-80 border-blue-400' 
                        : 'cursor-grab hover:shadow-md hover:border-gray-300 active:cursor-grabbing'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      </div>
                      <h4 className="font-medium text-gray-900 flex-1 text-center">{column.name}</h4>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getColumnTypeColor(column.type)}`}>
                        {column.type}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      <div className="font-medium mb-1">Sample data:</div>
                      {column.sampleData.slice(0, 3).map((sample, idx) => (
                        <div key={idx} className="truncate">
                          {sample || '<empty>'}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {usedCount > 0 ? `Used ${usedCount} ${usedCount === 1 ? 'time' : 'times'}` : 'Not used yet'}
                      </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}