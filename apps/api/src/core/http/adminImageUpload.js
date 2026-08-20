const multer = require('multer');
const AppError = require('../errors/appError');
const { MAX_FILE_SIZE } = require('../services/adminImageService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10,
    fields: 0,
    parts: 10,
  },
}).array('files', 10);

function adminImageUpload(req, res, next) {
  upload(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && ['LIMIT_FILE_SIZE', 'LIMIT_FILE_COUNT', 'LIMIT_PART_COUNT'].includes(error.code)) {
      return next(new AppError(413, 'UPLOAD_TOO_LARGE', '업로드 크기를 줄여 주세요.'));
    }
    return next(new AppError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { field: 'files', reason: 'invalidMultipart' },
    ]));
  });
}

module.exports = adminImageUpload;
