export interface ReviewPublicationFence { commandId: string; epoch: number; leaseToken: string; authorize: () => void }
/** Evaluated in the final publication transaction, before locking the post row. */
export abstract class ReviewPublicationGuard {
  abstract assertAllowed(postId: string, fence?: ReviewPublicationFence): Promise<void>;
}
