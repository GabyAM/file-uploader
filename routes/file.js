const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.js');

router.post('/upload', fileController.postUploadFile);

module.exports = router;
