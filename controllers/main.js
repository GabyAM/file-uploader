const prisma = require('../config/prisma');
const {authenticate} = require('../middleware/authentication');
const handleAsync = require('../utils/asyncHandler');

exports.getHomePage = [
  authenticate({failureRedirect: '/login'}),
  handleAsync(async (req, res, next, props = {}) => {
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
    if (req.session.error) {
      props.mainError = req.session.error;
      delete req.session.error;
    }
    res.render('root_folder.pug', {...layoutProps, ...props});
  }),
];
