import { useState, useCallback } from 'react'
import { useForm, UseFormOptions, FormState, FormActions } from './useForm'
import { useApi } from './useApi'
import { useNotification } from './useNotification'
import { ApiError } from '../api/apiClient'

// ===============================
// Types
// ===============================

export interface UseApiFormOptions<T, R = any> extends Omit<UseFormOptions<T>, 'onSubmit'> {
  onSubmit: (values: T) => Promise<R>
  onSuccess?: (data: R, values: T) => void
  onError?: (error: ApiError, values: T) => void
  showSuccessNotification?: boolean
  showErrorNotification?: boolean
  successMessage?: string | ((data: R) => string)
  errorMessage?: string | ((error: ApiError) => string)
  resetOnSuccess?: boolean
  optimisticUpdate?: (values: T) => void
  revertOptimisticUpdate?: () => void
}

export interface UseApiFormReturn<T, R = any> extends FormState<T>, FormActions<T> {
  submitData: R | null
  isSubmitting: boolean
  submitError: ApiError | null
  retrySubmit: () => Promise<void>
  clearSubmitError: () => void
}

// ===============================
// Main Hook
// ===============================

export function useApiForm<T extends Record<string, any>, R = any>(
  options: UseApiFormOptions<T, R>
): UseApiFormReturn<T, R> {
  const {
    onSubmit,
    onSuccess,
    onError,
    showSuccessNotification = true,
    showErrorNotification = true,
    successMessage,
    errorMessage,
    resetOnSuccess = false,
    optimisticUpdate,
    revertOptimisticUpdate,
    ...formOptions
  } = options

  const { addNotification } = useNotification()
  const [submitData, setSubmitData] = useState<R | null>(null)
  const [lastSubmittedValues, setLastSubmittedValues] = useState<T | null>(null)

  const apiSubmit = useCallback(async (values: T): Promise<void> => {
    setLastSubmittedValues(values)
    
    // Apply optimistic update if provided
    if (optimisticUpdate) {
      optimisticUpdate(values)
    }

    try {
      const result = await onSubmit(values)
      setSubmitData(result)

      // Handle success
      if (onSuccess) {
        onSuccess(result, values)
      }

      if (showSuccessNotification) {
        const message = typeof successMessage === 'function' 
          ? successMessage(result)
          : successMessage || 'Operation completed successfully'
        addNotification({ type: 'success', title: message })
      }

      if (resetOnSuccess) {
        reset()
      }
    } catch (error) {
      // Revert optimistic update on error
      if (revertOptimisticUpdate) {
        revertOptimisticUpdate()
      }

      const apiError = error instanceof ApiError ? error : new ApiError('Unknown error', 0)

      if (onError) {
        onError(apiError, values)
      }

      if (showErrorNotification) {
        const message = typeof errorMessage === 'function'
          ? errorMessage(apiError)
          : errorMessage || apiError.message || 'Operation failed'
        addNotification({ type: 'error', title: message })
      }

      throw apiError
    }
  }, [
    onSubmit,
    onSuccess,
    onError,
    optimisticUpdate,
    revertOptimisticUpdate,
    showSuccessNotification,
    showErrorNotification,
    successMessage,
    errorMessage,
    addNotification,
    resetOnSuccess
  ])

  const form = useForm<T>({
    ...formOptions,
    onSubmit: apiSubmit
  })

  const { reset } = form

  const retrySubmit = useCallback(async () => {
    if (lastSubmittedValues) {
      await form.handleSubmit()
    }
  }, [lastSubmittedValues, form])

  const {
    data: submitDataFromApi,
    error: submitErrorFromApi,
    clearError: clearSubmitErrorFromApi
  } = useApi()

  return {
    ...form,
    submitData: submitData || submitDataFromApi,
    submitError: submitErrorFromApi,
    retrySubmit,
    clearSubmitError: clearSubmitErrorFromApi
  }
}

// ===============================
// Specialized API Form Hooks
// ===============================

export function useCreateForm<T extends Record<string, any>, R = any>(
  createFn: (values: T) => Promise<R>,
  options: Partial<Omit<UseApiFormOptions<T, R>, 'onSubmit'>> = {}
) {
  return useApiForm({
    ...options,
    onSubmit: createFn,
    successMessage: options.successMessage || 'Item created successfully',
    resetOnSuccess: options.resetOnSuccess ?? true
  } as UseApiFormOptions<T, R>)
}

export function useUpdateForm<T extends Record<string, any>, R = any>(
  updateFn: (values: T) => Promise<R>,
  options: Partial<Omit<UseApiFormOptions<T, R>, 'onSubmit'>> = {}
) {
  return useApiForm({
    ...options,
    onSubmit: updateFn,
    successMessage: options.successMessage || 'Item updated successfully',
    resetOnSuccess: options.resetOnSuccess ?? false
  } as UseApiFormOptions<T, R>)
}

export function useDeleteForm<T extends Record<string, any>, R = any>(
  deleteFn: (values: T) => Promise<R>,
  options: Partial<Omit<UseApiFormOptions<T, R>, 'onSubmit'>> = {}
) {
  return useApiForm({
    ...options,
    onSubmit: deleteFn,
    successMessage: options.successMessage || 'Item deleted successfully',
    resetOnSuccess: options.resetOnSuccess ?? true
  } as UseApiFormOptions<T, R>)
}

// ===============================
// Multi-step Form Hook
// ===============================

export interface UseMultiStepFormOptions<T> {
  steps: Array<{
    name: string
    fields: (keyof T)[]
    validationRules?: Partial<Record<keyof T, any>>
    onStepComplete?: (values: Partial<T>) => void
  }>
  initialValues: T
  onComplete: (values: T) => Promise<void>
  validateOnStepChange?: boolean
  allowBackNavigation?: boolean
}

export interface UseMultiStepFormReturn<T> {
  currentStep: number
  currentStepName: string
  isFirstStep: boolean
  isLastStep: boolean
  canGoNext: boolean
  canGoBack: boolean
  progress: number
  values: T
  errors: Record<string, any>
  touched: Record<string, boolean>
  isSubmitting: boolean
  goToStep: (step: number) => void
  nextStep: () => Promise<void>
  prevStep: () => void
  jumpToStep: (step: number) => void
  handleSubmit: () => Promise<void>
  setFieldValue: (field: keyof T, value: any) => void
  reset: () => void
}

export function useMultiStepForm<T extends Record<string, any>>(
  options: UseMultiStepFormOptions<T>
): UseMultiStepFormReturn<T> {
  const {
    steps,
    initialValues,
    onComplete,
    validateOnStepChange = true,
    allowBackNavigation = true
  } = options

  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  const currentStepConfig = steps[currentStep]
  const currentStepFields = currentStepConfig?.fields || []

  // Create validation rules for current step
  const currentStepValidationRules = currentStepFields.reduce((acc, field) => {
    if (currentStepConfig.validationRules?.[field]) {
      acc[field] = currentStepConfig.validationRules[field]
    }
    return acc
  }, {} as Record<keyof T, any>)

  const form = useForm<T>({
    initialValues,
    validationRules: currentStepValidationRules,
    validateOnChange: true,
    validateOnBlur: true
  })

  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === steps.length - 1
  const progress = ((currentStep + 1) / steps.length) * 100

  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    const stepFields = currentStepFields
    let isValid = true

    for (const field of stepFields) {
      const fieldValid = await form.validateField(field)
      if (!fieldValid) {
        isValid = false
      }
    }

    return isValid
  }, [currentStepFields, form])

  const canGoNext = !form.isSubmitting && 
    (completedSteps.has(currentStep) || currentStepFields.every(field => 
      !form.errors[field] && form.touched[field]
    ))

  const canGoBack = allowBackNavigation && !isFirstStep && !form.isSubmitting

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < steps.length) {
      setCurrentStep(step)
    }
  }, [steps.length])

  const nextStep = useCallback(async () => {
    if (validateOnStepChange) {
      const isValid = await validateCurrentStep()
      if (!isValid) {
        return
      }
    }

    if (currentStepConfig.onStepComplete) {
      const stepValues = currentStepFields.reduce((acc, field) => {
        acc[field] = form.values[field]
        return acc
      }, {} as Partial<T>)
      currentStepConfig.onStepComplete(stepValues)
    }

    setCompletedSteps(prev => new Set([...prev, currentStep]))

    if (!isLastStep) {
      setCurrentStep(prev => prev + 1)
    }
  }, [
    validateOnStepChange,
    validateCurrentStep,
    currentStepConfig,
    currentStepFields,
    form.values,
    isLastStep,
    currentStep
  ])

  const prevStep = useCallback(() => {
    if (canGoBack) {
      setCurrentStep(prev => prev - 1)
    }
  }, [canGoBack])

  const jumpToStep = useCallback((step: number) => {
    if (completedSteps.has(step) || step <= currentStep) {
      goToStep(step)
    }
  }, [completedSteps, currentStep, goToStep])

  const handleSubmit = useCallback(async () => {
    if (isLastStep) {
      const isValid = await form.validateForm()
      if (isValid) {
        await onComplete(form.values)
      }
    } else {
      await nextStep()
    }
  }, [isLastStep, form, onComplete, nextStep])

  const reset = useCallback(() => {
    form.reset()
    setCurrentStep(0)
    setCompletedSteps(new Set())
  }, [form])

  return {
    currentStep,
    currentStepName: currentStepConfig?.name || '',
    isFirstStep,
    isLastStep,
    canGoNext,
    canGoBack,
    progress,
    values: form.values,
    errors: form.errors,
    touched: form.touched as Record<string, boolean>,
    isSubmitting: form.isSubmitting,
    goToStep,
    nextStep,
    prevStep,
    jumpToStep,
    handleSubmit,
    setFieldValue: form.setFieldValue,
    reset
  }
}
