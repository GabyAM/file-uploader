const prisma = require('../config/prisma');
const {authenticate} = require('../middleware/authentication');
const renderIndex = require('../middleware/render');

exports.getHomePage = [authenticate({failureRedirect: '/login'}), renderIndex];
