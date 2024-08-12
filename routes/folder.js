const express = require('express');
const folderController = require('../controllers/folder.js');

const router = express.Router();

router.get('/:id', folderController.getFolderPage);
router.post('/', folderController.postFolderCreate);
router.post('/:id/update', folderController.postFolderUpdate);
router.post('/:id/share', folderController.postFolderShare);
router.post('/:id/delete', folderController.postFolderDelete);

module.exports = router;
