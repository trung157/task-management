import { useState, useCallback, useRef, useEffect } from 'react'

// ===============================
// Advanced Form Types
// ===============================

export interface ValidationRule {
  required?: boolean
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  email?: boolean
  url?: boolean
  number?: boolean
  custom?: (value: any, formValues?: any) => string | Promise<string> | undefined
  asyncValidator?: (value: any, formValues?: any) => Promise<string | undefined>
}

export interface UseFormOptions<T> {
  initialValues: T
  validationRules?: Partial<Record<keyof T, ValidationRule>>
  onSubmit?: (values: T) => Promise<void> | void
  validateOnChange?: boolean
  validateOnBlur?: boolean
  validateOnMount?: boolean
  resetOnSubmit?: boolean
  enableReinitialize?: boolean
  validateAsync?: boolean
  debounceMs?: number
  transformValues?: (values: T) => T
  onValidationStateChange?: (isValid: boolean) => void
}

export interface FieldError {
  message: string
  type?: 'validation' | 'async' | 'submit' | 'custom'
}

export interface FormState<T> {
  values: T
  errors: Partial<Record<keyof T, FieldError>>
  touched: Partial<Record<keyof T, boolean>>
  isSubmitting: boolean
  isValidating: boolean
  isValid: boolean
  isDirty: boolean
  submitCount: number
  validationAttempts: number
}

export interface FormActions<T> {
  setFieldValue: (field: keyof T, value: any) => void
  setFieldError: (field: keyof T, error: FieldError | null) => void
  setFieldTouched: (field: keyof T, touched: boolean) => void
  setValues: (values: Partial<T>) => void
  setErrors: (errors: Partial<Record<keyof T, FieldError>>) => void
  validateField: (field: keyof T) => Promise<boolean>
  validateForm: () => Promise<boolean>
  handleSubmit: (event?: React.FormEvent) => Promise<void>
  reset: (values?: T) => void
  resetForm: () => void
  getFieldProps: (field: keyof T) => FieldProps
  getFieldHelpers: (field: keyof T) => FieldHelpers
}

export interface FieldProps {
  name: string
  value: any
  onChange: (event: React.ChangeEvent<any>) => void
  onBlur: (event: React.FocusEvent<any>) => void
}

export interface FieldHelpers {
  setValue: (value: any) => void
  setTouched: (touched: boolean) => void
  setError: (error: FieldError | null) => void
  validate: () => Promise<boolean>
}

// ===============================
// Validation helpers
// ===============================

async function validateValue(value: any, rules: ValidationRule, formValues?: any): Promise<string | undefined> {
  if (rules.required && (value === null || value === undefined || value === '')) {
    return 'This field is required'
  }

  if (value && rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
    return `Minimum length is ${rules.minLength} characters`
  }

  if (value && rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
    return `Maximum length is ${rules.maxLength} characters`
  }

  if (value && rules.min && typeof value === 'number' && value < rules.min) {
    return `Minimum value is ${rules.min}`
  }

  if (value && rules.max && typeof value === 'number' && value > rules.max) {
    return `Maximum value is ${rules.max}`
  }

  if (value && rules.email && typeof value === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) {
      return 'Invalid email format'
    }
  }

  if (value && rules.url && typeof value === 'string') {
    try {
      new URL(value)
    } catch {
      return 'Invalid URL format'
    }
  }

  if (value && rules.number && isNaN(Number(value))) {
    return 'Must be a valid number'
  }

  if (value && rules.pattern && !rules.pattern.test(String(value))) {
    return 'Invalid format'
  }

  if (rules.asyncValidator) {
    try {
      return await rules.asyncValidator(value, formValues)
    } catch (error) {
      return 'Validation failed'
    }
  }

  if (rules.custom) {
    const result = rules.custom(value, formValues)
    if (result instanceof Promise) {
      try {
        return await result
      } catch (error) {
        return 'Validation failed'
      }
    }
    return result
  }

  return undefined
}

// ===============================
// Main useForm Hook
// ===============================

export function useForm<T extends Record<string, any>>(
  options: UseFormOptions<T>
): FormState<T> & FormActions<T> {
  const {
    initialValues,
    validationRules = {} as Partial<Record<keyof T, ValidationRule>>,
    onSubmit,
    validateOnChange = false,
    validateOnBlur = true,
    resetOnSubmit = false,
  } = options

  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof T, FieldError>>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [submitCount, setSubmitCount] = useState(0)
  const [validationAttempts, setValidationAttempts] = useState(0)

  const initialValuesRef = useRef(initialValues)

  // Update initial values ref when they change
  useEffect(() => {
    initialValuesRef.current = initialValues
  }, [initialValues])

  // Calculate derived state
  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValuesRef.current)
  const hasErrors = Object.keys(errors).length > 0
  const isValid = !hasErrors

  // Validation functions
  const validateField = useCallback(async (field: keyof T): Promise<boolean> => {
    const rules = validationRules[field]
    if (!rules) return true

    setIsValidating(true)
    setValidationAttempts(prev => prev + 1)

    try {
      const error = await validateValue(values[field], rules, values)
      
      setErrors(prev => {
        if (!error) {
          const newErrors = { ...prev }
          delete newErrors[field]
          return newErrors
        }
        return {
          ...prev,
          [field]: {
            message: error,
            type: 'validation',
          },
        }
      })
      
      return !error
    } finally {
      setIsValidating(false)
    }
  }, [validationRules, values])

  const validateForm = useCallback(async (): Promise<boolean> => {
    setIsValidating(true)
    const newErrors: Partial<Record<keyof T, FieldError>> = {}
    let isFormValid = true

    try {
      const validationPromises = Object.keys(validationRules).map(async (field) => {
        const rules = validationRules[field as keyof T]
        if (rules) {
          const error = await validateValue(values[field as keyof T], rules, values)
          if (error) {
            (newErrors as any)[field] = {
              message: error,
              type: 'validation',
            }
            isFormValid = false
          }
        }
      })

      await Promise.all(validationPromises)
      setErrors(newErrors)
      return isFormValid
    } finally {
      setIsValidating(false)
    }
  }, [validationRules, values])

  // Field manipulation functions
  const setFieldValue = useCallback((field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }))
    
    if (validateOnChange) {
      validateField(field)
    }
  }, [validateOnChange, validateField])

  const setFieldError = useCallback((field: keyof T, error: FieldError | null) => {
    setErrors(prev => {
      if (error === null) {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      }
      return { ...prev, [field]: error }
    })
  }, [])

  const setFieldTouched = useCallback((field: keyof T, touchedValue: boolean) => {
    setTouched(prev => ({ ...prev, [field]: touchedValue }))
    
    if (touchedValue && validateOnBlur) {
      validateField(field)
    }
  }, [validateOnBlur, validateField])

  const setFormValues = useCallback((newValues: Partial<T>) => {
    setValues(prev => ({ ...prev, ...newValues }))
  }, [])

  const setFormErrors = useCallback((newErrors: Partial<Record<keyof T, FieldError>>) => {
    setErrors(newErrors)
  }, [])

  // Form submission
  const handleSubmit = useCallback(async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault()
    }

    setSubmitCount(prev => prev + 1)
    
    // Mark all fields as touched
    const allTouched = Object.keys(values).reduce((acc, key) => {
      acc[key as keyof T] = true
      return acc
    }, {} as Partial<Record<keyof T, boolean>>)
    setTouched(allTouched)

    // Validate form
    const isFormValid = await validateForm()
    if (!isFormValid) {
      return
    }

    setIsSubmitting(true)
    try {
      if (onSubmit) {
        await onSubmit(values)
      }
      
      if (resetOnSubmit) {
        reset()
      }
    } catch (error) {
      // Handle submission errors
      console.error('Form submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [values, validateForm, onSubmit, resetOnSubmit])

  // Reset functions
  const reset = useCallback((newValues?: T) => {
    const resetValues = newValues || initialValuesRef.current
    setValues(resetValues)
    setErrors({})
    setTouched({})
    setIsSubmitting(false)
    setSubmitCount(0)
  }, [])

  const resetForm = useCallback(() => {
    reset()
  }, [reset])

  // Field helpers
  const getFieldProps = useCallback((field: keyof T): FieldProps => {
    return {
      name: String(field),
      value: values[field] || '',
      onChange: (event: React.ChangeEvent<any>) => {
        setFieldValue(field, event.target.value)
      },
      onBlur: () => {
        setFieldTouched(field, true)
        if (validateOnBlur) {
          validateField(field)
        }
      }
    }
  }, [values, setFieldValue, setFieldTouched, validateOnBlur, validateField])

  const getFieldHelpers = useCallback((field: keyof T): FieldHelpers => {
    return {
      setValue: (value: any) => setFieldValue(field, value),
      setTouched: (touched: boolean) => setFieldTouched(field, touched),
      setError: (error: FieldError | null) => setFieldError(field, error),
      validate: () => validateField(field)
    }
  }, [setFieldValue, setFieldTouched, setFieldError, validateField])

  return {
    // State
    values,
    errors,
    touched,
    isSubmitting,
    isValidating,
    isValid,
    isDirty,
    submitCount,
    validationAttempts,
    
    // Actions
    setFieldValue,
    setFieldError,
    setFieldTouched,
    setValues: setFormValues,
    setErrors: setFormErrors,
    validateField,
    validateForm,
    handleSubmit,
    reset,
    resetForm,
    getFieldProps,
    getFieldHelpers,
  }
}

// ===============================
// Field-specific hooks
// ===============================

export interface UseFieldOptions<T> {
  name: keyof T
  form: FormState<T> & FormActions<T>
  validate?: (value: any) => string | undefined
}

export function useField<T extends Record<string, any>>(options: UseFieldOptions<T>) {
  const { name, form, validate } = options

  const value = form.values[name]
  const error = form.errors[name]
  const touched = form.touched[name]

  const onChange = useCallback((newValue: any) => {
    form.setFieldValue(name, newValue)
    
    if (validate) {
      const validationError = validate(newValue)
      form.setFieldError(name, validationError ? { message: validationError } : null)
    }
  }, [name, form, validate])

  const onBlur = useCallback(() => {
    form.setFieldTouched(name, true)
  }, [name, form])

  const onFocus = useCallback(() => {
    // Clear error when field is focused
    if (error) {
      form.setFieldError(name, null)
    }
  }, [name, form, error])

  return {
    value,
    error,
    touched,
    onChange,
    onBlur,
    onFocus,
    name: name as string,
    hasError: !!error && touched,
  }
}

// ===============================
// Specialized form hooks
// ===============================

export interface UseFormArrayOptions<T> {
  initialItems: T[]
  maxItems?: number
  minItems?: number
}

export function useFormArray<T>(options: UseFormArrayOptions<T>) {
  const { initialItems, maxItems, minItems = 0 } = options
  const [items, setItems] = useState<T[]>(initialItems)

  const addItem = useCallback((item: T) => {
    if (maxItems && items.length >= maxItems) return false
    
    setItems(prev => [...prev, item])
    return true
  }, [items.length, maxItems])

  const removeItem = useCallback((index: number) => {
    if (items.length <= minItems) return false
    
    setItems(prev => prev.filter((_, i) => i !== index))
    return true
  }, [items.length, minItems])

  const updateItem = useCallback((index: number, item: Partial<T>) => {
    setItems(prev => prev.map((prevItem, i) => 
      i === index ? { ...prevItem, ...item } : prevItem
    ))
  }, [])

  const moveItem = useCallback((fromIndex: number, toIndex: number) => {
    setItems(prev => {
      const newItems = [...prev]
      const item = newItems.splice(fromIndex, 1)[0]
      newItems.splice(toIndex, 0, item)
      return newItems
    })
  }, [])

  const reset = useCallback((newItems?: T[]) => {
    setItems(newItems || initialItems)
  }, [initialItems])

  return {
    items,
    addItem,
    removeItem,
    updateItem,
    moveItem,
    reset,
    canAdd: !maxItems || items.length < maxItems,
    canRemove: items.length > minItems,
  }
}

// ===============================
// Common validation rules
// ===============================

export const validationRules = {
  required: { required: true },
  email: { 
    required: true, 
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    custom: (value: string) => {
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return 'Please enter a valid email address'
      }
    }
  },
  password: { 
    required: true, 
    min: 8,
    custom: (value: string) => {
      if (value && value.length < 8) return 'Password must be at least 8 characters'
      if (value && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
        return 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      }
    }
  },
  url: {
    pattern: /^https?:\/\/.+/,
    custom: (value: string) => {
      if (value && !/^https?:\/\/.+/.test(value)) {
        return 'Please enter a valid URL'
      }
    }
  },
  phone: {
    pattern: /^\+?[\d\s-()]+$/,
    custom: (value: string) => {
      if (value && !/^\+?[\d\s-()]+$/.test(value)) {
        return 'Please enter a valid phone number'
      }
    }
  },
}
