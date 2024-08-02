const express = require('express');
const folderController = require('../controllers/folder.js');

const router = express.Router();

router.get('/:id', folderController.getFolderPage);
router.post('/', folderController.postFolderCreate);

module.exports = router;
