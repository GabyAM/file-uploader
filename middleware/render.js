const prisma = require('../config/prisma');
const handleAsync = require('../utils/asyncHandler');

const renderPage = (page, props = {}) =>
  handleAsync(async (req, res, next) => {
    let layoutProps = {};
    if (req.session && req.session.user) {
      layoutProps = {
        rootFiles: await prisma.file.findMany({
          where: {uploaderId: req.session.user.id, folderId: null},
        }),
        folders: await prisma.folder.findMany({where: {ownerId: req.session.user.id}}),
        user: req.session.user,
      };
    }
    res.render(`${page}.pug`, {...layoutProps, ...props});
  });

module.exports = renderPage;
