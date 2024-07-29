const handleAsync =
  fn =>
  (...args) => {
    const next = args[args.length - 1];
    return Promise.resolve(fn(...args)).catch(next);
  };
module.exports = handleAsync;
