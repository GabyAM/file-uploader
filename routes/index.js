const express = require('express');
const prisma = require('../config/prisma');
const {authenticate} = require('../middleware/authentication');
const handleAsync = require('../utils/asyncHandler');
const util = require('util');

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  const folders = await prisma.folder.findMany({where: {ownerId: req.session.user.id}});
  res.render('layout.ejs', {user: req.session.user});
});
router.get('/', (req, res, next) => {
  res.render('login.ejs');
});

router.post(
  '/login',
  handleAsync(async (req, res, next) => {
    const regenerateSession = util.promisify(req.session.regenerate).bind(req.session);
    const saveSession = util.promisify(req.session.save).bind(req.session);

    const user = await prisma.user.findUnique({where: {email: req.body.email}});

    await regenerateSession();

    const {id, name, email} = user;
    req.session.user = {id, name, email};

    await saveSession();

    res.redirect('/');
  })
);

module.exports = router;
