const {authenticate} = require('../middleware/authentication');
const handleAsync = require('../utils/asyncHandler');

exports.getHomePage = [
  authenticate({failureRedirect: '/login'}),
  handleAsync(async (req, res, next) => {
    res.render('layout.ejs', {user: req.session.user});
  }),
];
