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
const renderPage = require('../middleware/render');

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
      req.fileData = file;
    });
const handleIdValidation = (field = 'id') => [
  validateId(field),
  validate,
  (req, res, next) => {
    if (req.validationResult) {
      req.session.error = req.validationResult.internalError
        ? 'An unexpected error happened'
        : req.validationResult.validationErrors[field];
      return res.redirect('/');
    }
    next();
  },
];
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
  handleIdValidation(),
  handleAsync(async (req, res, next) => {
    if (req.fileData.folderId) {
      const folder = await prisma.folder.findUnique({where: {id: req.fileData.folderId}});
      req.fileData.folder = folder;
    }
    formatFileDetails(req.fileData);

    return renderPage('file', {file: req.fileData})(req, res, next);
  }),
];

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
    const folder = await prisma.folder.findUnique({where: {id: req.fileData.folderId}});
    req.fileData.folder = folder;
    formatFileDetails(req.fileData);

    res.render('file', {file: req.fileData, share: req.share});
  }),
];

exports.postUploadFile = [
  authenticate({failureRedirect: '/login'}),
  (req, res, next) =>
    upload.single('file')(req, res, err => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          req.fileValidationError = 'The file is too large';
        } else if (req.file.size === 0) {
          req.fileValidationError = 'The file cannot be empty';
        }
        req.fileValidationError = 'Unexpected error';
      }
      next();
    }),
  body('file').custom(async (value, {req}) => {
    if (req.fileValidationError) {
      throw new Error(req.fileValidationError);
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
    .default('')
    .custom(value => {
      return (
        value === '' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
      );
    })
    .withMessage('Folder has to be a valid UUID')
    .bail()
    .custom(async (value, {req}) => {
      if (value === '') return true;
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
    .custom(async (value, {req}) => {
      if (req.folder == null && req.body.folder !== '') return true;
      let otherFiles;
      try {
        otherFiles = await prisma.file.findFirst({
          where: {name: value, folderId: req.folder?.id || null},
        });
      } catch (e) {
        throw new Error('EXTERNAL_ERROR: unexpected error while validating name');
      }
      if (!!otherFiles) {
        throw new Error('The name is already in use on the folder');
      }
      return true;
    }),
  validate,
  handleAsync(async (req, res, next) => {
    if (req.validationResult) {
      const {internalError, validationErrors} = req.validationResult;
      const props = {
        formOpen: 'file_upload',
        fileFormError: internalError,
        fileErrors: validationErrors,
        values: req.body,
      };

      return renderPage('root_folder', props)(req, res, next);
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

    res.redirect(req.fileData.folderId ? `/folder/${req.fileData.folderId}` : '/');
  }),
];

exports.postDownloadFile = [
  (req, res, next) => {
    if (req.body.shareid) {
      req.params.shareid = req.body.shareid;
      validateShareId()(req, res, next);
    } else {
      authenticate({failureRedirect: '/login'})(req, res, next);
    }
  },
  validateId('fileid'),
  validate,
  (req, res, next) => {
    if (req.validationResult) {
      req.session.error = req.validationResult.internalError
        ? 'An unexpected error happened'
        : req.validationResult.validationErrors.shareid ||
          req.validationResult.validationErrors.fileid;
      return res.redirect('/');
    }
    next();
  },
  handleAsync(async (req, res, next) => {
    const {data, error} = await supabase.storage.from('Files').download(req.fileData.url);

    const arraybuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arraybuffer);
    const readStream = new Stream.PassThrough();
    readStream.end(buffer);
    res.set('Content-Disposition', `attachment; filename="${req.fileData.url}"`);
    res.set('Content-Type', 'text-plain');
    readStream.pipe(res);
  }),
];

