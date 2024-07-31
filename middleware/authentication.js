exports.authenticate =
  ({successRedirect, failureRedirect}) =>
  (req, res, next) => {
    if (req.session.user) {
      if (successRedirect) return res.redirect(successRedirect);
      next();
    } else if (failureRedirect) res.redirect(failureRedirect);
    else next();
  };
