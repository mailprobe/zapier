const nock = require('nock');
const zapier = require('zapier-platform-core');

const App = require('../index');
const { USER_AGENT } = require('../middleware');

const appTester = zapier.createAppTester(App);
const perform = App.creates.verify_email.operation.perform;
const API = 'https://mailprobe.dev';
const KEY = 'mp_live_test_key';

const bundleFor = (email, meta = {}) => ({ authData: { apiKey: KEY }, inputData: { email }, meta });

const RESULT = {
  email: 'jane@example.com',
  result: 'deliverable',
  status: 'valid',
  score: 92,
  catch_all: false,
  reason: null,
  retry_after: null,
  smtp_code: 250,
  smtp_enhanced_code: '2.1.5',
  syntax: true,
  mx_found: true,
  smtp_check: true,
  disposable: false,
  role_based: false,
  free_provider: false,
  did_you_mean: null,
  mx_records: ['mx1.example.com'],
};

beforeAll(() => nock.disableNetConnect());
afterEach(() => {
  nock.abortPendingRequests();
  nock.cleanAll();
});
afterAll(() => nock.enableNetConnect());

describe('Verify Email', () => {
  it('sends the trimmed address with the key and returns its result', async () => {
    const scope = nock(API, { reqheaders: { authorization: `Bearer ${KEY}`, 'user-agent': (ua) => ua.includes(USER_AGENT) } })
      .post('/api/v1/verify', { emails: ['jane@example.com'] })
      .reply(200, [RESULT]);

    const result = await appTester(perform, bundleFor('  jane@example.com '));

    expect(result).toEqual(RESULT);
    scope.done();
  });

  it('stops without calling the API when the address is empty', async () => {
    await expect(appTester(perform, bundleFor('   '))).rejects.toMatchObject({ name: 'HaltedError' });
  });

  it('asks the user to reconnect when a live run meets a revoked key', async () => {
    nock(API).post('/api/v1/verify').reply(401, { error: 'Invalid API key', code: 'UNAUTHORIZED' });

    const error = await appTester(perform, bundleFor('jane@example.com')).catch((e) => e);

    expect(error.name).toBe('ExpiredAuthError');
    expect(error.message).toMatch(/invalid or has been revoked/);
  });

  // Zapier's core does this before the app's middleware: the test guards the behaviour.
  it('retries after the Retry-After delay when the key is rate-limited', async () => {
    nock(API)
      .post('/api/v1/verify')
      .reply(429, { error: 'Too many requests', code: 'RATE_LIMITED' }, { 'Retry-After': '17' });

    const error = await appTester(perform, bundleFor('jane@example.com')).catch((e) => e);

    expect(error.name).toBe('ThrottledError');
    expect(JSON.parse(error.message).delay).toBe(17);
  });

  it('stops this run only, without an error that turns the Zap off, on a paid-only domain', async () => {
    nock(API)
      .post('/api/v1/verify')
      .reply(402, { error: 'comcast.net can only be verified with purchased credits', code: 'PAID_ONLY_DOMAIN' });

    const error = await appTester(perform, bundleFor('joe@comcast.net')).catch((e) => e);

    expect(error.name).toBe('HaltedError');
    expect(error.message).toMatch(/comcast\.net/);
  });

  it('fails the run with a way out when the account has no credits', async () => {
    nock(API).post('/api/v1/verify').reply(402, { error: 'Not enough credits', code: 'NO_CREDITS' });

    const error = await appTester(perform, bundleFor('jane@example.com')).catch((e) => e);

    expect(error.name).toBe('AppError');
    expect(error.message).toMatch(/mailprobe\.dev\/pricing/);
  });

  it('reports a server failure as refunded', async () => {
    nock(API).post('/api/v1/verify').reply(500, { error: 'Internal error', code: 'INTERNAL_ERROR' });

    await expect(appTester(perform, bundleFor('jane@example.com'))).rejects.toThrow(/refunded/);
  });

  it('turns a request that outlives the time limit into a halted run', async () => {
    process.env.MAILPROBE_REQUEST_TIMEOUT_MS = '200';
    nock(API).post('/api/v1/verify').delay(2000).reply(200, [RESULT]);

    const error = await appTester(perform, bundleFor('slow@example.com')).catch((e) => e);
    delete process.env.MAILPROBE_REQUEST_TIMEOUT_MS;

    expect(error.name).toBe('HaltedError');
    expect(error.message).toMatch(/30-second limit/);
  });

  it('refuses an answer that is not a result array', async () => {
    nock(API).post('/api/v1/verify').reply(200, { ok: true });

    await expect(appTester(perform, bundleFor('jane@example.com'))).rejects.toThrow(/unexpected response/);
  });

  it('keeps the static sample aligned with the declared output fields', () => {
    const { sample, outputFields } = App.creates.verify_email.operation;
    expect(outputFields.map((f) => f.key).sort()).toEqual(Object.keys(sample).sort());
  });
});

describe('Authentication', () => {
  it('passes the connection test with a key that reads the balance', async () => {
    nock(API, { reqheaders: { authorization: `Bearer ${KEY}` } }).get('/api/v1/credits').reply(200, { credits: 847 });

    const response = await appTester(App.authentication.test, bundleFor(undefined, { isTestingAuth: true }));

    expect(response.data || response).toMatchObject({ credits: 847 });
  });

  it('explains a refused key during the connection test instead of expiring it', async () => {
    nock(API).get('/api/v1/credits').reply(401, { error: 'Invalid API key', code: 'UNAUTHORIZED' });

    const error = await appTester(App.authentication.test, bundleFor(undefined, { isTestingAuth: true })).catch((e) => e);

    expect(error.name).toBe('AppError');
    expect(error.message).toMatch(/Developer tab/);
  });
});
