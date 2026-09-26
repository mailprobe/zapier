const { version } = require('./package.json');

const USER_AGENT = `zapier-mailprobe/${version}`;

const PRICING_URL = 'https://mailprobe.dev/pricing/';
const KEYS_URL = 'https://mailprobe.dev/dashboard/#/developer';

function includeApiKey(request, z, bundle) {
  if (bundle.authData && bundle.authData.apiKey) {
    request.headers.Authorization = `Bearer ${bundle.authData.apiKey}`;
  }
  request.headers['User-Agent'] = USER_AGENT;
  return request;
}

function parseBody(response) {
  try {
    return response.data !== undefined ? response.data : JSON.parse(response.content);
  } catch {
    return undefined;
  }
}

// Turns MailProbe's error codes into the Zapier errors that make a Zap behave right:
// a revoked key asks the user to reconnect, a domain reserved to purchased credits
// stops this run without turning the Zap off. A 429 never gets here: Zapier's core
// turns it into a retry after the Retry-After delay before this middleware runs.
function handleErrors(response, z, bundle) {
  if (response.status < 400) return response;

  const body = parseBody(response);
  const code = body && typeof body.code === 'string' ? body.code : undefined;
  const apiMessage = body && typeof body.error === 'string' ? body.error : undefined;

  if (response.status === 401 || code === 'UNAUTHORIZED') {
    const message = `Your MailProbe API key is invalid or has been revoked. Create a new key in the Developer tab of your MailProbe dashboard (${KEYS_URL}) and reconnect.`;
    if (bundle.meta && bundle.meta.isTestingAuth) throw new z.errors.Error(message, 'Unauthorized', 401);
    throw new z.errors.ExpiredAuthError(message);
  }
  if (code === 'PAID_ONLY_DOMAIN') {
    throw new z.errors.HaltedError(
      `${apiMessage || 'This domain can only be verified with purchased credits.'} Buy credits at ${PRICING_URL} to verify it.`,
    );
  }
  if (code === 'NO_CREDITS') {
    throw new z.errors.Error(
      `${apiMessage || 'Your MailProbe account has no credits left.'} Buy credits at ${PRICING_URL}, then replay this run.`,
      'NoCredits',
      response.status,
    );
  }
  if (response.status >= 500) {
    throw new z.errors.Error(
      'MailProbe could not complete the verification. The credit is refunded; replay this run in a few minutes.',
      'ServerError',
      response.status,
    );
  }
  throw new z.errors.Error(apiMessage || `MailProbe returned HTTP ${response.status}.`, code || 'ApiError', response.status);
}

module.exports = { includeApiKey, handleErrors, USER_AGENT };
