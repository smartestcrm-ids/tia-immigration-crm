const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRouter = require('./routes/auth');
const leadsRouter = require('./routes/leads');
const usersRouter = require('./routes/users');
const caseTypesRouter = require('./routes/caseTypes');
const remindersRouter = require('./routes/reminders');
const notesRouter = require('./routes/notes');
const inboxRouter = require('./routes/inbox');
const conversationsRouter = require('./routes/conversations');
const ingestRouter = require('./routes/ingest');
const webhooksRouter = require('./routes/webhooks');
const rolesRouter = require('./routes/roles');
const clientProfileRouter = require('./routes/clientProfile');
const channelAccountsRouter = require('./routes/channelAccounts');
const casesRouter = require('./routes/cases');
const errorHandler = require('./middleware/errorHandler');
const { requireAuth } = require('./middleware/auth');

const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' })); // larger for base64 document uploads
app.use(morgan('dev'));

// Public endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'immigration-crm-phase1', time: new Date().toISOString() });
});
app.use('/api/auth', authRouter);
app.use('/api/ingest', ingestRouter);
app.use('/api/webhooks', webhooksRouter);

// Protected endpoints
app.use('/api', requireAuth);

app.use('/api/leads', leadsRouter);
app.use('/api/leads', notesRouter);
app.use('/api/leads', remindersRouter);
app.use('/api/leads', clientProfileRouter); // /api/leads/:leadId/profile, /family, /documents
app.use('/api/users', usersRouter);
app.use('/api/case-types', caseTypesRouter);
app.use('/api/inbox', inboxRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/channel-accounts', channelAccountsRouter);
app.use('/api/cases', casesRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

app.use(errorHandler);

module.exports = app;
