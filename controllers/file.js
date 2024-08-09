const {body, param} = require('express-validator');
const upload = require('../config/multer');
const {authenticate} = require('../middleware/authentication');
const prisma = require('../config/prisma');
const supabase = require('../config/supabase');
const {decode} = require('base64-arraybuffer');
const path = require('path');
const handleAsync = require('../utils/asyncHandler');
const validate = require('../middleware/validation');
const formatSize = require('../utils/sizeFormatter');
const renderIndex = require('../middleware/render');

const checkFileNameUniqueness = async (value, {req}) => {
  if (value === '') return true;
  let otherFile;
  try {
    if (req.folder) {
      otherFile = await prisma.file.findFirst({
        where: {folderId: req.folder.id, name: value},
      });
    } else {
      const userId = req.session.user.id;
      otherFile = await prisma.file.findFirst({
        where: {uploaderId: userId, folderId: null, name: value},
      });
    }
  } catch (e) {
    throw new Error('EXTERNAL_ERROR: Unexpected error while validating name');
  }
  if (otherFile) {
    throw new Error('A file with that name already exists on the same folder / space');
  }
  return true;
};

const renameFile = async (value, {req}) => {
  let newName = value || 'Untitled';
  try {
    let untitledFiles;
    if (req.folder) {
      untitledFiles = await prisma.file.findMany({
        where: {folderId: req.folder.id, name: {startsWith: newName}},
      });
    } else {
      const userId = req.session.user.id;
      untitledFiles = await prisma.file.findMany({
        where: {
          uploaderId: userId,
          folderId: null,
          name: {startsWith: newName},
        },
      });
    }
    if (untitledFiles.length > 0) {
      newName += ` (${untitledFiles.length + 1})`;
    }
    return newName;
  } catch (e) {
    throw new Error('EXTERNAL_ERROR: Unexpected error while sanitizing name');
  }
};

const formatFileDetails = file => {
  file.size = formatSize(file.size);
  file.createdAt = file.createdAt.toLocaleDateString() + ' ' + file.createdAt.toLocaleTimeString();
  file.updatedAt = file.updatedAt.toLocaleDateString() + ' ' + file.updatedAt.toLocaleTimeString();
};

const validateId = field =>
  param(field)
    .isUUID()
    .withMessage('Invalid file id')
    .custom(async (value, {req}) => {
      let file;
      try {
        file = await prisma.file.findUnique({where: {id: value}});
      } catch (e) {
        throw new Error('EXTERNAL_ERROR: Error while validating folder id');
      }
      if (!file) throw new Error('File not found');
      req.file = file;
    });
const validateShareId = () =>
  param('shareid')
    .isUUID()
    .withMessage('invalid share id')
    .custom(async (value, {req}) => {
      let share;
      try {
        share = await prisma.share.findFirst({where: {id: value}});
      } catch (e) {
        throw new Error('EXTERNAL_ERROR: Error while validating share id');
      }
      if (!share) {
        throw new Error('The resource was not found');
      }
      req.share = share;
      return true;
    });

exports.getFilePage = [
  authenticate({failureRedirect: '/login'}),
  handleAsync(async (req, res, next) => {
    const file = await prisma.file.findUnique({
      where: {id: req.params.id},
    });
    formatFileDetails(file);
    const folders = await prisma.folder.findMany({where: {ownerId: req.session.user.id}});
    if (file.folderId) {
      file.folder = folders.find(f => f.id === file.folderId);
    }
    const layoutProps = {
      rootFiles: await prisma.file.findMany({
        where: {uploaderId: req.session.user.id, folderId: null},
      }),
      folders,
      user: req.session.user,
    };
    res.render('file.ejs', {...layoutProps, file});

exports.getSharedFilePage = [
  validateId('fileid'),
  validateShareId(),
  validate,
  handleAsync(async (req, res, next) => {
    if (req.validationResult) {
      if (req.validationResult.internalError) {
        req.session.error = 'An unexpected error happened';
      } else
        req.session.error =
          req.validationResult.validationErrors.shareid ||
          req.validationResult.validationErrors.fileid;
      res.redirect('/');
    }
    const folder = await prisma.folder.findUnique({where: {id: req.file.folderId}});
    req.file.folder = folder;
    formatFileDetails(req.file);

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
    res.render('file.pug', {...layoutProps, file: req.file, share: req.share});
  }),
];

exports.postUploadFile = [
  authenticate({failureRedirect: '/login'}),
  (req, res, next) =>
    upload.single('file')(req, res, err => {
      if (err) {
        req.fileValidationError = err;
      }
      next();
    }),
  body('file').custom(async (value, {req}) => {
    if (req.fileValidationError) {
      throw new Error('File is too big');
    }
    if (!req.file) {
      throw new Error('File is required');
    }
    let user;
    try {
      user = await prisma.user.findUnique({
        where: {id: req.session.user.id},
      });
    } catch (e) {
      throw new Error('EXTERNAL_ERROR: error while validating file');
    }
    if (req.file.size + user.usedSpace > 50 * 1024 * 1024) {
      throw new Error('Cannot upload file, there is no enough space');
    }
    return true;
  }),
  body('folder')
    .optional({values: 'falsy'})
    .isUUID()
    .withMessage('Folder has to be a UUID')
    .bail()
    .custom(async (value, {req}) => {
      let folder;
      try {
        folder = await prisma.folder.findUnique({where: {id: value}});
      } catch (e) {
        throw new Error('EXTERNAL_ERROR: unexpected error while validating folder');
      }
      if (!folder) {
        throw new Error('The folder was not found');
      }
      req.folder = folder;
      return true;
    }),
  body('name')
    .default('')
    .isString()
    .withMessage('Name has to be a string')
    .bail()
    .customSanitizer(renameFile),
  validate,
  handleAsync(async (req, res, next) => {
    if (req.validationResult) {
      const {internalError, validationErrors} = req.validationResult;
      const props = {
        fileFormOpen: true,
        fileFormError: internalError,
        fileErrors: validationErrors,
      };

      return renderIndex(req, res, next, props);
    }

    const fileName = `${Date.now()}_${Math.round(Math.random() * 1e9)}${path.extname(req.file.originalname)}`;
    const fileBase64 = decode(req.file.buffer.toString('base64'));
    const {data, error} = await supabase.storage
      .from('Files')
      .upload(fileName, fileBase64, {contentType: req.file.mimetype});
    if (error) next(error);

    await prisma.$transaction([
      prisma.file.create({
        data: {
          name: req.body.name,
          type: req.file.mimetype,
          size: req.file.size,
          url: data.path,
          uploaderId: req.session.user.id,
          folderId: req.folder?.id || null,
        },
      }),
      prisma.user.update({
        where: {id: req.session.user.id},
        data: {usedSpace: {increment: req.file.size}},
      }),
    ]);
    req.session.user.usedSpace += req.file.size;
    req.session.user.usedSpaceFormatted = formatSize(req.session.user.usedSpace);
    if (req.folder) {
      res.redirect('/folder/' + req.folder.id);
    } else res.redirect('/');
  }),
];

exports.postDeleteFile = [
  authenticate({failureRedirect: 'login'}),
  handleIdValidation(),
  handleAsync(async (req, res, next) => {
    await prisma.$transaction([
      prisma.user.update({
        where: {id: req.session.user.id},
        data: {usedSpace: {decrement: req.file.size}},
      }),
      prisma.file.delete({where: {id: req.file.id}}),
    ]);

    req.session.user.usedSpace -= req.file.size;
    req.session.user.usedSpaceFormatted = formatSize(req.session.user.usedSpace);

    res.redirect(req.file.folder ? `/folder/${req.file.folder.id}` : '/');
  }),
];

