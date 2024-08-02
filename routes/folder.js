const express = require('express');
const folderController = require('../controllers/folder.js');

const router = express.Router();

router.post('/', folderController.postFolderCreate);

module.exports = router;
