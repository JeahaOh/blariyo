/** Read-only access to batch-owned objects. Never fetch a source-site URL. */
export abstract class CollectReader {
  abstract read(key: string, maxBytes: number, signal?: AbortSignal): Promise<Buffer>;
}
