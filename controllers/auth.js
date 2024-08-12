const {body, validationResult} = require('express-validator');
const prisma = require('../config/prisma');
const {authenticate} = require('../middleware/authentication');
const handleAsync = require('../utils/asyncHandler');
const util = require('util');
const validate = require('../middleware/validation');
const formatSize = require('../utils/sizeFormatter');
const bcrypt = require('bcryptjs');

exports.getLoginPage = [
  authenticate({successRedirect: '/'}),
  (req, res, next) => {
    let props = {};
    if (req.session.error) {
      props.mainError = req.session.error;
      delete req.session.error;
    }
    res.render('login.pug', props);
  },
];

exports.getSignupPage = [
  authenticate({successRedirect: '/'}),
  (req, res, next) => {
    res.render('signup.pug');
  },
];

exports.postLogin = [
  body('email')
    .exists()
    .withMessage('Email is required')
    .isString()
    .withMessage('Email has to be a string')
    .trim()
    .isLength({min: 1})
    .withMessage('Email cannot be empty')
    .isEmail()
    .bail()
    .withMessage('Email format is incorrect')
    .custom(async (value, {req}) => {
      let user;
      try {
        user = await prisma.user.findUnique({where: {email: value}});
      } catch (e) {
        throw new Error('EXTERNAL_ERROR: Error while validating email');
      }
      if (!user) {
        throw new Error('User not found');
      }
      req.user = user;
    })
    .escape(),
  body('password')
    .exists()
    .withMessage('Password is required')
    .isString()
    .withMessage('Password has to be a string')
    .trim()
    .isLength({min: 8})
    .withMessage('Password has to have at least 8 characters')
    .bail()
    .custom(async (value, {req}) => {
      if (!req.user) return true;
      let match;
      try {
        match = await bcrypt.compare(value, req.user.password);
      } catch (e) {
        throw new Error('EXTERNAL_ERROR: Unexpected error while comparing password');
      }
      if (!match) {
        throw new Error('Password is incorrect');
      }
      return true;
    }),
  validate,
  handleAsync(async (req, res, next) => {
    if (req.validationResult) {
      const {internalError, validationErrors} = req.validationResult;
      const errorProps = {
        serverError: internalError,
        errors: validationErrors,
      };
      return res.render('login.pug', {values: req.body, ...errorProps});
    }
    const regenerateSession = util.promisify(req.session.regenerate).bind(req.session);
    const saveSession = util.promisify(req.session.save).bind(req.session);

    await regenerateSession();

    const {id, name, email, usedSpace} = req.user;
    const usedSpaceFormatted = formatSize(usedSpace);
    req.session.user = {id, name, email, usedSpace, usedSpaceFormatted};

    await saveSession();

    res.redirect('/');
  }),
];

exports.postSignup = [
  body('name')
    .exists()
    .withMessage('Email is required')
    .isString()
    .withMessage('Email has to be a string')
    .trim()
    .isLength({min: 1})
    .withMessage('Email cannot be empty')
    .escape(),
  body('email')
    .exists()
    .withMessage('Email is required')
    .isString()
    .withMessage('Email has to be a string')
    .trim()
    .isLength({min: 1})
    .withMessage('Email cannot be empty')
    .isEmail()
    .bail()
    .withMessage('Email format is incorrect')
    .custom(async (value, {req}) => {
      let user;
      try {
        user = await prisma.user.findUnique({where: {email: value}});
      } catch (e) {
        throw new Error('EXTERNAL_ERROR: Error while validation email');
      }
      if (user) {
        throw new Error('Email is already in use');
      }
      req.user = user;
    })
    .escape(),
  body('passwordConfirm')
    .exists()
    .withMessage('Password confirm is required')
    .isString()
    .withMessage('Password has to be a string')
    .trim()
    .custom((value, {req}) => {
      if (value !== req.body.password) {
        throw new Error('Password confirm is incorrect');
      }
      return true;
    }),
  body('password')
    .exists()
    .withMessage('Password is required')
    .isString()
    .withMessage('Password has to be a string')
    .trim()
    .isLength({min: 8})
    .withMessage('Password has to have at least 8 characters')
    .bail()
    .customSanitizer(async (value, {req}) => {
      if (req.body.passwordConfirm !== value) return value;
      let hashedPassword;
      try {
        hashedPassword = await bcrypt.hash(value, 10);
      } catch (e) {
        throw new Error('EXTERNAL_ERROR: Unexpected error while hashing password');
      }
      return hashedPassword;
    }),
  validate,
  handleAsync(async (req, res, next) => {
    if (req.validationResult) {
      const {internalError, validationErrors} = req.validationResult;
      const errorProps = {serverError: internalError, errors: validationErrors};
      return res.render('signup.pug', {values: req.body, ...errorProps});
    }

    const {name, email, password} = req.body;

    await prisma.user.create({data: {name, email, password}});
    res.redirect('/login');
  }),
];

exports.postLogout = [
  authenticate({failureRedirect: '/login'}),
  handleAsync(async (req, res, next) => {
    const saveSession = util.promisify(req.session.save).bind(req.session);
    req.session.user = null;

    await saveSession();
    res.redirect('/login');
  }),
];
