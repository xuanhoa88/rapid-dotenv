const ENV_OPTIONS = {
  NODE_ENV: 'node_env',
  DEFAULT_NODE_ENV: 'default_node_env',
  DOTENVIFY_PATH: 'path',
  DOTENVIFY_PATTERN: 'pattern',
  DOTENVIFY_ENCODING: 'encoding',
  DOTENVIFY_PURGE_DOTENV: 'purge_dotenv',
  DOTENVIFY_DEBUG: 'debug',
  DOTENVIFY_SILENT: 'silent',
  DOTENVIFY_OVERWRITE: 'overwrite',
};

/**
 * Get environment variable defined options for `dotenvify#config()`.
 *
 * @param {object} [env=process.env]
 * @return {{node_env?: string, default_node_env?: string, path?: string, encoding?: string, purge_dotenv?: string, silent?: string, overwrite?: string}}
 */
module.exports = function env_options(env = process.env) {
  return Object.keys(ENV_OPTIONS).reduce((options, key) => {
    if (Object.hasOwn(env, key)) {
      options[ENV_OPTIONS[key]] = env[key];
    }
    return options;
  }, {});
};
