class AppError extends Error {
  constructor(status, code, message, fields = []) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

module.exports = AppError;
