export type ImageStatus =
  | 'STAGED'
  | 'PUBLIC'
  | 'PUBLIC_DELETE_PENDING'
  | 'PRIVATE_REVIEW'
  | 'PRIVATE_DELETE_PENDING'
  | 'DELETED';
export interface Image {
  id: string;
  postId: string | null;
  privateKey: string;
  publicKey: string | null;
  status: ImageStatus;
  hash: Buffer;
  mime: string;
  byteSize: number;
  width: number;
  height: number;
}
export interface NewImage {
  key: string;
  hash: Buffer;
  mime: string;
  byteSize: number;
  width: number;
  height: number;
  actor: string;
}
export abstract class ImagesRepository {
  abstract create(image: NewImage): Promise<string>;
  abstract find(id: string, lock?: boolean): Promise<Image | null>;
  abstract byPublicKey(key: string): Promise<Image | null>;
  abstract transitionStatus(
    id: string,
    expected: ImageStatus,
    next: ImageStatus,
    actor: string,
    clearPublic?: boolean
  ): Promise<void>;
  abstract attached(postId: string): Promise<Image[]>;
  abstract update(image: Image, actor: string): Promise<void>;
  abstract markPrivateDelete(id: string, actor: string): Promise<void>;
}
