const crypto = require('crypto');
const sharp = require('sharp');
const AppError = require('../errors/appError');

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 10;
const MAX_PIXELS = 40_000_000;
const MAX_ANIMATION_FRAMES = 200;
const FORMATS = {
  jpeg: { mimeType: 'image/jpeg', extension: 'jpg' },
  png: { mimeType: 'image/png', extension: 'png' },
  webp: { mimeType: 'image/webp', extension: 'webp' },
  gif: { mimeType: 'image/gif', extension: 'gif' },
};

class AdminImageService {
  constructor({ adminImageRepository, privateMediaStorage, clock = () => new Date() }) {
    this.adminImageRepository = adminImageRepository;
    this.privateMediaStorage = privateMediaStorage;
    this.clock = clock;
  }

  parseImageId(rawImageId) {
    if (typeof rawImageId !== 'string' || !/^[1-9][0-9]*$/.test(rawImageId)) return null;
    const imageId = Number(rawImageId);
    return Number.isSafeInteger(imageId) ? imageId : null;
  }

  async upload(files, actor) {
    if (!Array.isArray(files) || files.length < 1) {
      throw new AppError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
        { field: 'files', reason: 'required' },
      ]);
    }
    if (files.length > MAX_FILES) throw new AppError(413, 'UPLOAD_TOO_LARGE', '업로드 크기를 줄여 주세요.');

    const validated = [];
    for (const file of files) validated.push(await this.validateFile(file));
    const storedKeys = [];
    try {
      for (const image of validated) {
        await this.privateMediaStorage.put(image.storageKey, image.buffer, image.mimeType);
        storedKeys.push(image.storageKey);
      }
      const rows = await this.adminImageRepository.createStagedImages(validated, actor);
      return {
        items: rows.map((row) => ({
          imageId: Number(row.id),
          status: row.status,
          mimeType: row.mime_type,
          byteSize: row.byte_size,
          width: row.width,
          height: row.height,
          previewPath: `/api/v1/admin/images/${row.id}/preview`,
        })),
      };
    } catch (error) {
      await Promise.allSettled(storedKeys.map((key) => this.privateMediaStorage.delete(key)));
      if (error instanceof AppError) throw error;
      throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', '일시적으로 서비스를 이용할 수 없습니다.');
    }
  }

  async validateFile(file) {
    if (!Buffer.isBuffer(file.buffer) || file.buffer.length < 1 || file.buffer.length > MAX_FILE_SIZE) {
      throw new AppError(413, 'UPLOAD_TOO_LARGE', '업로드 크기를 줄여 주세요.');
    }
    let metadata;
    try {
      metadata = await sharp(file.buffer, {
        animated: true,
        failOn: 'error',
        limitInputPixels: MAX_PIXELS,
      }).metadata();
      await sharp(file.buffer, { failOn: 'error', limitInputPixels: MAX_PIXELS })
        .rotate()
        .toBuffer();
    } catch {
      throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', '지원하지 않는 파일 형식입니다.');
    }
    const format = FORMATS[metadata.format];
    if (!format || !metadata.width || !metadata.height) {
      throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', '지원하지 않는 파일 형식입니다.');
    }
    const pages = metadata.pages || 1;
    if (pages > MAX_ANIMATION_FRAMES || metadata.width * metadata.height * pages > MAX_PIXELS) {
      throw new AppError(413, 'UPLOAD_TOO_LARGE', '업로드 크기를 줄여 주세요.');
    }
    const sha256 = crypto.createHash('sha256').update(file.buffer).digest();
    const now = this.clock();
    const datePath = [now.getUTCFullYear(), String(now.getUTCMonth() + 1).padStart(2, '0')].join('/');
    const storageKey = `staging/${datePath}/${sha256.toString('hex')}-${crypto.randomUUID()}.${format.extension}`;
    return {
      buffer: file.buffer,
      storageKey,
      sha256,
      mimeType: format.mimeType,
      byteSize: file.buffer.length,
      width: metadata.width,
      height: metadata.height,
    };
  }

  async preview(rawImageId) {
    const imageId = this.parseImageId(rawImageId);
    if (imageId === null) throw new AppError(404, 'IMAGE_NOT_FOUND', '이미지를 찾을 수 없습니다.');
    const image = await this.adminImageRepository.findPreviewImage(imageId);
    if (!image) throw new AppError(404, 'IMAGE_NOT_FOUND', '이미지를 찾을 수 없습니다.');
    try {
      return {
        body: await this.privateMediaStorage.get(image.private_storage_key),
        mimeType: image.mime_type,
      };
    } catch {
      throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', '일시적으로 서비스를 이용할 수 없습니다.');
    }
  }

  async discard(rawImageId, actor) {
    const imageId = this.parseImageId(rawImageId);
    if (imageId === null) throw new AppError(404, 'IMAGE_NOT_FOUND', '이미지를 찾을 수 없습니다.');
    const result = await this.adminImageRepository.markPrivateDeletePending(imageId, actor);
    if (result.kind === 'NOT_FOUND') {
      throw new AppError(404, 'IMAGE_NOT_FOUND', '이미지를 찾을 수 없습니다.');
    }
    if (result.kind === 'CONFLICT') {
      throw new AppError(409, 'IMAGE_STATE_CONFLICT', '현재 이미지 상태에서는 처리할 수 없습니다.');
    }
    return { imageId, status: 'PRIVATE_DELETE_PENDING' };
  }
}

module.exports = AdminImageService;
module.exports.MAX_FILE_SIZE = MAX_FILE_SIZE;
