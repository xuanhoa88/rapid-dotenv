const fs = require('fs');
const { resolve } = require('path');
const objectMerger = require('./object-merger');

// Default file pattern for .env files, which includes optional placeholders for `node_env` and `local`
const DEFAULT_PATTERN = '.env[.node_env][.local]';

// Regular expression to match the `[local]` placeholder in the file pattern
const LOCAL_PLACEHOLDER_REGEX = /\[(\W*\blocal\b\W*)]/g;

// Regular expression to match the `[node_env]` placeholder in the file pattern
const NODE_ENV_PLACEHOLDER_REGEX = /\[(\W*\b)node_env(\b\W*)]/g;

// Array of supported configuration option keys for the dotenv functionality
const CONFIG_OPTION_KEYS = [
  'node_env', // Specifies the current environment (e.g., development, production)
  'default_node_env', // Fallback environment when `node_env` is not provided
  'path', // Custom path to the .env file
  'pattern', // File pattern to match .env files
  'files', // List of specific .env files to load
  'encoding', // Encoding to use when reading .env files
  'purge_dotenv', // Flag to clear existing environment variables
  'silent', // Suppress errors if .env file is missing
];

// Regular expression to match dotenv variable substitutions (e.g., `${VARIABLE}`, `${VARIABLE:-default}`)
const DOTENV_SUBSTITUTION_REGEX =
  /(\\)?(\$)(?!\()(\{?)([\w.]+)(?::?-((?:\$\{(?:\$\{(?:\$\{[^}]*\}|[^}])*}|[^}])*}|[^}])+))?(\}?)/gi;

// Regular expression to match the key portion of a dotenv entry (e.g., `KEY=value` or `export KEY=value`)
const KEY_REGEX = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*/;

// Regular expression to detect whether a value is wrapped in quotes (single, double, or backticks)
const QUOTE_REGEX = /^(['"`])/;

// Function to create a dynamic regular expression that matches a closing quote (accounts for escaped quotes)
const CLOSING_QUOTE_REGEX = quote => new RegExp(`(?<!\\\\)${quote}`);

/**
 * Handles failure by logging the error message if not in silent mode.
 *
 * @param {Error} error - The error that occurred during the operation.
 * @param {object} options - Options object that can control logging behavior.
 * @param {boolean} options.silent - If true, suppresses the error message.
 * @returns {object} - Returns an object containing the error.
 */
function _failure(error, options) {
  // Check if 'silent' option is false, meaning we should log the error
  if (!options.silent) {
    let message = `".env*" files loading failed: ${error.message || error}`;

    // If there is an error, append additional details to the message
    if (error) {
      message += ': %s';
    }

    // Log the warning message to the console with the error details
    console.warn(`[dotenvify]: ${message}`, error);
  }

  // Return the error in an object
  return { error };
}

/**
 * Logs a debug message to the console.
 *
 * @param {string} message - The debug message to log.
 * @param {...*} values - Additional values to log along with the message.
 */
function _debug(message, ...values) {
  // Log the debug message with optional additional values
  console.debug(`[dotenvify]: ${message}`, ...values);
}

/**
 * Returns effective (computed) `node_env`.
 *
 * @param {object} [options]
 * @param {string} [options.node_env]
 * @param {string} [options.default_node_env]
 * @param {boolean} [options.debug]
 * @return {string|undefined} node_env
 */
function _getEffectiveNodeEnv(options = {}) {
  if (options.node_env) {
    options.debug &&
      _debug(`operating in "${options.node_env}" environment (set by \`options.node_env\`)`);
    return options.node_env;
  }

  if (process.env.NODE_ENV) {
    options.debug &&
      _debug(
        `operating in "${process.env.NODE_ENV}" environment (as per \`process.env.NODE_ENV\`)`
      );
    return process.env.NODE_ENV;
  }

  if (options.default_node_env) {
    options.debug &&
      _debug(
        `operating in "${options.default_node_env}" environment (taken from \`options.default_node_env\`)`
      );
    return options.default_node_env;
  }

  options.debug &&
    _debug('operating in "no environment" mode (no environment-related options are set)');
  return undefined;
}

/**
 * Interpolate a value with references to environment variables or defaults.
 */
function _interpolate(value, processEnv, parsed) {
  return value.replace(
    DOTENV_SUBSTITUTION_REGEX,
    (match, escaped, _dollarSign, _openBrace, processKey, defaultValue, _closeBrace) => {
      if (escaped === '\\') {
        return match.slice(1); // retain escaped $ as literal
      }

      // Check if the variable exists in processEnv or parsed
      if (processEnv[processKey]) {
        if (processEnv[processKey] === parsed[processKey]) {
          return processEnv[processKey];
        }
        return _interpolate(processEnv[processKey], processEnv, parsed);
      }

      if (parsed[processKey]) {
        if (parsed[processKey] !== value) {
          return _interpolate(parsed[processKey], processEnv, parsed);
        }
      }

      if (defaultValue) {
        if (defaultValue.startsWith('$')) {
          return _interpolate(defaultValue, processEnv, parsed);
        }
        return defaultValue;
      }

      return '';
    }
  );
}

/**
 * Checks if a string contains only whitespace characters or is empty.
 *
 * This function uses a Unicode-aware regular expression to check for all
 * standard and extended whitespace characters. It returns true if the string
 * is empty or consists solely of whitespace characters.
 *
 * @param {string} value - The string to check.
 * @returns {boolean} - Returns `true` if the string is empty or contains only whitespace, `false` otherwise.
 */
function _isStringEmpty(value) {
  // Regular expression explanation:
  // ^ and $ ensure we match the entire string.
  // \s matches standard ASCII whitespace (e.g., spaces, tabs, newlines).
  // \u00A0 matches non-breaking space.
  // \u1680 matches Ogham space mark.
  // \u2000-\u200A matches various Unicode spaces (e.g., en space, em space).
  // \u2028 and \u2029 match line separator and paragraph separator.
  // \u202F matches narrow no-break space.
  // \u205F matches medium mathematical space.
  // \u3000 matches ideographic space (used in CJK text).
  // \uFEFF matches the zero-width no-break space (BOM).
  return /^[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*$/.test(value);
}

/**
 * Resolves the final value of an environment variable.
 *
 * @param {string} value - The raw value to resolve.
 * @returns {any} - The resolved value (could be boolean, number, object, array, or string).
 */
function _resolveValue(value) {
  const nextVal = value.toString().replace(/\\\$/g, '$'); // Resolve escaped dollar signs

  // If the value is wrapped in backticks (e.g., `value`), return the value inside
  if (nextVal.indexOf('`') === 0 && nextVal.lastIndexOf('`') === nextVal.length - 1) {
    return nextVal.slice(1, nextVal.length - 1);
  }

  // If the value ends with an asterisk (*), remove the asterisk and return the rest
  if (nextVal.lastIndexOf('*') === nextVal.length - 1) {
    return nextVal.slice(0, Math.max(0, nextVal.length - 1));
  }

  // Check for boolean values ('true' or 'false')
  if (['true', 'false'].includes(nextVal.toLowerCase())) {
    return nextVal.toLowerCase() === 'true';
  }

  // Check for numbers (e.g., '123' -> 123)
  if (!_isStringEmpty(nextVal) && !Number.isNaN(Number(nextVal))) {
    return Number(nextVal);
  }

  // Check for arrays or objects (JSON notation)
  const isArray = nextVal.startsWith('[') && nextVal.endsWith(']');
  if (isArray || (nextVal.startsWith('{') && nextVal.endsWith('}'))) {
    try {
      return JSON.parse(nextVal);
    } catch {
      return isArray ? [] : {};
    }
  }

  // Default: return the original string if no other type matched.
  return nextVal;
}

/**
 * Compose a filename from a given `patten`.
 *
 * @param {string} pattern
 * @param {object} [options]
 * @param {boolean} [options.local]
 * @param {string} [options.node_env]
 * @return {string} filename
 */
function _composeFilename(pattern, options) {
  let filename = pattern.toString();

  // Replace local placeholder with the value of options.local if provided
  filename = filename.replace(LOCAL_PLACEHOLDER_REGEX, options && options.local ? '$1' : '');

  // Replace node_env placeholder with the value of options.node_env if provided
  filename = filename.replace(
    NODE_ENV_PLACEHOLDER_REGEX,
    options && options.node_env ? `$1${options.node_env}$2` : ''
  );

  return filename;
}

/**
 * Returns a list of existing `.env*` filenames depending on the given `options`.
 *
 * The resulting list is ordered by the env files'
 * variables overwriting priority from lowest to highest.
 *
 * This can also be referenced as "env files' environment cascade"
 * or "order of ascending priority."
 *
 * ⚠️ Note that the `.env.local` file is not listed for "test" environment,
 * since normally you expect tests to produce the same results for everyone.
 *
 * @param {object} [options] - `.env*` files listing options
 * @param {string} [options.node_env] - node environment (development/test/production/etc.)
 * @param {string} [options.path] - path to the working directory (default: `process.cwd()`)
 * @param {string} [options.pattern] - `.env*` files' naming convention pattern
 *                                       (default: ".env[.node_env][.local]")
 * @param {boolean} [options.debug] - turn on debug messages
 * @return {string[]}
 */
function listFiles(options = {}) {
  options.debug && _debug('listing effective `.env*` files…');

  const { node_env, path = process.cwd(), pattern = DEFAULT_PATTERN } = options;

  const hasLocalPlaceholder = LOCAL_PLACEHOLDER_REGEX.test(pattern);

  const filenames = {};

  if (pattern === DEFAULT_PATTERN) {
    filenames['.env.defaults'] = '.env.defaults'; // for seamless transition from ".env + .env.defaults"
  }

  filenames['.env'] = _composeFilename(pattern);

  if (hasLocalPlaceholder) {
    const envlocal = _composeFilename(pattern, { local: true });

    if (node_env !== 'test') {
      filenames['.env.local'] = envlocal;
    } else if (options.debug && fs.existsSync(resolve(path, envlocal))) {
      _debug('[!] note that `%s` is being skipped for "test" environment', envlocal);
    }
  }

  if (node_env && NODE_ENV_PLACEHOLDER_REGEX.test(pattern)) {
    filenames['.env.node_env'] = _composeFilename(pattern, { node_env });

    if (hasLocalPlaceholder) {
      filenames['.env.node_env.local'] = _composeFilename(pattern, {
        node_env,
        local: true,
      });
    }
  }

  return ['.env.defaults', '.env', '.env.local', '.env.node_env', '.env.node_env.local'].reduce(
    (list, basename) => {
      if (!filenames[basename]) {
        return list;
      }

      const filename = resolve(path, filenames[basename]);
      if (fs.existsSync(filename)) {
        options.debug && _debug('>> %s', filename);
        list.push(filename);
      }

      return list;
    },
    []
  );
}

/**
 * Parses a given file or a list of files.
 *
 * When a list of filenames is given, the files will be parsed and merged in the same order as given.
 *
 * @param {string|string[]} filenames - filename or a list of filenames to parse and merge
 * @param {{ encoding?: string, debug?: boolean }} [options] - parse options
 * @return {Object<string, string>} the resulting map of `{ env_var: value }` as an object
 */
function parse(filenames, options = {}) {
  const parseValue = rawValue => {
    const value = rawValue.trim();
    if (!value) return '';

    // Check if value starts with a quote
    const quoteMatch = value.match(QUOTE_REGEX);
    if (quoteMatch) {
      const [, quote] = quoteMatch;
      const content = value.slice(1, -1); // Remove quotes
      switch (quote) {
        case '"':
          return content
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\\\/g, '\\')
            .replace(/\\"/g, '"');
        case "'":
          return content;
        case '`':
          return content;
      }
    }

    // Handle unquoted value
    return value.replace(/\\\n\s*/g, '');
  };

  const parseFile = filename => {
    options.debug && _debug('parsing "%s"...', filename);
    try {
      const parsed = {};
      const content = fs
        .readFileSync(filename, options.encoding ? { encoding: options.encoding } : 'utf8')
        .toString();

      // Normalize line endings
      const lines = content.replace(/\r\n?/g, '\n').split('\n');

      let currentKey = null;
      let currentValue = [];
      let inQuotedValue = false;
      let quoteChar = null;

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Skip empty lines and comments when not in a quoted value
        if (!inQuotedValue && (!line.trim() || line.trim().startsWith('#'))) {
          continue;
        }

        if (!currentKey) {
          // Look for new key
          const keyMatch = line.match(KEY_REGEX);
          if (keyMatch) {
            currentKey = keyMatch[1];
            // Get the value part after the =
            let valueStart = line.slice(keyMatch[0].length);

            // Check if value starts with a quote
            const quoteMatch = valueStart.trim().match(QUOTE_REGEX);
            if (quoteMatch) {
              quoteChar = quoteMatch[1];
              inQuotedValue = true;
              // Check if quote closes on the same line
              const closingQuoteRegex = CLOSING_QUOTE_REGEX(quoteChar);
              const remainingValue = valueStart.trim().slice(1);
              const closingMatch = remainingValue.match(closingQuoteRegex);

              if (closingMatch) {
                // Single line quoted value
                parsed[currentKey] = parseValue(valueStart.trim());
                currentKey = null;
                inQuotedValue = false;
                quoteChar = null;
              } else {
                // Start of multi-line quoted value
                currentValue.push(valueStart.trim().slice(1));
              }
            } else {
              // Unquoted value
              if (valueStart.endsWith('\\')) {
                // Line continuation
                currentValue.push(valueStart.slice(0, -1).trim());
              } else {
                // Single line unquoted value
                parsed[currentKey] = parseValue(valueStart);
                currentKey = null;
              }
            }
          }
        } else {
          // Continuing a value
          if (inQuotedValue) {
            const closingQuoteRegex = CLOSING_QUOTE_REGEX(quoteChar);
            const closingMatch = line.match(closingQuoteRegex);

            if (closingMatch) {
              // End of quoted value
              currentValue.push(line.slice(0, closingMatch.index));
              parsed[currentKey] = parseValue(`${quoteChar}${currentValue.join('\n')}${quoteChar}`);
              currentKey = null;
              currentValue = [];
              inQuotedValue = false;
              quoteChar = null;
            } else {
              // Continue quoted value
              currentValue.push(line);
            }
          } else {
            // Continue unquoted value
            if (line.endsWith('\\')) {
              currentValue.push(line.slice(0, -1).trim());
            } else {
              currentValue.push(line.trim());
              parsed[currentKey] = parseValue(currentValue.join('\n'));
              currentKey = null;
              currentValue = [];
            }
          }
        }
      }

      // Handle any remaining value
      if (currentKey && currentValue.length > 0) {
        if (inQuotedValue) {
          parsed[currentKey] = parseValue(`${quoteChar}${currentValue.join('\n')}${quoteChar}`);
        } else {
          parsed[currentKey] = parseValue(currentValue.join('\n'));
        }
      }

      if (options.debug) {
        Object.keys(parsed).forEach(key => {
          _debug('>> %s is being overwritten by merge from "%s"', key, filename);
        });
      }
      return parsed;
    } catch (_err) {
      const { error } = _failure(_err, options);
      throw error;
    }
  };

  return [...(Array.isArray(filenames) ? filenames : [filenames])].reduce(
    (result, filename) => objectMerger(options.merger)(result, parseFile(filename)),
    {}
  );
}

/**
 * Parses variables defined in given file(s) and assigns them to `process.env`.
 *
 * Variables that are already defined in `process.env` will not be overwritten,
 * thus giving a higher priority to environment variables predefined by the shell.
 *
 * If the loading is successful, an object with `parsed` property is returned.
 * The `parsed` property contains parsed variables' `key => value` pairs merged in order using
 * the "overwrite merge" strategy.
 *
 * If parsing fails for any of the given files, `process.env` is being left untouched,
 * and an object with `error` property is returned.
 * The `error` property, if present, references to the occurred error.
 *
 * @param {string|string[]} filenames - filename or a list of filenames to parse and merge
 * @param {object} [options] - file loading options
 * @param {string} [options.encoding="utf8"] - encoding of `.env*` files
 * @param {boolean} [options.debug=false] - turn on debug messages
 * @param {boolean} [options.silent=false] - suppress console errors and warnings
 * @param {object} [options.merger] - env merger
 * @return {{ error: Error } | { parsed: Object<string, string> }}
 */
function load(filenames, options = {}) {
  try {
    const parsed = parse(filenames, {
      encoding: options.encoding,
      debug: options.debug,
      silent: options.silent,
      merger: options.merger,
    });

    options.debug && _debug('safe-merging parsed environment variables into `process.env`…');

    const processEnv = Object.assign({}, process.env);
    for (const processKey of Object.keys(parsed)) {
      if (!Object.hasOwn(processEnv, processKey)) {
        options.debug && _debug('>> process.env.%s', processKey);
        parsed[processKey] = _resolveValue(_interpolate(parsed[processKey], processEnv, parsed));
      } else if (options.debug && processEnv[processKey] !== parsed[processKey]) {
        _debug('environment variable `%s` is predefined and not being overwritten', processKey);
      }
    }

    process.env = objectMerger(options.merger)(parsed, processEnv);

    return { parsed };
  } catch (_err) {
    return _failure(_err, options);
  }
}

/**
 * Unload variables defined in a given file(s) from `process.env`.
 *
 * This function can gracefully resolve the following issue:
 *
 * In some cases, the original "dotenv" library can be used by one of the dependent npm modules.
 * It causes calling the original `dotenv.config()` that loads the `.env` file from your project before you can call `dotenvify.config()`.
 * Such cases break `.env*` files priority because the previously loaded environment variables are treated as shell-defined thus having a higher priority.
 *
 * Unloading the previously loaded `.env` file can be activated when using the `dotenvify.config()` with the `purge_dotenv` option set to `true`.
 *
 * @param {string|string[]} filenames - filename or a list of filenames to unload
 * @param {object} [options] - `fs.readFileSync` options
 */
function unload(filenames, options = {}) {
  const parsed = parse(filenames, options);
  Object.keys(parsed).forEach(processKey => {
    if (process.env[processKey] === parsed[processKey]) {
      delete process.env[processKey];
    }
  });
}

/**
 * "dotenvify" initialization function (API entry point).
 *
 * Allows configuring dotenvify programmatically.
 *
 * @param {object} [options] - configuration options
 * @param {string} [options.node_env=process.env.NODE_ENV] - node environment (development/test/production/etc.)
 * @param {string} [options.default_node_env] - the default node environment
 * @param {string} [options.path=process.cwd()] - path to `.env*` files directory
 * @param {string} [options.pattern=".env[.node_env][.local]"] - `.env*` files' naming convention pattern
 * @param {string[]} [options.files] - an explicit list of `.env*` files to load (note that `options.[default_]node_env` and `options.pattern` are ignored in this case)
 * @param {string} [options.encoding="utf8"] - encoding of `.env*` files
 * @param {boolean} [options.purge_dotenv=false] - perform the `.env` file {@link unload}
 * @param {boolean} [options.debug=false] - turn on detailed logging to help debug why certain variables are not being set as you expect
 * @param {boolean} [options.silent=false] - suppress all kinds of warnings including ".env*" files' loading errors
 * @param {object} [options.merger] - env merger
 * @return {{ parsed?: object, error?: Error }} with a `parsed` key containing the loaded content or an `error` key with an error that is occurred
 */
function config(options = {}) {
  if (options.debug) {
    _debug('initializing…');

    CONFIG_OPTION_KEYS.filter(processKey => Object.hasOwn(options, processKey)).forEach(
      processKey => _debug(`| options.${processKey} =`, options[processKey])
    );
  }

  const { path = process.cwd(), pattern = DEFAULT_PATTERN } = options;

  if (options.purge_dotenv) {
    options.debug &&
      _debug('`options.purge_dotenv` is enabled, unloading potentially pre-loaded `.env`…');

    try {
      const dotenvFile = resolve(path, '.env');
      fs.existsSync(dotenvFile) && unload(dotenvFile, { encoding: options.encoding });
    } catch (_err) {
      _failure(_err, options);
    }
  }

  try {
    let filenames;

    if (Array.isArray(options.files)) {
      options.debug &&
        _debug('using explicit list of `.env*` files: %s…', options.files.join(', '));

      filenames = options.files.reduce((list, basename) => {
        const filename = resolve(path, basename);

        if (fs.existsSync(filename)) {
          list.push(filename);
        } else if (options.debug) {
          _debug('>> %s does not exist, skipping…', filename);
        }

        return list;
      }, []);
    } else {
      const node_env = _getEffectiveNodeEnv(options);

      filenames = listFiles({ node_env, path, pattern, debug: options.debug });

      if (filenames.length === 0) {
        const _pattern = node_env
          ? pattern.replace(NODE_ENV_PLACEHOLDER_REGEX, `[$1${node_env}$2]`)
          : pattern;

        return _failure(
          new Error(`no ".env*" files matching pattern "${_pattern}" in "${path}" dir`),
          options
        );
      }
    }

    const result = load(Array.from(new Set(filenames)), {
      encoding: options.encoding,
      debug: options.debug,
      silent: options.silent,
      merger: options.merger,
    });

    options.debug && _debug('initialization completed.');

    return result;
  } catch (_err) {
    return _failure(_err, options);
  }
}

module.exports = {
  DEFAULT_PATTERN,
  listFiles,
  parse,
  load,
  unload,
  config,
  objectMerger,
};
