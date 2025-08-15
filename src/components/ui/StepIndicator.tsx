import React from 'react'
import { WizardStep } from '../../types'
import { Check } from 'lucide-react'

interface StepIndicatorProps {
  steps: WizardStep[]
  currentStep: number
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between w-full max-w-4xl mx-auto mb-12">
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center">
            <div
              className={`
                w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-300 shadow-lg
                ${
                  step.completed
                    ? 'bg-green-500 text-white'
                    : step.active
                    ? 'bg-red-500 text-white'
                    : index < currentStep
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }
              `}
            >
              {step.completed ? (
                <Check className="w-8 h-8" />
              ) : (
                step.id
              )}
            </div>
            <div className="mt-3 text-center">
              <h3 className={`font-semibold ${step.active ? 'text-red-600' : 'text-gray-600'}`}>
                {step.title}
              </h3>
              <p className="text-sm text-gray-500 max-w-32">
                {step.description}
              </p>
            </div>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`
                flex-1 h-1 mx-4 rounded-full transition-all duration-300
                ${
                  index < currentStep - 1
                    ? 'bg-gradient-to-r from-orange-400 to-red-500'
                    : 'bg-gray-200'
                }
              `}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}