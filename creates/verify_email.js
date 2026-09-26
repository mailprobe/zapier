const VERIFY_URL = 'https://mailprobe.dev/api/v1/verify';

// Zapier gives a step 30 seconds in all. A mail server that stays silent can hold
// MailProbe longer than that, so the request gives up just before Zapier does.
// The variable only exists so the tests do not wait 27 seconds.
const requestTimeoutMs = () => Number(process.env.MAILPROBE_REQUEST_TIMEOUT_MS) || 27_000;

function isTimeout(error) {
  return Boolean(
    error &&
      (error.type === 'request-timeout' ||
        error.name === 'AbortError' ||
        error.name === 'TimeoutError' ||
        /timeout/i.test(String(error.message))),
  );
}

async function perform(z, bundle) {
  const email = String(bundle.inputData.email ?? '').trim();
  if (!email) {
    throw new z.errors.HaltedError('The Email address field is empty: map a field that holds an email address.');
  }

  let response;
  try {
    response = await z.request({
      url: VERIFY_URL,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: { emails: [email] },
      timeout: requestTimeoutMs(),
    });
  } catch (error) {
    if (isTimeout(error)) {
      throw new z.errors.HaltedError(
        "MailProbe did not finish checking this address within Zapier's 30-second limit because the recipient's mail server is slow to answer. Replay the run later. The check may still use a credit.",
      );
    }
    throw error;
  }

  // One address in, one entry out: the API answers with an array in input order.
  const result = Array.isArray(response.data) ? response.data[0] : undefined;
  if (!result || typeof result !== 'object' || !('result' in result)) {
    throw new z.errors.Error('MailProbe returned an unexpected response.', 'UnexpectedResponse', response.status);
  }
  return result;
}

module.exports = {
  key: 'verify_email',
  noun: 'Email',
  display: {
    label: 'Verify Email',
    description: 'Verifies an email address in real time and tells whether it can receive mail.',
  },
  operation: {
    inputFields: [
      {
        key: 'email',
        label: 'Email address',
        required: true,
        type: 'string',
        helpText:
          "MailProbe asks the recipient's mail server whether this address exists, without sending any email. Each check uses one credit.",
      },
    ],
    perform,
    sample: {
      email: 'jane.doe@example.com',
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
      mx_records: ['mx1.example.com', 'mx2.example.com'],
    },
    outputFields: [
      { key: 'email', label: 'Email address', type: 'string' },
      { key: 'status', label: 'Status (valid, risky, invalid or unknown)', type: 'string' },
      { key: 'result', label: 'Result (deliverable, undeliverable, catch-all or unknown)', type: 'string' },
      { key: 'score', label: 'Score (0-100)', type: 'integer' },
      { key: 'reason', label: 'Reason', type: 'string' },
      { key: 'did_you_mean', label: 'Suggested correction', type: 'string' },
      { key: 'disposable', label: 'Disposable domain', type: 'boolean' },
      { key: 'role_based', label: 'Role-based address', type: 'boolean' },
      { key: 'free_provider', label: 'Free email provider', type: 'boolean' },
      { key: 'catch_all', label: 'Catch-all domain', type: 'boolean' },
      { key: 'syntax', label: 'Valid syntax', type: 'boolean' },
      { key: 'mx_found', label: 'MX records found', type: 'boolean' },
      { key: 'smtp_check', label: 'Mailbox checked over SMTP', type: 'boolean' },
      { key: 'smtp_code', label: 'SMTP reply code', type: 'integer' },
      { key: 'smtp_enhanced_code', label: 'SMTP enhanced status code', type: 'string' },
      { key: 'retry_after', label: 'Retry after (seconds)', type: 'integer' },
      { key: 'mx_records', label: 'MX records', type: 'string', list: true },
    ],
  },
};
