"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";

export interface FieldError {
  message: string;
}

export interface FieldMeta {
  touched: boolean;
  dirty: boolean;
  valid: boolean;
}

export interface UseFieldReturn<T> {
  value: T;
  onChange: (value: T | ((prev: T) => T)) => void;
  onBlur: () => void;
  error: FieldError | null;
  meta: FieldMeta;
  setError: (error: string | null) => void;
  reset: () => void;
}

export function useField<T>(initialValue: T, validate?: (value: T) => string | null): UseFieldReturn<T> {
  const [value, setValue] = useState<T>(initialValue);
  const [error, setErrorState] = useState<FieldError | null>(null);
  const [touched, setTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  const initialRef = useRef(initialValue);

  const validateField = useCallback((val: T) => {
    if (validate) {
      const errorMsg = validate(val);
      setErrorState(errorMsg ? { message: errorMsg } : null);
      return !errorMsg;
    }
    setErrorState(null);
    return true;
  }, [validate]);

  const onChange = useCallback((newValue: T | ((prev: T) => T)) => {
    setValue(prev => {
      const resolved = typeof newValue === "function" ? (newValue as (prev: T) => T)(prev) : newValue;
      if (!dirty && resolved !== initialRef.current) setDirty(true);
      validateField(resolved);
      return resolved;
    });
  }, [dirty, validateField]);

  const onBlur = useCallback(() => {
    if (!touched) setTouched(true);
    validateField(value);
  }, [touched, value, validateField]);

  const setError = useCallback((err: string | null) => {
    setErrorState(err ? { message: err } : null);
  }, []);

  const reset = useCallback(() => {
    setValue(initialRef.current);
    setErrorState(null);
    setTouched(false);
    setDirty(false);
  }, []);

  useEffect(() => {
    validateField(value);
  }, [value, validateField]);

  return {
    value,
    onChange,
    onBlur,
    error,
    meta: { touched, dirty, valid: !error },
    setError,
    reset,
  };
}

export interface UseFormReturn<T extends Record<string, unknown>> {
  values: T;
  errors: Record<keyof T, FieldError | null>;
  meta: Record<keyof T, FieldMeta>;
  isSubmitting: boolean;
  isValid: boolean;
  isDirty: boolean;
  handleChange: (name: keyof T) => (value: T[keyof T] | ((prev: T[keyof T]) => T[keyof T])) => void;
  handleBlur: (name: keyof T) => () => void;
  setFieldValue: (name: keyof T, value: T[keyof T]) => void;
  setFieldError: (name: keyof T, error: string | null) => void;
  setValues: (values: Partial<T>) => void;
  validateForm: () => boolean;
  handleSubmit: (onSubmit: (values: T) => Promise<void> | void) => (e: React.FormEvent) => Promise<void>;
  resetForm: () => void;
}

export function useForm<T extends Record<string, unknown>>(
  initialValues: T,
  validate?: (values: T) => Partial<Record<keyof T, string>>
): UseFormReturn<T> {
  const [values, setValuesState] = useState<T>(initialValues);
  const [errors, setErrorsState] = useState<Record<keyof T, FieldError | null>>({} as Record<keyof T, FieldError | null>);
  const [touched, setTouchedState] = useState<Record<keyof T, boolean>>({} as Record<keyof T, boolean>);
  const [dirty, setDirtyState] = useState<Record<keyof T, boolean>>({} as Record<keyof T, boolean>);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initialRef = useRef(initialValues);

  const validateForm = useCallback(() => {
    if (!validate) return true;
    const validationErrors = validate(values);
    const newErrors: Record<keyof T, FieldError | null> = {} as Record<keyof T, FieldError | null>;
    let isValid = true;
    (Object.keys(validationErrors) as (keyof T)[]).forEach(key => {
      const msg = validationErrors[key];
      if (msg) {
        newErrors[key] = { message: msg };
        isValid = false;
      } else {
        newErrors[key] = null;
      }
    });
    setErrorsState(newErrors);
    return isValid;
  }, [values, validate]);

  const handleChange = useCallback((name: keyof T) => (newValue: T[keyof T] | ((prev: T[keyof T]) => T[keyof T])) => {
    const resolved = typeof newValue === "function" ? (newValue as (prev: T[keyof T]) => T[keyof T])(values[name]) : newValue;
    setValuesState(prev => {
      if (!dirty[name] && resolved !== initialRef.current[name]) {
        setDirtyState(prev => ({ ...prev, [name]: true }));
      }
      return { ...prev, [name]: resolved };
    });
    // Validate on change if already touched
    if (touched[name] && validate) {
      const validationErrors = validate({ ...values, [name]: resolved });
      if (validationErrors[name]) {
        setErrorsState(prev => ({ ...prev, [name]: { message: validationErrors[name]! } }));
      } else {
        setErrorsState(prev => ({ ...prev, [name]: null }));
      }
    }
  }, [dirty, touched, values, validate]);

  const handleBlur = useCallback((name: keyof T) => () => {
    setTouchedState(prev => ({ ...prev, [name]: true }));
    if (validate) {
      const validationErrors = validate(values);
      if (validationErrors[name]) {
        setErrorsState(prev => ({ ...prev, [name]: { message: validationErrors[name]! } }));
      } else {
        setErrorsState(prev => ({ ...prev, [name]: null }));
      }
    }
  }, [values, validate]);

  const setFieldValue = useCallback((name: keyof T, value: T[keyof T]) => {
    setValuesState(prev => ({ ...prev, [name]: value }));
  }, []);

  const setFieldError = useCallback((name: keyof T, error: string | null) => {
    setErrorsState(prev => ({ ...prev, [name]: error ? { message: error } : null }));
  }, []);

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState(prev => ({ ...prev, ...newValues }));
  }, []);

  const handleSubmit = useCallback((onSubmit: (values: T) => Promise<void> | void) => async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate) {
      const validationErrors = validate(values);
      const newErrors: Record<keyof T, FieldError | null> = {} as Record<keyof T, FieldError | null>;
      let isValid = true;
      (Object.keys(validationErrors) as (keyof T)[]).forEach(key => {
        const msg = validationErrors[key];
        if (msg) {
          newErrors[key] = { message: msg };
          isValid = false;
        } else {
          newErrors[key] = null;
        }
        setTouchedState(prev => ({ ...prev, [key]: true }));
      });
      setErrorsState(newErrors);
      if (!isValid) return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validate]);

  const resetForm = useCallback(() => {
    setValuesState(initialRef.current);
    setErrorsState({} as Record<keyof T, FieldError | null>);
    setTouchedState({} as Record<keyof T, boolean>);
    setDirtyState({} as Record<keyof T, boolean>);
  }, []);

  const isValid = Object.values(errors).every(e => !e);
  const isDirty = Object.values(dirty).some(d => d);

  const meta: Record<keyof T, FieldMeta> = {} as Record<keyof T, FieldMeta>;
  (Object.keys(values) as (keyof T)[]).forEach(key => {
    meta[key] = {
      touched: touched[key] ?? false,
      dirty: dirty[key] ?? false,
      valid: !errors[key],
    };
  });

  return {
    values,
    errors,
    meta,
    isSubmitting,
    isValid,
    isDirty,
    handleChange,
    handleBlur,
    setFieldValue,
    setFieldError,
    setValues,
    validateForm,
    handleSubmit,
    resetForm,
  };
}

// Input Component
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  onChange?: (value: string) => void;
}

export function Input({ label, error, hint, icon, fullWidth = true, onChange, ...props }: InputProps) {
  const id = props.id || props.name;
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };
  return (
    <div className="form-group" style={fullWidth ? {} : { width: "100%" }}>
      {label && <label htmlFor={id}>{label}</label>}
      <div className="input-with-icon" style={icon ? {} : undefined}>
        {icon}
        <input
          id={id}
          className={error ? "input-error" : ""}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          onChange={handleInputChange}
          {...props}
        />
      </div>
      {error && <p id={`${id}-error`} style={{ color: "var(--red)", fontSize: 12, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        {error}
      </p>}
      {hint && !error && <p id={`${id}-hint`} style={{ color: "var(--text-3)", fontSize: 12, marginTop: 6 }}>{hint}</p>}
    </div>
  );
}

// Select Component
interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label?: string;
  error?: string | null;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  fullWidth?: boolean;
  onChange?: (value: string) => void;
}

export function Select({ label, error, hint, options, placeholder, fullWidth = true, onChange, ...props }: SelectProps) {
  const id = props.id || props.name;
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };
  return (
    <div className="form-group" style={fullWidth ? {} : { width: "100%" }}>
      {label && <label htmlFor={id}>{label}</label>}
      <select
        id={id}
        className={error ? "input-error" : ""}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        onChange={handleSelectChange}
        {...props}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      {error && <p id={`${id}-error`} style={{ color: "var(--red)", fontSize: 12, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        {error}
      </p>}
      {hint && !error && <p id={`${id}-hint`} style={{ color: "var(--text-3)", fontSize: 12, marginTop: 6 }}>{hint}</p>}
    </div>
  );
}

// Textarea Component
interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  label?: string;
  error?: string | null;
  hint?: string;
  fullWidth?: boolean;
  onChange?: (value: string) => void;
}

export function Textarea({ label, error, hint, fullWidth = true, onChange, ...props }: TextareaProps) {
  const id = props.id || props.name;
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };
  return (
    <div className="form-group" style={fullWidth ? {} : { width: "100%" }}>
      {label && <label htmlFor={id}>{label}</label>}
      <textarea
        id={id}
        className={error ? "input-error" : ""}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        onChange={handleTextareaChange}
        {...props}
      />
      {error && <p id={`${id}-error`} style={{ color: "var(--red)", fontSize: 12, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        {error}
      </p>}
      {hint && !error && <p id={`${id}-hint`} style={{ color: "var(--text-3)", fontSize: 12, marginTop: 6 }}>{hint}</p>}
    </div>
  );
}

// FormRow Component
export function FormRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {children}
    </div>
  );
}