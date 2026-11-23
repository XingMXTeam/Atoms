const { request } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const out = path.resolve('.harness/tasks/generate-loop/evidence/c2-20261123-2/api-checks.json');
  const api = await request.newContext({ baseURL: 'http://127.0.0.1:3000' });
  const checks = [];
  const created = await api.post('/api/projects', { data: { prompt: 'API 检查：生成待办应用' } });
  const createBody = await created.json();
  checks.push({ case: 'POST /api/projects valid prompt', expected: '200 with projectId, runId, mode', actualStatus: created.status(), actualBody: createBody, verdict: created.ok() && !!createBody.projectId && !!createBody.runId ? 'PASS' : 'FAIL' });

  const invalid = await api.post('/api/projects', { data: { prompt: '   ' } });
  checks.push({ case: 'POST /api/projects empty prompt', expected: '400 with Chinese validation message', actualStatus: invalid.status(), actualBody: await invalid.json(), verdict: invalid.status() === 400 ? 'PASS' : 'FAIL' });

  const malformed = await api.post('/api/projects', { data: '{bad json', headers: { 'content-type': 'application/json' } });
  checks.push({ case: 'POST /api/projects malformed JSON', expected: '400 with Chinese format message', actualStatus: malformed.status(), actualBody: await malformed.json(), verdict: malformed.status() === 400 ? 'PASS' : 'FAIL' });

  const stream = await api.get(`/api/projects/${createBody.projectId}/runs/${createBody.runId}/stream`);
  const streamText = await stream.text();
  const events = [...streamText.matchAll(/^data: (.+)$/gm)].map(match => { try { return JSON.parse(match[1]); } catch { return null; } }).filter(Boolean);
  checks.push({ case: 'GET stream for owned project/run', expected: '200 text/event-stream with ordered Planner, Architect, Engineer events and increasing seq', actualStatus: stream.status(), contentType: stream.headers()['content-type'], events: events.map(event => ({ agent: event.agent, type: event.type, seq: event.seq })), monotonicSeq: events.every((event, index) => index === 0 || event.seq > events[index - 1].seq), verdict: stream.status() === 200 && events.some(event => event.agent === 'planner') && events.some(event => event.agent === 'architect') && events.some(event => event.agent === 'engineer') ? 'PASS' : 'FAIL' });

  const foreign = await request.newContext({ baseURL: 'http://127.0.0.1:3000' });
  const denied = await foreign.get(`/api/projects/${createBody.projectId}/runs/${createBody.runId}/stream`);
  checks.push({ case: 'GET stream from a different deviceId context', expected: '404 project not found', actualStatus: denied.status(), actualBody: await denied.json(), verdict: denied.status() === 404 ? 'PASS' : 'FAIL' });
  await foreign.dispose();
  await api.dispose();
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify({ checks }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
