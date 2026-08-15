const Joi = require('joi');
// const { ApiError } = require('./errorHandler');

const validateLogin = (req, res, next) => {
  const schema = Joi.object({
    user_id: Joi.string().required().messages({
      'any.required': '아이디는 필수입니다.',
    }),
    user_pswd: Joi.string().min(8).required().messages({
      'string.min': '비밀번호는 최소 8자 이상이어야 합니다.',
      'any.required': '비밀번호는 필수입니다.',
    }),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }
  next();
};

module.exports = {
  validateLogin,
};
