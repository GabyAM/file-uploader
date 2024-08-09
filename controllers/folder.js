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

const validateId = () =>
  param('id')
    .isUUID()
    .withMessage('Invalid id')
    .custom(async (value, {req}) => {
      let folder;
      try {
        folder = await prisma.folder.findUnique({where: {id: value}});
      } catch (e) {
        throw new Error('EXTERNAL_ERROR: Error while validating folder id');
      }
      if (!folder) throw new Error('Folder not found');
      req.folder = folder;
    });
const handleIdValidation = () => [
  validateId(),
  validate,
  (req, res, next) => {
    if (req.validationResult) {
      req.session.error = req.validationResult.internalError
        ? 'An unexpected error happened'
        : req.validationResult.validationErrors.id;
      res.redirect('/');
    }
    next();
  },
];

exports.getFolderPage = [
  authenticate({failureRedirect: '/'}),
  handleIdValidation(),
  handleAsync(async (req, res, next) => {
    const layoutProps = {
      rootFiles: await prisma.file.findMany({
        where: {uploaderId: req.session.user.id, folderId: null},
      }),
      folders: await prisma.folder.findMany({where: {ownerId: req.session.user.id}}),
      user: req.session.user,
    };
    const files = await prisma.file.findMany({where: {folderId: req.params.id}});
    res.render('folder.pug', {...layoutProps, folder: req.folder, files});
  }),
];

exports.getSharedFolderPage = [
  handleAsync(async (req, res, next) => {
    const share = await prisma.share.findFirst({where: {id: req.params.id}});
    let error;
    if (!share) {
      error = "This resource doesn't exist";
    } else if (share.expiration <= new Date()) {
      error = 'This link has expired';
    }
    if (error) {
      req.session.error = error;
      res.redirect('/');
    }

    let layoutProps = {};
    if (req.session.user) {
      layoutProps = {
        rootFiles: await prisma.file.findMany({
          where: {uploaderId: req.session.user.id, folderId: null},
        }),
        folders: await prisma.folder.findMany({where: {ownerId: req.session.user.id}}),
        user: req.session.user,
      };
    }
    const props = {
      folder: await prisma.folder.findFirst({where: {id: share.folderId}}),
      files: await prisma.file.findMany({where: {folderId: share.folderId}}),
      share,
    };
    res.render('folder.pug', {...layoutProps, ...props});
  }),
];

exports.postFolderCreate = [
  authenticate({failureRedirect: '/login'}),
  body('name')
    .default('')
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
        formOpen: 'folder_create',
      };
      const layoutProps = {
        rootFiles: await prisma.file.findMany({
          where: {uploaderId: req.session.user.id, folderId: null},
        }),
        isRoot: true,
        folders: await prisma.folder.findMany({where: {ownerId: req.session.user.id}}),
        user: req.session.user,
      };

      return res.render('folder.pug', {
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

exports.postFolderUpdate = [
  authenticate({failureRedirect: '/login'}),
  handleIdValidation(),
  body('name')
    .default('')
    .isString()
    .withMessage('Name has to be a string')
    .customSanitizer(renameFolder)
    .escape(),
  validate,
  handleAsync(async (req, res, next) => {
    if (req.validationResult) {
      const {internalError, validationErrors} = req.validationResult;
      const layoutProps = {
        rootFiles: await prisma.file.findMany({
          where: {uploaderId: req.session.user.id, folderId: null},
        }),
        folders: await prisma.folder.findMany({where: {ownerId: req.session.user.id}}),
        user: req.session.user,
      };
      const props = {
        folderFiles: await prisma.file.findMany({where: {folderId: req.folder.id}}),
        folderEditFormError: internalError,
        folderEditErrors: validationErrors,
        formOpen: 'folder_update',
      };

      return res.render('folder.pug', {...layoutProps, ...props});
    }

    await prisma.folder.update({where: {id: req.params.id}, data: {name: req.body.name}});
    res.redirect(`/folder/${req.params.id}`);
  }),
];

exports.postFolderShare = [
  authenticate({failureRedirect: '/login'}),
  handleIdValidation(),
  body('duration')
    .exists()
    .withMessage('duration is required')
    .isString()
    .withMessage('Duration has to be a string')
    .isIn(['12h', '1d', '3d', '1w'])
    .withMessage('Value is not a valid duration'),
  validate,
  handleAsync(async (req, res, next) => {
    if (req.validationResult) {
      const {internalError, validationErrors} = req.validationResult;
      const layoutProps = {
        rootFiles: await prisma.file.findMany({
          where: {uploaderId: req.session.user.id, folderId: null},
        }),
        folders: await prisma.folder.findMany({where: {ownerId: req.session.user.id}}),
        user: req.session.user,
      };
      const props = {
        folderShareFormError: internalError,
        folderShareErrors: validationErrors,
        formOpen: 'folder_share',
        folder: req.folder,
        files: await prisma.file.findMany({where: {folderId: req.folder.id}}),
      };

      return res.render('folder.pug', {...layoutProps, ...props});
    }
    const expirations = {
      '12h': 1000 * 60 * 60 * 12,
      '1d': 1000 * 60 * 60 * 24,
      '3d': 1000 * 60 * 60 * 24 * 3,
      '1w': 1000 * 60 * 60 * 24 * 7,
    };
    let shareExpiration = new Date(Date.now() + expirations[req.body.duration]).toISOString();

    const share = await prisma.share.create({
      data: {folderId: req.folder.id, expiration: shareExpiration},
    });

    const layoutProps = {
      rootFiles: await prisma.file.findMany({
        where: {uploaderId: req.session.user.id, folderId: null},
      }),
      folders: await prisma.folder.findMany({where: {ownerId: req.session.user.id}}),
      user: req.session.user,
    };
    const props = {
      folder: req.folder,
      files: await prisma.file.findMany({where: {folderId: req.folder.id}}),
      shareUrl: `share/${share.id}`,
    };
    res.render('folder.pug', {...layoutProps, ...props});
  }),
];

