const { version } = require('./package.json');
const { version: platformVersion } = require('zapier-platform-core');

const authentication = require('./authentication');
const { includeApiKey, handleErrors } = require('./middleware');
const verifyEmail = require('./creates/verify_email');

module.exports = {
  version,
  platformVersion,

  // Empty values reach perform() as they are: the action reports an empty address itself.
  flags: { cleanInputData: false },

  authentication,
  beforeRequest: [includeApiKey],
  afterResponse: [handleErrors],

  triggers: {},
  searches: {},
  creates: {
    [verifyEmail.key]: verifyEmail,
  },
  resources: {},
};
