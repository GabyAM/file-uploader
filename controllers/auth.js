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

exports.postLogin = [
  handleAsync(async (req, res, next) => {
    const regenerateSession = util.promisify(req.session.regenerate).bind(req.session);
    const saveSession = util.promisify(req.session.save).bind(req.session);

    await regenerateSession();

    const {id, name, email} = req.user;
    req.session.user = {id, name, email};

    await saveSession();

    res.redirect('/');
  }),
];
