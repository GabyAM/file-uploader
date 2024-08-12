const {body, query, param} = require('express-validator');
const prisma = require('../config/prisma');
const {authenticate} = require('../middleware/authentication');
const handleAsync = require('../utils/asyncHandler');
const validate = require('../middleware/validation');
const renderPage = require('../middleware/render');
const supabase = require('../config/supabase');
const formatSize = require('../utils/sizeFormatter');

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
    const files = await prisma.file.findMany({where: {folderId: req.params.id}});
    return renderPage('folder', {folder: req.folder, files})(req, res, next);
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

    const props = {
      folder: await prisma.folder.findFirst({where: {id: share.folderId}}),
      files: await prisma.file.findMany({where: {folderId: share.folderId}}),
      share,
    };
    return renderPage('folder', props)(req, res, next);
  }),
];

exports.postFolderCreate = [
  authenticate({failureRedirect: '/login'}),
  body('name')
    .isString()
    .withMessage('Name has to be a string')
    .trim()
    .isLength({min: 1})
    .withMessage('Name cannot be empty')
    .isLength({max: 50})
    .withMessage('Name is too long')
    .bail()
    .custom(async (value, {req}) => {
      let otherFolder;
      try {
        otherFolder = await prisma.folder.findFirst({
          where: {name: value, ownerId: req.session.user.id},
        });
      } catch (e) {
        throw new Error('EXTERNAL_ERROR: Unexpected error while validating name');
      }
      if (!!otherFolder) {
        throw new Error('This name is already in use');
      }
      return true;
    })
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

      return renderPage('root_folder', props)(req, res, next);
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
    .isString()
    .withMessage('Name has to be a string')
    .trim()
    .isLength({min: 1})
    .withMessage('Name cannot be empty')
    .isLength({max: 50})
    .withMessage('Name is too long')
    .bail()
    .custom(async (value, {req}) => {
      let otherFolder;
      try {
        otherFolder = await prisma.folder.findFirst({
          where: {name: value, ownerId: req.session.user.id, id: {not: req.folder.id}},
        });
      } catch (e) {
        throw new Error('EXTERNAL_ERROR: Unexpected error while validating name');
      }
      if (!!otherFolder) {
        throw new Error('This name is already in use');
      }
      return true;
    })
    .escape(),
  validate,
  handleAsync(async (req, res, next) => {
    if (req.validationResult) {
      const {internalError, validationErrors} = req.validationResult;
      const props = {
        folderFiles: await prisma.file.findMany({where: {folderId: req.folder.id}}),
        folderEditFormError: internalError,
        folderEditErrors: validationErrors,
        formOpen: 'folder_update',
      };

      return renderPage('folder', props)(req, res, next);
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
      const props = {
        folderShareFormError: internalError,
        folderShareErrors: validationErrors,
        formOpen: 'folder_share',
        folder: req.folder,
        files: await prisma.file.findMany({where: {folderId: req.folder.id}}),
      };

      return renderPage('folder', props)(req, res, next);
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

    const props = {
      folder: req.folder,
      files: await prisma.file.findMany({where: {folderId: req.folder.id}}),
      shareUrl: `share/${share.id}`,
    };
    return renderPage('folder', props)(req, res, next);
  }),
];

exports.postFolderDelete = [
  authenticate({failureRedirect: '/login'}),
  handleIdValidation(),
  handleAsync(async (req, res, next) => {
    let size = await prisma.file.aggregate({
      where: {folderId: req.folder.id},
      _sum: {size: true},
    });
    size = size._sum.size || 0;

    const files = await prisma.file.findMany({
      where: {folderId: req.folder.id},
      select: {url: true},
    });
    const urls = files.map(file => file.url);

    if (size === 0) {
      await prisma.folder.delete({where: {id: req.folder.id}});
    } else {
      await prisma.$transaction([
        prisma.folder.delete({where: {id: req.folder.id}}),
        prisma.user.update({
          where: {id: req.session.user.id},
          data: {usedSpace: {decrement: size}},
        }),
      ]);

      req.session.user.usedSpace -= size;
      req.session.user.usedSpaceFormatted = formatSize(req.session.user.usedSpace);

      await supabase.storage.from('Files').remove(urls);
      //supabase doesn't support transactions, so there isn't much i can do to handle this better
    }

    res.redirect(`/`);
  }),
];
