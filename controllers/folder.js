const {body, query, param} = require('express-validator');
const prisma = require('../config/prisma');
const {authenticate} = require('../middleware/authentication');
const handleAsync = require('../utils/asyncHandler');
const validate = require('../middleware/validation');

const renameFolder = async (value, {req}) => {
  let otherFolders;
  let newName = value || 'Untitled';
  try {
    otherFolders = await prisma.folder.findMany({
      where: {name: {startsWith: newName}, ownerId: req.session.user.id},
    });
  } catch (e) {
    throw new Error('EXTERNAL_ERROR: Unexpected error while sanitizing name');
  }
  if (otherFolders.length > 0) {
    newName += ` (${otherFolders.length + 1})`;
  }
  return newName;
};

exports.postFolderCreate = [
  authenticate({failureRedirect: '/login'}),
  body('name')
    .isString()
    .withMessage('Name has to be a string')
    .customSanitizer(renameFolder)
    .escape(),
  validate,
  handleAsync(async (req, res, next) => {
    if (req.validationResult) {
      const {internalError, validationErrors} = req.validationResult;
      const props = {
        folderFormError: internalError,
        folderErrors: validationErrors,
        folderFormOpen: true,
      };
      const layoutProps = {
        folders: await prisma.folder.findMany({where: {ownerId: req.session.user.id}}),
        user: req.session.user,
      };

      return res.render('layout.ejs', {
        ...layoutProps,
        ...props,
      });
    }
    const folder = await prisma.folder.create({
      data: {ownerId: req.session.user.id, name: req.body.name},
    });
    res.redirect(`/`);
  }),
];
