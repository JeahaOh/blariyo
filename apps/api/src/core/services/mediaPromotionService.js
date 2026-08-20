const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

class MediaPromotionService {
  constructor({ privateMediaStorage, publicMediaStorage }) {
    this.privateMediaStorage = privateMediaStorage;
    this.publicMediaStorage = publicMediaStorage;
  }

  publicKey(postId, image) {
    const extension = EXTENSIONS[image.mime_type];
    if (!extension || !Buffer.isBuffer(image.content_sha256)) {
      throw new Error('IMAGE_METADATA_INVALID');
    }
    return `posts/${postId}/${image.id}-${image.content_sha256.toString('hex')}.${extension}`;
  }

  async promote(postId, images) {
    const promoted = [];
    try {
      for (const image of images) {
        const publicStorageKey = this.publicKey(postId, image);
        const body = await this.privateMediaStorage.get(image.private_storage_key);
        await this.publicMediaStorage.put(publicStorageKey, body, image.mime_type);
        promoted.push({ imageId: image.id, publicStorageKey });
      }
      return promoted;
    } catch (error) {
      await Promise.allSettled(
        promoted.map((image) => this.publicMediaStorage.delete(image.publicStorageKey))
      );
      throw error;
    }
  }
}

module.exports = MediaPromotionService;
