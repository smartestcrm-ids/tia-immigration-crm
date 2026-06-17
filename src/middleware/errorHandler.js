const { ZodError } = require('zod');

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  // Prisma known request errors carry a code
  if (err && err.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Unique constraint violated', target: err.meta?.target });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Record not found' });
    }
    return res.status(400).json({ error: 'Database error', code: err.code, message: err.message });
  }

  if (err && err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Internal server error' });
};
