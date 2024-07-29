const express = require('express');
const prisma = require('../config/prisma');
const {authenticate} = require('../middleware/authentication');
const handleAsync = require('../middleware/asyncHandler');

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
    const user = await prisma.user.findUnique({where: {email: req.body.email}});
    req.session.regenerate(err => {
      if (err) {
        next(err);
      }
      const {id, name, email} = user;
      req.session.user = {id, name, email};

      req.session.save(err => {
        if (err) {
          next(err);
        }
        res.redirect('/');
      });
    });
  })
);

module.exports = router;
