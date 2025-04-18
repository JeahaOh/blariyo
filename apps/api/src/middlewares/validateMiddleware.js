const Joi = require('joi');

const validateJoin = (req, res, next) => {
  const schema = Joi.object({
    user_id: Joi.string().required().messages({
      'any.required': '아이디는 필수입니다.'
    }),
    user_pswd: Joi.string().min(6).required().messages({
      'string.min': '비밀번호는 최소 6자 이상이어야 합니다.',
      'any.required': '비밀번호는 필수입니다.'
    }),
    user_nm: Joi.string().required().messages({
      'any.required': '이름은 필수입니다.'
    }),
    // email: Joi.string().email().required().messages({
    //   'string.email': '올바른 이메일 형식이어야 합니다.',
    //   'any.required': '이메일은 필수입니다.'
    // })
  });

  const { error } = schema.validate(req.body);
  console.log('error : ', error);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message
    });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const schema = Joi.object({
    user_id: Joi.string().required().messages({
      'any.required': '아이디는 필수입니다.'
    }),
    user_pswd: Joi.string().required().messages({
      'any.required': '비밀번호는 필수입니다.'
    })
  });

  const { error } = schema.validate(req.body);
  console.log('error : ', error);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message
    });
  }

  next();
};

const validateUpdate = (req, res, next) => {
  const schema = Joi.object({
    user_pswd: Joi.string().min(6).messages({
      'string.min': '비밀번호는 최소 6자 이상이어야 합니다.'
    }),
    user_nm: Joi.string(),
    email: Joi.string().email().messages({
      'string.email': '올바른 이메일 형식이어야 합니다.'
    }),
    role_code: Joi.string().valid('GST', 'USR', 'ADM', 'SAD'),
    status_code: Joi.string().valid('ACT', 'DOR', 'LCK', 'WDR', 'FWD'),
    login_fail_cnt: Joi.number().integer().min(0),
    updator_no: Joi.number().integer()
  }).min(1).messages({
    'object.min': '최소 하나의 필드를 수정해야 합니다.'
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message
    });
  }

  next();
};

module.exports = {
  validateJoin,
  validateLogin,
  validateUpdate
}; 

