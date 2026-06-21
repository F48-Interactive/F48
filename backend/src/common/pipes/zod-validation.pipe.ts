import {
  type PipeTransform,
  Injectable,
  type ArgumentMetadata,
} from '@nestjs/common';
import type { ZodSchema, ZodError } from 'zod';
import { BadRequestError } from '../../lib/errors.js';
import { ErrorCodes } from '../constants/error-codes.js';

/**
 * Zod Validation Pipe.
 * Validates request data against a Zod schema.
 * Returns parsed (transformed) data on success, throws BadRequestError with
 * field-level details on failure.
 *
 * @example
 * @Post()
 * create(@Body(new ZodValidationPipe(createTournamentSchema)) dto: CreateTournamentDto) { ... }
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== 'body') return value;

    const result = this.schema.safeParse(value);

    if (!result.success) {
      const fieldErrors = this.formatErrors(result.error);
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Validation failed',
        { fields: fieldErrors },
      );
    }

    return result.data;
  }

  private formatErrors(
    error: ZodError,
  ): Record<string, string[]> {
    const fieldErrors: Record<string, string[]> = {};

    for (const issue of error.issues) {
      const path = issue.path.join('.') || '_root';
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(issue.message);
    }

    return fieldErrors;
  }
}
