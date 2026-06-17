// Wraps async route handlers so thrown errors hit the error handler.
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
