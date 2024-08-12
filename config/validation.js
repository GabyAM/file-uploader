const {validationResult: originalValidationResult} = require('express-validator');

const validationResult = originalValidationResult.withDefaults({
  formatter: error => {
    return error.msg;
  },
});

module.exports = validationResult;
