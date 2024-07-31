const {body, validationResult} = require('express-validator');
const prisma = require('../config/prisma');
const {authenticate} = require('../middleware/authentication');
const handleAsync = require('../utils/asyncHandler');

exports.getLoginPage = [
  authenticate({successRedirect: '/'}),
  (req, res, next) => {
    res.render('login.ejs');
  },
];

exports.getSignupPage = [
  authenticate({successRedirect: '/'}),
  (req, res, next) => {
    res.render('signup.ejs');
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
      const user = await prisma.user.findUnique({where: {email: value}});
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
    .custom((value, {req}) => {
      if (req.user.password !== value) {
        throw new Error('Password is incorrect');
      }
      return true;
    }),
  handleAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('login.ejs', {errors: errors.mapped(), values: req.body});
    }
    const regenerateSession = util.promisify(req.session.regenerate).bind(req.session);
    const saveSession = util.promisify(req.session.save).bind(req.session);

    await regenerateSession();

    const {id, name, email} = req.user;
    req.session.user = {id, name, email};

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
      const user = await prisma.user.findUnique({where: {email: value}});
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
    .withMessage('Password has to have at least 8 characters'),
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
  handleAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('signup.ejs', {values: req.body, errors: errors.mapped()});
    }
    const {name, email, password} = req.body;
    await prisma.user.create({data: {name, email, password}});
    res.redirect('/login');
  }),
];
