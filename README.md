# MailProbe for Zapier

The Zapier integration of [MailProbe](https://mailprobe.dev), the email verification API: it checks in real time whether an address exists and can receive mail, without sending any email.

## What it does

**Verify Email** (action) sends one address to `POST https://mailprobe.dev/api/v1/verify` and returns its result: `status` (valid, risky, invalid or unknown), the raw SMTP `result`, a 0-100 `score`, the `reason` when the verdict is not a plain deliverable, a suggested correction (`did_you_mean`), and the disposable, role-based, free-provider and catch-all flags. Each check uses one MailProbe credit.

The connection asks for a MailProbe API key, created in the Developer tab of the [MailProbe dashboard](https://mailprobe.dev/dashboard/#/developer). It is tested against `GET /api/v1/credits`, which costs no credit.

## How it behaves

- A revoked or invalid key turns the Zap off and asks the user to reconnect.
- The API allows 60 requests per minute per key. Zapier retries a rate-limited run after the `Retry-After` delay.
- A domain that MailProbe verifies with purchased credits only stops the run without turning the Zap off. An empty account fails the run with a link to the pricing page.
- Zapier gives a step 30 seconds. A mail server that stays silent can hold a check longer: the request gives up after 27 seconds and the run stops with an explanation, without turning the Zap off.

## Development

```bash
npm install
npm test
npx zapier-platform validate
npx zapier-platform push
```

The integration runs on Node.js 22 in Zapier. `branding/logo-512.png` is the logo uploaded in the Zapier Platform UI.

## License

MIT
