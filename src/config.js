require('./dotenvify').config({
  ...require('./env-options')(),
  ...require('./cli-options')(),
});
