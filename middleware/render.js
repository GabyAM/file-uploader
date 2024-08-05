const prisma = require('../config/prisma');
const handleAsync = require('../utils/asyncHandler');

const renderIndex = handleAsync(async (req, res, next, props) => {
  const layoutProps = {
    rootFiles: await prisma.file.findMany({
      where: {uploaderId: req.session.user.id, folderId: null},
    }),
    isRoot: true,
    folders: await prisma.folder.findMany({where: {ownerId: req.session.user.id}}),
    user: req.session.user,
  };
  res.render('folder.ejs', {...layoutProps, ...props});
});

module.exports = renderIndex;
