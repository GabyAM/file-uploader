const {authenticate} = require('../middleware/authentication');
const renderPage = require('../middleware/render');
const handleAsync = require('../utils/asyncHandler');

exports.getHomePage = [
  authenticate({failureRedirect: '/login'}),
  handleAsync(async (req, res, next) => {
    let props = {};
    if (req.session.error) {
      props.mainError = req.session.error;
      delete req.session.error;
    }
    renderPage('root_folder', props)(req, res, next);
  }),
  (err, req, res, next) => {
    if (err) {
      res.render('error.pug');
    }
  },
];
