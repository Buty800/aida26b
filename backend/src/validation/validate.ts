import type { Response } from 'express';

// Validation core is shared with the frontend; this module adds the Express-only response helper.
export * from '../../../shared/src/validation/validate';

export function sendErrorsIfInvalid<T>(
  res: Response,
  result: { data: T } | { errors: string[] },
): result is { errors: string[] } {
  if ('errors' in result) {
    res.status(400).json({ error: result.errors.join('; ') });
    return true;
  }
  return false;
}
