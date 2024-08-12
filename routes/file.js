const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.js');

router.get('/:id', fileController.getFilePage);

router.post('/upload', fileController.postUploadFile);

router.post('/:id/update', fileController.postUpdateFile);

router.post('/:id/delete', fileController.postDeleteFile);

router.post('/:fileid/download', fileController.postDownloadFile);

module.exports = router;
