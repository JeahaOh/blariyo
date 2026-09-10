export interface Operation {
  operationId: string;
  pattern: string;
  params: Record<string, string>;
  parameters?: unknown[];
  requestBody?: unknown;
  responses: Record<string, unknown>;
}
export function matchOperation(method: string, path: string): Operation | undefined;
export function normalizeInput(value: unknown): unknown;
export function validateRequest(
  operation: Operation,
  request: {
    query?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    body: unknown;
  }
): boolean;
export function validateResponse(operation: Operation, status: number, body: unknown): boolean;
export function schemaValidator(schema: unknown): (input: unknown) => boolean;
export function deref(value: unknown): unknown;
export const contract: { paths: Record<string, Record<string, unknown>>; components: unknown };

export function projectResponse(operation: Operation, status: number, value: unknown): unknown;
