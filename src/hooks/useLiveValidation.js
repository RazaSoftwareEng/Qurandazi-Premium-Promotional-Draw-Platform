import { useEffect } from 'react'
import { validate } from '@/utils/validation'

/**
 * After a failed submit (i.e. while errors are showing), re-validates on every
 * change so messages update live and disappear as soon as a field is fixed.
 */
export function useLiveValidation(schema, values, errors, setErrors) {
  const active = Object.keys(errors).length > 0
  useEffect(() => {
    if (active) setErrors(validate(schema, values))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values])
}
