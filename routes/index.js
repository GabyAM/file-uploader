const express = require('express');
const mainController = require('../controllers/main.js');
const authController = require('../controllers/auth.js');

const router = express.Router();

router.get('/', mainController.getHomePage);

router.get('/login', authController.getLoginPage);

router.post('/login', authController.postLogin);

router.get('/signup', authController.getSignupPage);

router.post('/signup', authController.postSignup);

router.get('/share/:id', folderController.getSharedFolderPage);

router.get('/share/:shareid/file/:fileid', fileController.getSharedFilePage);

module.exports = router;
