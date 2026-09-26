module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'apiKey',
      label: 'API key',
      required: true,
      type: 'password',
      helpText:
        'Create a key in the Developer tab of your [MailProbe dashboard](https://mailprobe.dev/dashboard/#/developer). MailProbe shows it only once, when you create it.',
    },
  ],
  // The balance endpoint costs no credit: a key that reads it can verify.
  test: {
    url: 'https://mailprobe.dev/api/v1/credits',
    method: 'GET',
  },
};
