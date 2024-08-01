const validationResult = require('../config/validation');

const validate = (req, res, next) => {
  let errors = validationResult(req);
  if (!errors.isEmpty()) {
    errors = errors.mapped();
    const validationResult = {
      internalError: Object.values(errors).some(err => err.isExternalError),
    };
    if (!validationResult.internalError) {
      validationResult.validationErrors = errors;
    }
    req.validationResult = validationResult;
  }
  next();
};

module.exports = validate;
