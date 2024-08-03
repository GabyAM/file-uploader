const prisma = require('../config/prisma');
const {authenticate} = require('../middleware/authentication');
const handleAsync = require('../utils/asyncHandler');

exports.getHomePage = [
  authenticate({failureRedirect: '/login'}),
  handleAsync(async (req, res, next) => {
    const folders = await prisma.folder.findMany({where: {ownerId: req.session.user.id}});
    const rootFiles = await prisma.file.findMany({
      where: {uploaderId: req.session.user.id, folderId: null},
    });
    res.render('layout.ejs', {user: req.session.user, folders, rootFiles});
  }),
];
