import { forwardRef, useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

function Field({ id, label, error, help, required, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && <span className="ml-0.5 text-red-600" aria-hidden>*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="error-text" role="alert">
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="help-text">
          {help}
        </p>
      ) : null}
    </div>
  )
}

// Safe default length limits per input type (an explicit maxLength prop wins)
const DEFAULT_MAX = { text: 200, email: 254, password: 72, tel: 16, search: 100, url: 300 }

/** Phone input: only digits, spaces, dashes and one leading "+". */
export const sanitizePhone = (v) => {
  const s = String(v || '').replace(/[^\d+\- ]/g, '')
  return (s.startsWith('+') ? '+' : '') + s.replace(/\+/g, '')
}

/** Text-like input with label, validation message and optional leading icon / password toggle. */
const FormInput = forwardRef(function FormInput(
  { label, error, help, icon: Icon, type = 'text', className = '', inputClassName = '', required, maxLength, onChange, ...rest },
  ref,
) {
  const id = useId()
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  const isTel = type === 'tel'
  const limit = maxLength ?? DEFAULT_MAX[type]
  const handleChange =
    isTel && onChange
      ? (e) => {
          const clean = sanitizePhone(e.target.value)
          if (clean !== e.target.value) e.target.value = clean
          onChange(e)
        }
      : onChange
  return (
    <Field id={id} label={label} error={error} help={help} required={required} className={className}>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />}
        <input
          ref={ref}
          id={id}
          type={isPassword && show ? 'text' : type}
          required={required}
          maxLength={limit}
          onChange={handleChange}
          {...(isTel ? { inputMode: 'tel' } : type === 'email' ? { inputMode: 'email', autoCapitalize: 'none', spellCheck: false } : {})}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
          className={`input ${Icon ? 'pl-9' : ''} ${isPassword ? 'pr-10' : ''} ${error ? 'input-error' : ''} ${inputClassName}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-muted hover:text-navy-900"
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </Field>
  )
})

export const TextArea = forwardRef(function TextArea({ label, error, help, className = '', rows = 4, required, maxLength = 2000, ...rest }, ref) {
  const id = useId()
  return (
    <Field id={id} label={label} error={error} help={help} required={required} className={className}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        required={required}
        maxLength={maxLength}
        aria-invalid={Boolean(error) || undefined}
        className={`input resize-y ${error ? 'input-error' : ''}`}
        {...rest}
      />
    </Field>
  )
})

export const Select = forwardRef(function Select(
  { label, error, help, options = [], placeholder, className = '', required, children, ...rest },
  ref,
) {
  const id = useId()
  return (
    <Field id={id} label={label} error={error} help={help} required={required} className={className}>
      <select
        ref={ref}
        id={id}
        required={required}
        aria-invalid={Boolean(error) || undefined}
        className={`input appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9 ${error ? 'input-error' : ''}`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B7385' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
    </Field>
  )
})

export function Toggle({ checked, onChange, label, description, disabled }) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-semibold text-navy-900">
          {label}
        </label>
        {description && <p className="text-xs text-ink-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          checked ? 'bg-gold-500' : 'bg-ivory-300'
        }`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}

export default FormInput
