import type { AnalyzerErrorCode } from './types.js';

/** Custom error class for analyzer errors with typed error codes. */
export class AnalyzerError extends Error {
  readonly code: AnalyzerErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: AnalyzerErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AnalyzerError';
    this.code = code;
    this.details = details;
  }
}
