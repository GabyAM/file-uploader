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

exports.getFolderPage = [
  authenticate({failureRedirect: '/'}),
  param('id').custom(async (value, {req}) => {
    let folder;
    try {
      folder = await prisma.folder.findUnique({where: {id: value}});
    } catch (e) {
      throw new Error('EXTERNAL_ERROR: Error while validating folder id');
    }
    if (!folder) {
      throw new Error('Folder not found');
    }
    req.folder = folder;
  }),
  validate,
  handleAsync(async (req, res, next) => {
    if (req.validationResult) {
      res.redirect('/');
    }
    const layoutProps = {
      folders: await prisma.folder.findMany({where: {ownerId: req.session.user.id}}),
      user: req.session.user,
    };
    const files = await prisma.file.findMany({where: {folderId: req.params.id}});
    res.render('folder.ejs', {...layoutProps, folder: req.folder, files});
  }),
];

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
    res.redirect(`/folder/${folder.id}`);
  }),
];
