const {body} = require('express-validator');
const upload = require('../config/multer');
const {authenticate} = require('../middleware/authentication');
const prisma = require('../config/prisma');
const supabase = require('../config/supabase');
const {decode} = require('base64-arraybuffer');
const path = require('path');
const handleAsync = require('../utils/asyncHandler');
const validate = require('../middleware/validation');
const formatSize = require('../utils/sizeFormatter');

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
  body('file').custom((value, {req}) => {
    if (!req.file) {
      throw new Error('File is required');
    }
    if (req.fileValidationError) {
      throw new Error('File is too big');
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
      const layoutProps = {
        rootFiles: await prisma.file.findMany({
          where: {uploaderId: req.session.user.id, folderId: null},
        }),
        isRoot: true,
        folders: await prisma.folder.findMany({where: {ownerId: req.session.user.id}}),
        user: req.session.user,
      };

      return res.render('folder.ejs', {
        ...layoutProps,
        ...props,
      });
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
    if (req.folder) {
      res.redirect('/folder/' + req.folder.id);
    } else res.redirect('/');
  }),
];
