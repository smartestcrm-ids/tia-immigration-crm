/* eslint-disable no-console */
const http = require('http');
const app = require('../src/app');

let server;
let adminToken = null;
let consultantToken = null;
const failures = [];

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const port = server.address().port;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method, headers },
      (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => {
          let parsed = null;
          try { parsed = chunks ? JSON.parse(chunks) : null; } catch (_) { parsed = chunks; }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function assert(cond, label) {
  if (cond) {
    console.log(`  ok  ${label}`);
  } else {
    console.log(`  FAIL  ${label}`);
    failures.push(label);
  }
}

(async function main() {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  console.log(`[test] listening on ${server.address().port}`);

  try {
    let r = await request('GET', '/api/health');
    assert(r.status === 200, 'GET /api/health');

    r = await request('GET', '/api/inbox');
    assert(r.status === 401, 'GET /api/inbox without token returns 401');

    r = await request('POST', '/api/auth/login', { email: 'safoura@ids.example', password: 'Admin123!' });
    assert(r.status === 200 && r.body.token, 'admin login returns token');
    adminToken = r.body.token;

    r = await request('POST', '/api/auth/login', { email: 'arman@ids.example', password: 'Consultant123!' });
    assert(r.status === 200 && r.body.token, 'consultant login returns token');
    consultantToken = r.body.token;

    r = await request('POST', '/api/auth/login', { email: 'safoura@ids.example', password: 'wrong' });
    assert(r.status === 401, 'wrong password returns 401');

    r = await request('GET', '/api/auth/me', null, adminToken);
    assert(r.status === 200 && r.body.role === 'ADMIN', 'GET /api/auth/me as admin');

    r = await request('GET', '/api/inbox', null, adminToken);
    assert(r.status === 200 && r.body.length >= 4, 'admin sees full inbox');
    const adminInbox = r.body;

    r = await request('GET', '/api/inbox', null, consultantToken);
    assert(
      r.status === 200 && r.body.every((c) => !c.assignedTo || c.assignedTo.name === 'Arman R.'),
      'consultant sees only own conversations'
    );
    assert(r.body.length < adminInbox.length, 'consultant inbox is a subset of admin inbox');

    r = await request('GET', '/api/leads', null, consultantToken);
    assert(
      r.body.every((l) => !l.assignedTo || l.assignedTo.name === 'Arman R.'),
      'consultant only sees their own leads'
    );

    r = await request('DELETE', `/api/leads/${adminInbox[0].leadId}`, null, consultantToken);
    assert(r.status === 403, 'consultant cannot delete leads');

    const sharedInbox = adminInbox.find((c) => c.assignedTo && c.assignedTo.name !== 'Arman R.');
    if (sharedInbox) {
      r = await request('GET', `/api/conversations/${sharedInbox.id}`, null, consultantToken);
      assert(r.status === 403, "consultant cannot read other consultants' conversations");
    }

    r = await request('POST', '/api/auth/register', {
      email: 'x@ids.example', name: 'X', password: 'secret123',
    }, consultantToken);
    assert(r.status === 403, 'consultant cannot register users');

    const newEmail = `tester+${Date.now()}@ids.example`;
    r = await request('POST', '/api/auth/register', {
      email: newEmail, name: 'Tester', password: 'TestPass123!', role: 'CONSULTANT',
    }, adminToken);
    assert(r.status === 201, 'admin can register a new user');

    r = await request('POST', `/api/conversations/${adminInbox[0].id}/messages`,
      { body: '[test] admin reply' }, adminToken);
    assert(r.status === 201 && r.body.direction === 'OUT', 'admin can send outbound');

    const consultantLeadId = (await request('GET', '/api/leads', null, consultantToken)).body[0].id;
    r = await request('POST', `/api/leads/${consultantLeadId}/notes`,
      { body: '[test] note' }, consultantToken);
    assert(r.status === 201, 'consultant can add note to own lead');

    const ext = `tg:test_${Date.now()}`;
    r = await request('POST', '/api/ingest', {
      channel: 'TELEGRAM',
      externalContactId: ext,
      externalMessageId: `${ext}:m1`,
      from: { name: 'Test User' },
      body: 'Hi from automated test',
    });
    assert(r.status === 201 && r.body.lead && r.body.lead.status === 'NEW',
      'POST /api/ingest creates lead');

  } catch (e) {
    console.error('[test] unexpected error', e);
    failures.push('unexpected error: ' + e.message);
  } finally {
    server.close();
    if (failures.length) {
      console.log(`\n[test] ${failures.length} FAILURES:\n  - ${failures.join('\n  - ')}`);
      process.exit(1);
    } else {
      console.log('\n[test] ALL PASSED');
      process.exit(0);
    }
  }
})();
