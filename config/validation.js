const {validationResult: originalValidationResult} = require('express-validator');

const validationResult = originalValidationResult.withDefaults({
  formatter: error => {
    return {
      ...error,
      isExternalError: error.msg.startsWith('EXTERNAL_ERROR:'),
    };
  },
});

module.exports = validationResult;
