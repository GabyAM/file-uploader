exports.authenticate = (req, res, next) => {
  if (req.session.user) {
    next();
  } else next('route');
};
