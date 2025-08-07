/* eslint-disable no-console */
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('dotenvify (API)', () => {
  let _processEnvBackup;
  let dotenvify;

  beforeAll(() => {
    _processEnvBackup = process.env;
  });

  beforeEach(() => {
    process.env = { ..._processEnvBackup };
    dotenvify = require('../../src/dotenvify');
  });

  afterAll(() => {
    process.env = _processEnvBackup;
  });

  // --

  let $processCwd;

  beforeEach(() => {
    $processCwd = jest.spyOn(process, 'cwd').mockReturnValue('/path/to/project');
  });

  afterEach(() => {
    $processCwd.mockRestore();
  });

  if (os.platform() === 'win32') {
    let $pathResolve;
    beforeEach(() => {
      $pathResolve = jest.spyOn(path, 'resolve').mockImplementation((...paths) => paths.join('/'));
    });

    afterEach(() => {
      $pathResolve.mockRestore();
    });
  }

  // --

  /**
   * `.env*` files stub.
   *
   * @type {{ [filename: string]: string }}
   */
  let $dotenvFiles = {};

  /**
   * Mock `.env*` files.
   *
   * @param {{[filename: string]: string}} fileMap - a map of `filename => contents`
   */
  function mockFS(fileMap) {
    $dotenvFiles = fileMap;
  }

  afterEach(() => {
    $dotenvFiles = {};
  });

  let $fs_existsSync;

  beforeEach(() => {
    $fs_existsSync = jest
      .spyOn(fs, 'existsSync')
      .mockImplementation(filename => Object.prototype.hasOwnProperty.call($dotenvFiles, filename));
  });

  afterEach(() => {
    $fs_existsSync.mockRestore();
  });

  let $fs_readFileSync;

  beforeEach(() => {
    $fs_readFileSync = jest.spyOn(fs, 'readFileSync').mockImplementation((filename, options) => {
      if (!Object.prototype.hasOwnProperty.call($dotenvFiles, filename)) {
        const error = new Error(`ENOENT: no such file or directory, open '${filename}'`);
        error.code = 'ENOENT';
        error.errno = -2; // ENOENT's numeric error code
        error.syscall = 'read';
        error.path = filename;
        throw error;
      }
      return $dotenvFiles[filename];
    });
  });

  afterEach(() => {
    $fs_readFileSync.mockRestore();
  });

  // --

  describe('.listFiles', () => {
    describe('by default (when no options are given)', () => {
      test('lists the default `.env` file if present', () => {
        expect(dotenvify.listFiles()).not.toContain('.env');

        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
        });

        expect(dotenvify.listFiles()).toContain('/path/to/project/.env');
      });

      test('lists the `.env.local` file if present', () => {
        expect(dotenvify.listFiles()).not.toContain('/path/to/project/.env.local');

        mockFS({
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
        });

        expect(dotenvify.listFiles()).toContain('/path/to/project/.env.local');
      });

      test('lists the `.env.defaults` file if present', () => {
        expect(dotenvify.listFiles()).not.toContain('/path/to/project/.env.defaults');

        mockFS({
          '/path/to/project/.env.defaults': 'DEFAULT_ENV_VAR=ok',
        });

        expect(dotenvify.listFiles()).toContain('/path/to/project/.env.defaults');
      });

      test('lists files in the order of ascending priority', () => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
        });

        expect(dotenvify.listFiles()).toEqual([
          '/path/to/project/.env',
          '/path/to/project/.env.local',
        ]);

        // --

        mockFS({
          '/path/to/project/.env.defaults': 'DEFAULT_ENV_VAR=ok',
          '/path/to/project/.env': 'LOCAL_ENV_VAR=ok',
        });

        expect(dotenvify.listFiles()).toEqual([
          '/path/to/project/.env.defaults',
          '/path/to/project/.env',
        ]);
      });
    });

    describe('when `options.node_env` is given', () => {
      let options;

      beforeEach(() => {
        options = { node_env: 'development' };
      });

      test('lists the default `.env` file if present', () => {
        expect(dotenvify.listFiles({ ...options })).not.toContain('/path/to/project/.env');

        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
        });

        expect(dotenvify.listFiles({ ...options })).toContain('/path/to/project/.env');
      });

      test('lists the `.env.local` file if present', () => {
        expect(dotenvify.listFiles({ ...options })).not.toContain('/path/to/project/.env.local');

        mockFS({
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
        });

        expect(dotenvify.listFiles({ ...options })).toContain('/path/to/project/.env.local');
      });

      test('lists the "node_env-specific" file if present', () => {
        expect(dotenvify.listFiles({ ...options })).not.toContain(
          '/path/to/project/.env.development'
        );

        mockFS({
          '/path/to/project/.env.development': 'DEVELOPMENT_ENV_VAR=ok',
        });

        expect(dotenvify.listFiles({ ...options })).toContain('/path/to/project/.env.development');
      });

      test('lists the "node_env-specific" local file if present', () => {
        expect(dotenvify.listFiles({ ...options })).not.toContain(
          '/path/to/project/.env.development.local'
        );

        mockFS({
          '/path/to/project/.env.development.local': 'LOCAL_DEVELOPMENT_ENV_VAR=ok',
        });

        expect(dotenvify.listFiles({ ...options })).toContain(
          '/path/to/project/.env.development.local'
        );
      });

      test('lists the `.env.defaults` file if present', () => {
        expect(dotenvify.listFiles({ ...options })).not.toContain('/path/to/project/.env.defaults');

        mockFS({
          '/path/to/project/.env.defaults': 'DEFAULT_ENV_VAR=ok',
        });

        expect(dotenvify.listFiles({ ...options })).toContain('/path/to/project/.env.defaults');
      });

      test('lists files in the order of ascending priority', () => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
        });

        expect(dotenvify.listFiles({ ...options })).toEqual([
          '/path/to/project/.env',
          '/path/to/project/.env.local',
        ]);

        // --

        mockFS({
          '/path/to/project/.env.defaults': 'DEFAULT_ENV_VAR=ok',
          '/path/to/project/.env': 'LOCAL_ENV_VAR=ok',
        });

        expect(dotenvify.listFiles({ ...options })).toEqual([
          '/path/to/project/.env.defaults',
          '/path/to/project/.env',
        ]);

        // --

        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
          '/path/to/project/.env.development': 'DEVELOPMENT_ENV_VAR=ok',
        });

        expect(dotenvify.listFiles({ ...options })).toEqual([
          '/path/to/project/.env',
          '/path/to/project/.env.development',
        ]);

        // --

        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
          '/path/to/project/.env.development': 'DEVELOPMENT_ENV_VAR=ok',
          '/path/to/project/.env.development.local': 'LOCAL_DEVELOPMENT_ENV_VAR=ok',
        });

        expect(dotenvify.listFiles({ ...options })).toEqual([
          '/path/to/project/.env',
          '/path/to/project/.env.local',
          '/path/to/project/.env.development',
          '/path/to/project/.env.development.local',
        ]);
      });
    });

    describe('when `options.node_env` is set to "test"', () => {
      let options;

      beforeEach(() => {
        options = { node_env: 'test' };
      });

      test("doesn't list the `.env.local` file", () => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
          '/path/to/project/.env.test': 'TEST_ENV_VAR=ok',
          '/path/to/project/.env.test.local': 'LOCAL_TEST_ENV_VAR=ok',
        });

        const files = dotenvify.listFiles({ ...options });

        expect(files).toEqual([
          '/path/to/project/.env',
          '/path/to/project/.env.test',
          '/path/to/project/.env.test.local',
        ]);

        expect(files).not.toContain('/path/to/project/.env.local');
      });
    });

    describe('when `options.pattern` is set to ".env/[local/]env[.node_env]"', () => {
      let options;

      beforeEach(() => {
        options = { pattern: '.env/[local/]env[.node_env]' };
      });

      describe('… and no `options.node_env` is given', () => {
        test('lists `.env/env` as a default `.env` file', () => {
          mockFS({
            '/path/to/project/.env/env': 'DEFAULT_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toContain('/path/to/project/.env/env');
        });

        test('lists `.env/local/env` as `.env.local` file', () => {
          mockFS({
            '/path/to/project/.env/local/env': 'LOCAL_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toContain('/path/to/project/.env/local/env');
        });

        test('lists files in the order of ascending priority', () => {
          mockFS({
            '/path/to/project/.env/env': 'DEFAULT_ENV_VAR=ok',
            '/path/to/project/.env/local/env': 'LOCAL_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toEqual([
            '/path/to/project/.env/env',
            '/path/to/project/.env/local/env',
          ]);
        });
      });

      describe('… and `options.node_env` is given', () => {
        beforeEach(() => {
          options.node_env = 'development';
        });

        test('lists `.env/env` as a default `.env` file', () => {
          mockFS({
            '/path/to/project/.env/env': 'DEFAULT_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toContain('/path/to/project/.env/env');
        });

        test('lists `.env/local/env` as `.env.local` file', () => {
          mockFS({
            '/path/to/project/.env/local/env': 'LOCAL_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toContain('/path/to/project/.env/local/env');
        });

        test('lists `.env/env.<node_env>` as a "node_env-specific" file', () => {
          mockFS({
            '/path/to/project/.env/env.development': 'DEVELOPMENT_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toContain(
            '/path/to/project/.env/env.development'
          );
        });

        test('lists `.env/local/env.<node_env>` as a local "node_env-specific" file', () => {
          mockFS({
            '/path/to/project/.env/local/env.development': 'LOCAL_DEVELOPMENT_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toContain(
            '/path/to/project/.env/local/env.development'
          );
        });

        test('lists files in the order of ascending priority', () => {
          mockFS({
            '/path/to/project/.env/env': 'DEFAULT_ENV_VAR=ok',
            '/path/to/project/.env/local/env': 'LOCAL_ENV_VAR=ok',
            '/path/to/project/.env/env.development': 'DEVELOPMENT_ENV_VAR=ok',
            '/path/to/project/.env/local/env.development': 'LOCAL_DEVELOPMENT_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toEqual([
            '/path/to/project/.env/env',
            '/path/to/project/.env/local/env',
            '/path/to/project/.env/env.development',
            '/path/to/project/.env/local/env.development',
          ]);
        });
      });

      describe('… and `options.node_env` is set to "test"', () => {
        beforeEach(() => {
          options.node_env = 'test';
        });

        test("doesn't list `.env.local`'s alternate file", () => {
          mockFS({
            '/path/to/project/.env/env': 'DEFAULT_ENV_VAR=ok',
            '/path/to/project/.env/local/env': 'LOCAL_ENV_VAR=ok',
            '/path/to/project/.env/env.test': 'DEVELOPMENT_ENV_VAR=ok',
            '/path/to/project/.env/local/env.test': 'LOCAL_DEVELOPMENT_ENV_VAR=ok',
          });

          const files = dotenvify.listFiles({ ...options });

          expect(files).toEqual([
            '/path/to/project/.env/env',
            '/path/to/project/.env/env.test',
            '/path/to/project/.env/local/env.test',
          ]);

          expect(files).not.toContain('/path/to/project/.env/local/env');
        });
      });
    });

    describe('when `options.pattern` is set to ".env/[node_env/].env[.node_env][.local]"', () => {
      let options;

      beforeEach(() => {
        options = {
          pattern: '.env/[node_env/].env[.node_env][.local]',
        };
      });

      describe('… and no `options.node_env` is given', () => {
        test('lists `.env/.env` as a default `.env` file', () => {
          mockFS({
            '/path/to/project/.env/.env': 'DEFAULT_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toContain('/path/to/project/.env/.env');
        });

        test('lists `.env/.env.local` as `.env.local` file', () => {
          mockFS({
            '/path/to/project/.env/.env.local': 'LOCAL_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toContain('/path/to/project/.env/.env.local');
        });

        test('lists files in the order of ascending priority', () => {
          mockFS({
            '/path/to/project/.env/.env': 'DEFAULT_ENV_VAR=ok',
            '/path/to/project/.env/.env.local': 'LOCAL_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toEqual([
            '/path/to/project/.env/.env',
            '/path/to/project/.env/.env.local',
          ]);
        });
      });

      describe('… and `options.node_env` is given', () => {
        beforeEach(() => {
          options.node_env = 'development';
        });

        test('lists `.env/.env` as a default `.env` file', () => {
          mockFS({
            '/path/to/project/.env/.env': 'DEFAULT_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toContain('/path/to/project/.env/.env');
        });

        test('lists `.env/.env.local` as `.env.local` file', () => {
          mockFS({
            '/path/to/project/.env/.env.local': 'LOCAL_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toContain('/path/to/project/.env/.env.local');
        });

        test('lists `.env/<node_env>/.env.<node_env>` as a "node_env-specific" file', () => {
          mockFS({
            '/path/to/project/.env/development/.env.development': 'DEVELOPMENT_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toContain(
            '/path/to/project/.env/development/.env.development'
          );
        });

        test('lists `.env/<node_env>/.env.<node_env>.local` as a local "node_env-specific" file', () => {
          mockFS({
            '/path/to/project/.env/development/.env.development.local':
              'LOCAL_DEVELOPMENT_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toContain(
            '/path/to/project/.env/development/.env.development.local'
          );
        });

        test('lists files in the order of ascending priority', () => {
          mockFS({
            '/path/to/project/.env/.env': 'DEFAULT_ENV_VAR=ok',
            '/path/to/project/.env/.env.local': 'LOCAL_ENV_VAR=ok',
            '/path/to/project/.env/development/.env.development': 'DEVELOPMENT_ENV_VAR=ok',
            '/path/to/project/.env/development/.env.development.local':
              'LOCAL_DEVELOPMENT_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toEqual([
            '/path/to/project/.env/.env',
            '/path/to/project/.env/.env.local',
            '/path/to/project/.env/development/.env.development',
            '/path/to/project/.env/development/.env.development.local',
          ]);
        });
      });

      describe('… and `options.node_env` is set to "test"', () => {
        beforeEach(() => {
          options.node_env = 'test';
        });

        test("doesn't list `.env.local`'s alternate file", () => {
          mockFS({
            '/path/to/project/.env/.env': 'DEFAULT_ENV_VAR=ok',
            '/path/to/project/.env/.env.local': 'LOCAL_ENV_VAR=ok',
            '/path/to/project/.env/test/.env.test': 'TEST_ENV_VAR=ok',
            '/path/to/project/.env/test/.env.test.local': 'LOCAL_TEST_ENV_VAR=ok',
          });

          const files = dotenvify.listFiles({ ...options });

          expect(files).toEqual([
            '/path/to/project/.env/.env',
            '/path/to/project/.env/test/.env.test',
            '/path/to/project/.env/test/.env.test.local',
          ]);

          expect(files).not.toContain('/path/to/project/.env/.env.local');
        });
      });
    });

    describe('when `options.pattern` is set to ".env[.local]" (no `[node_env]` placeholder specified)', () => {
      let options;

      beforeEach(() => {
        options = { pattern: '.env[.local]' };
      });

      describe('… and no `options.node_env` is given', () => {
        test('lists the default `.env` file', () => {
          mockFS({
            '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toContain('/path/to/project/.env');
        });

        test('lists the `.env.local` file', () => {
          mockFS({
            '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toContain('/path/to/project/.env.local');
        });

        test('lists files in the order of ascending priority', () => {
          mockFS({
            '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
            '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toEqual([
            '/path/to/project/.env',
            '/path/to/project/.env.local',
          ]);
        });
      });

      describe('… and `options.node_env` is given', () => {
        beforeEach(() => {
          options.node_env = 'development';
        });

        test('lists the default `.env` file', () => {
          mockFS({
            '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toContain('/path/to/project/.env');
        });

        test('lists the `env.local` file', () => {
          mockFS({
            '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toContain('/path/to/project/.env.local');
        });

        test(`doesn't list any "node_env-specific" files`, () => {
          mockFS({
            '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
            '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
            '/path/to/project/.env.development': 'DEVELOPMENT_ENV_VAR=ok',
            '/path/to/project/.env.development.local': 'LOCAL_DEVELOPMENT_ENV_VAR=ok',
          });

          for (const filename of dotenvify.listFiles({ ...options })) {
            expect(filename).not.toContain('development');
          }
        });

        test('lists files in the order of ascending priority', () => {
          mockFS({
            '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
            '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toEqual([
            '/path/to/project/.env',
            '/path/to/project/.env.local',
          ]);
        });
      });

      describe('… and `options.node_env` is set to "test"', () => {
        beforeEach(() => {
          options.node_env = 'test';
        });

        test('lists only the default `.env` file', () => {
          mockFS({
            '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
            '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
            '/path/to/project/.env.test': 'TEST_ENV_VAR=ok',
            '/path/to/project/.env.test.local': 'LOCAL_TEST_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toEqual(['/path/to/project/.env']);
        });
      });
    });

    describe('when `options.pattern` is set to ".env[.node_env]" (no `[local]` placeholder specified)', () => {
      let options;

      beforeEach(() => {
        options = { pattern: '.env[.node_env]' };
      });

      describe('… and no `options.node_env` is given', () => {
        test('lists only the default `.env` file', () => {
          mockFS({
            '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
            '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toEqual(['/path/to/project/.env']);
        });
      });

      describe('… and `options.node_env` is given', () => {
        beforeEach(() => {
          options.node_env = 'development';
        });

        test('lists the default `.env` file', () => {
          mockFS({
            '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toContain('/path/to/project/.env');
        });

        test('lists the "node_env-specific" file', () => {
          mockFS({
            '/path/to/project/.env.development': 'DEVELOPMENT_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toContain(
            '/path/to/project/.env.development'
          );
        });

        test("doesn't list any `.local` files", () => {
          mockFS({
            '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
            '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
            '/path/to/project/.env.development': 'DEVELOPMENT_ENV_VAR=ok',
            '/path/to/project/.env.development.local': 'LOCAL_DEVELOPMENT_ENV_VAR=ok',
          });

          for (const filename of dotenvify.listFiles({ ...options })) {
            expect(filename).not.toContain('local');
          }
        });

        test('lists files in the order of ascending priority', () => {
          mockFS({
            '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
            '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
            '/path/to/project/.env.development': 'DEVELOPMENT_ENV_VAR=ok',
            '/path/to/project/.env.development.local': 'LOCAL_DEVELOPMENT_ENV_VAR=ok',
          });

          expect(dotenvify.listFiles({ ...options })).toEqual([
            '/path/to/project/.env',
            '/path/to/project/.env.development',
          ]);
        });
      });
    });

    describe('when `options.path` is given', () => {
      let options;

      beforeEach(() => {
        options = { path: '/path/to/another/project' };
      });

      test('uses the given `options.path` as a working directory', () => {
        mockFS({
          '/path/to/another/project/.env': 'DEFAULT_ENV_VAR=ok',
          '/path/to/another/project/.env.local': 'LOCAL_ENV_VAR=ok',
        });

        expect(dotenvify.listFiles({ ...options })).toEqual([
          '/path/to/another/project/.env',
          '/path/to/another/project/.env.local',
        ]);
      });
    });
  });

  describe('.parse', () => {
    describe('when a single filename is given', () => {
      beforeEach(() => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
        });
      });

      test('parses the contents of the file returning the resulting `name => value` map', () => {
        const parsed = dotenvify.parse('/path/to/project/.env');

        expect(parsed).toEqual({ DEFAULT_ENV_VAR: 'ok' });
      });

      test("throws if file doesn't exist", () => {
        expect(() =>
          dotenvify.parse('/path/to/project/non-existent-file', { silent: true })
        ).toThrow("ENOENT: no such file or directory, open '/path/to/project/non-existent-file'");
      });
    });

    describe('when multiple filenames are given', () => {
      beforeEach(() => {
        mockFS({
          '/path/to/project/.env':
            'DEFAULT_ENV_VAR=ok\n' + 'SHARED_ENV_VAR="should be overwritten by `.env.local`"',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok\n' + 'SHARED_ENV_VAR=ok',
        });
      });

      test('parses and merges the contents of the given files using the "overwrite merge" strategy', () => {
        const parsed = dotenvify.parse(['/path/to/project/.env', '/path/to/project/.env.local']);

        expect(parsed).toEqual({
          DEFAULT_ENV_VAR: 'ok',
          LOCAL_ENV_VAR: 'ok',
          SHARED_ENV_VAR: 'ok',
        });
      });

      test("throws if any of the given files doesn't exist", () => {
        expect(() =>
          dotenvify.parse(
            [
              '/path/to/project/.env',
              '/path/to/project/.env-non-existent',
              '/path/to/project/.env.local',
            ],
            { silent: true }
          )
        ).toThrow("ENOENT: no such file or directory, open '/path/to/project/.env-non-existent'");
      });
    });

    describe('when `options.encoding` is given', () => {
      beforeEach(() => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
        });
      });

      test('provides the given `options.encoding` to `fs.readFileSync()`', () => {
        dotenvify.parse('/path/to/project/.env', {
          encoding: 'base64',
        });

        expect($fs_readFileSync).toHaveBeenCalledWith('/path/to/project/.env', {
          encoding: 'base64',
        });

        dotenvify.parse(['/path/to/project/.env', '/path/to/project/.env.local'], {
          encoding: 'base64',
        });

        expect($fs_readFileSync).toHaveBeenCalledWith('/path/to/project/.env.local', {
          encoding: 'base64',
        });
      });
    });
  });

  describe('.load', () => {
    beforeEach(() => {
      mockFS({
        '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
        '/path/to/project/.env.development': 'DEVELOPMENT_ENV_VAR=ok',
      });
    });

    beforeEach(() => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('loads environment variables from the given files into `process.env`', () => {
      expect(process.env).not.toHaveProperty('DEFAULT_ENV_VAR');
      expect(process.env).not.toHaveProperty('DEVELOPMENT_ENV_VAR');

      dotenvify.load(['/path/to/project/.env', '/path/to/project/.env.development']);

      expect(process.env).toHaveProperty('DEFAULT_ENV_VAR', 'ok');
      expect(process.env).toHaveProperty('DEVELOPMENT_ENV_VAR', 'ok');
    });

    test('returns cumulative parsed contents of the given files within the `.parsed` property', () => {
      const result = dotenvify.load(['/path/to/project/.env', '/path/to/project/.env.development']);

      expect(result).toEqual({
        parsed: {
          DEFAULT_ENV_VAR: 'ok',
          DEVELOPMENT_ENV_VAR: 'ok',
        },
      });
    });

    test("doesn't overwrite predefined environment variables", () => {
      process.env.DEFAULT_ENV_VAR = 'predefined';

      dotenvify.load(['/path/to/project/.env', '/path/to/project/.env.development']);

      expect(process.env).toHaveProperty('DEFAULT_ENV_VAR', 'predefined');
      expect(process.env).toHaveProperty('DEVELOPMENT_ENV_VAR', 'ok');
    });

    describe('when `options.encoding` is given', () => {
      let options;

      beforeEach(() => {
        options = { encoding: 'base64' };
      });

      test('provides the given `options.encoding` to `fs.readFileSync()`', () => {
        dotenvify.load(['/path/to/project/.env', '/path/to/project/.env.development'], options);

        expect($fs_readFileSync).toHaveBeenCalledWith('/path/to/project/.env', {
          encoding: 'base64',
        });

        expect($fs_readFileSync).toHaveBeenCalledWith('/path/to/project/.env.development', {
          encoding: 'base64',
        });
      });
    });

    describe('if parsing is failed', () => {
      beforeEach(() => {
        $fs_readFileSync.mockImplementation((filename, options) => {
          if (filename === '/path/to/project/.env.local') {
            throw new Error('`.env.local` file reading error stub');
          }
          return $dotenvFiles[filename];
        });
      });

      let filenames;

      beforeEach(() => {
        filenames = [
          '/path/to/project/.env',
          '/path/to/project/.env.local', // << the mocked error filename
          '/path/to/project/.env.development',
        ];
      });

      test('leaves `process.env` untouched (does not assign any variables)', () => {
        const processEnvCopy = { ...process.env };

        dotenvify.load(filenames);

        expect(process.env).toEqual(processEnvCopy);
      });

      test('returns the occurred error within the `.error` property', () => {
        const result = dotenvify.load(filenames);

        expect(result).toEqual({
          error: expect.any(Error),
        });
        expect(result.error.message).toEqual(
          expect.stringContaining('`.env.local` file reading error stub')
        );
      });

      test('warns about the occurred error', () => {
        dotenvify.load(filenames);

        const calls = console.warn.mock.calls.flat();

        expect(calls).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/dotenvify\b.*`\.env\.local` file reading error stub/),
          ])
        );
      });

      test("doesn't warn when suppressed by `options.silent`", () => {
        dotenvify.load(filenames, { silent: true });

        expect(console.warn).toHaveBeenCalledTimes(0);
      });
    });
  });

  describe('.unload', () => {
    beforeEach(() => {
      mockFS({
        '/path/to/project/.env': 'DEFAULT_ENV_VAR="defined by `.env`"',
      });
    });

    test('cleanups `process.env` from the environment variables defined in a given file', () => {
      process.env.DEFAULT_ENV_VAR = 'defined by `.env`';

      dotenvify.unload('/path/to/project/.env');

      expect(process.env).not.toHaveProperty('DEFAULT_ENV_VAR');
    });

    test("doesn't touch the other environment variables", () => {
      process.env.ENV_VAR = 'defined by the environment';
      process.env.DEFAULT_ENV_VAR = 'defined by `.env`';

      dotenvify.unload('/path/to/project/.env');

      expect(process.env).not.toHaveProperty('DEFAULT_ENV_VAR');

      expect(process.env).toHaveProperty('ENV_VAR', 'defined by the environment');
    });

    describe('when `options.encoding` is given', () => {
      let options;

      beforeEach(() => {
        options = { encoding: 'base64' };
      });

      test('provides the given `options.encoding` to `fs.readFileSync()`', () => {
        dotenvify.unload('/path/to/project/.env', options);

        expect($fs_readFileSync).toHaveBeenCalledWith('/path/to/project/.env', {
          encoding: 'base64',
        });
      });
    });
  });

  describe('.config', () => {
    describe('by default (when no options are given)', () => {
      test('loads the default `.env` file', () => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
        });

        expect(process.env).not.toHaveProperty('DEFAULT_ENV_VAR');

        dotenvify.config();

        expect(process.env).toHaveProperty('DEFAULT_ENV_VAR', 'ok');
      });

      test('loads the `.env.local` file', () => {
        mockFS({
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
        });

        expect(process.env).not.toHaveProperty('LOCAL_ENV_VAR');

        dotenvify.config({ node_env: 'production' });

        expect(process.env).toMatchObject({
          LOCAL_ENV_VAR: 'ok',
        });
      });

      test("merges the parsed files' contents", () => {
        mockFS({
          '/path/to/project/.env':
            'DEFAULT_ENV_VAR=ok\n' + 'SHARED_ENV_VAR="should be overwritten by `.env.local`"',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok\n' + 'SHARED_ENV_VAR=ok',
        });

        expect(process.env).not.toHaveProperty([
          'DEFAULT_ENV_VAR',
          'LOCAL_ENV_VAR',
          'SHARED_ENV_VAR',
        ]);

        dotenvify.config({ node_env: 'production' });

        expect(process.env).toMatchObject({
          DEFAULT_ENV_VAR: 'ok',
          LOCAL_ENV_VAR: 'ok',
          SHARED_ENV_VAR: 'ok',
        });
      });

      test('returns the merged contents of the files within the `.parsed` property', () => {
        mockFS({
          '/path/to/project/.env':
            'DEFAULT_ENV_VAR=ok\n' + 'SHARED_ENV_VAR="should be overwritten by `.env.local`"',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok\n' + 'SHARED_ENV_VAR=ok',
        });

        const result = dotenvify.config({ node_env: 'production' });

        expect(result).toMatchObject({
          parsed: {
            DEFAULT_ENV_VAR: 'ok',
            LOCAL_ENV_VAR: 'ok',
            SHARED_ENV_VAR: 'ok',
          },
        });
      });
    });

    describe('when the `NODE_ENV` environment variable is present', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
      });

      test('loads the default `.env` file', () => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
        });

        expect(process.env).not.toHaveProperty('DEFAULT_ENV_VAR');

        dotenvify.config();

        expect(process.env).toHaveProperty('DEFAULT_ENV_VAR', 'ok');
      });

      test('loads the `.env.local` file', () => {
        mockFS({
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
        });

        expect(process.env).not.toHaveProperty('LOCAL_ENV_VAR');

        dotenvify.config();

        expect(process.env).toHaveProperty('LOCAL_ENV_VAR', 'ok');
      });

      test('loads the "node_env-specific" env file', () => {
        mockFS({
          '/path/to/project/.env.development': 'DEVELOPMENT_ENV_VAR=ok',
        });

        expect(process.env).not.toHaveProperty('DEVELOPMENT_ENV_VAR');

        dotenvify.config();

        expect(process.env).toHaveProperty('DEVELOPMENT_ENV_VAR', 'ok');
      });

      test('loads the "node_env-specific" local env file', () => {
        mockFS({
          '/path/to/project/.env.development.local': 'DEVELOPMENT_LOCAL_ENV_VAR=ok',
        });

        expect(process.env).not.toHaveProperty('DEVELOPMENT_LOCAL_ENV_VAR');

        dotenvify.config();

        expect(process.env).toHaveProperty('DEVELOPMENT_LOCAL_ENV_VAR', 'ok');
      });

      test("merges the parsed files' contents", () => {
        mockFS({
          '/path/to/project/.env':
            'DEFAULT_ENV_VAR=ok\n' + 'SHARED_ENV_VAR="should be overwritten by `.env.local`"',

          '/path/to/project/.env.local':
            'LOCAL_ENV_VAR=ok\n' + 'SHARED_ENV_VAR="should be overwritten by `.env.development`"',

          '/path/to/project/.env.development':
            'DEVELOPMENT_ENV_VAR=ok\n' +
            'SHARED_ENV_VAR="should be overwritten by `.env.development.local`"',

          '/path/to/project/.env.development.local':
            'LOCAL_DEVELOPMENT_ENV_VAR=ok\n' + 'SHARED_ENV_VAR=ok',
        });

        expect(process.env).not.toHaveProperty([
          'DEFAULT_ENV_VAR',
          'LOCAL_ENV_VAR',
          'DEVELOPMENT_ENV_VAR',
          'LOCAL_DEVELOPMENT_ENV_VAR',
          'SHARED_ENV_VAR',
        ]);

        dotenvify.config();

        expect(process.env).toMatchObject({
          DEFAULT_ENV_VAR: 'ok',
          LOCAL_ENV_VAR: 'ok',
          DEVELOPMENT_ENV_VAR: 'ok',
          LOCAL_DEVELOPMENT_ENV_VAR: 'ok',
          SHARED_ENV_VAR: 'ok',
        });
      });

      test('returns the merged contents of the files within the `.parsed` property', () => {
        mockFS({
          '/path/to/project/.env':
            'DEFAULT_ENV_VAR=ok\n' + 'SHARED_ENV_VAR="should be overwritten by `.env.local`"',

          '/path/to/project/.env.local':
            'LOCAL_ENV_VAR=ok\n' + 'SHARED_ENV_VAR="should be overwritten by `.env.development`"',

          '/path/to/project/.env.development':
            'DEVELOPMENT_ENV_VAR=ok\n' +
            'SHARED_ENV_VAR="should be overwritten by `.env.development.local`"',

          '/path/to/project/.env.development.local':
            'LOCAL_DEVELOPMENT_ENV_VAR=ok\n' + 'SHARED_ENV_VAR=ok',
        });

        const result = dotenvify.config();

        expect(result).toEqual({
          parsed: {
            DEFAULT_ENV_VAR: 'ok',
            LOCAL_ENV_VAR: 'ok',
            DEVELOPMENT_ENV_VAR: 'ok',
            LOCAL_DEVELOPMENT_ENV_VAR: 'ok',
            SHARED_ENV_VAR: 'ok',
          },
        });
      });
    });

    describe('when `options.node_env` is given', () => {
      let options;

      beforeEach(() => {
        options = { node_env: 'production' };
      });

      test('uses the given `options.node_env` instead of `NODE_ENV`', () => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
          '/path/to/project/.env.production': 'PRODUCTION_ENV_VAR=ok',
          '/path/to/project/.env.production.local': 'LOCAL_PRODUCTION_ENV_VAR=ok',
        });

        process.env.NODE_ENV = 'development';

        expect(process.env).not.toHaveProperty([
          'DEFAULT_ENV_VAR',
          'LOCAL_ENV_VAR',
          'PRODUCTION_ENV_VAR',
          'LOCAL_PRODUCTION_ENV_VAR',
        ]);

        const result = dotenvify.config({ ...options });

        expect(result).toMatchObject({
          parsed: {
            DEFAULT_ENV_VAR: 'ok',
            LOCAL_ENV_VAR: 'ok',
            PRODUCTION_ENV_VAR: 'ok',
            LOCAL_PRODUCTION_ENV_VAR: 'ok',
          },
        });

        expect(process.env).toMatchObject({
          DEFAULT_ENV_VAR: 'ok',
          LOCAL_ENV_VAR: 'ok',
          PRODUCTION_ENV_VAR: 'ok',
          LOCAL_PRODUCTION_ENV_VAR: 'ok',
        });
      });
    });

    describe('when `options.default_node_env` is given', () => {
      let options;

      beforeEach(() => {
        options = { default_node_env: 'development' };
      });

      test('uses the given environment as default', () => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
          '/path/to/project/.env.development': 'DEVELOPMENT_ENV_VAR=ok',
          '/path/to/project/.env.development.local': 'LOCAL_DEVELOPMENT_ENV_VAR=ok',
        });

        expect(process.env).not.toHaveProperty([
          'DEFAULT_ENV_VAR',
          'LOCAL_ENV_VAR',
          'DEVELOPMENT_ENV_VAR',
          'LOCAL_DEVELOPMENT_ENV_VAR',
        ]);

        delete process.env.NODE_ENV;
        const result = dotenvify.config({ ...options });

        expect(result).toMatchObject({
          parsed: {
            DEFAULT_ENV_VAR: 'ok',
            LOCAL_ENV_VAR: 'ok',
            DEVELOPMENT_ENV_VAR: 'ok',
            LOCAL_DEVELOPMENT_ENV_VAR: 'ok',
          },
        });

        expect(process.env).toMatchObject({
          DEFAULT_ENV_VAR: 'ok',
          LOCAL_ENV_VAR: 'ok',
          DEVELOPMENT_ENV_VAR: 'ok',
          LOCAL_DEVELOPMENT_ENV_VAR: 'ok',
        });
      });

      test('prioritizes the `NODE_ENV` environment variable if present', () => {
        mockFS({
          '/path/to/project/.env.development': 'DEVELOPMENT_ENV_VAR="should not be loaded"',
          '/path/to/project/.env.production': 'PRODUCTION_ENV_VAR=ok',
        });

        process.env.NODE_ENV = 'production';

        expect(process.env).not.toHaveProperty(['DEVELOPMENT_ENV_VAR', 'PRODUCTION_ENV_VAR']);

        dotenvify.config({ ...options });

        expect(process.env).toHaveProperty('PRODUCTION_ENV_VAR', 'ok');
      });

      test('prioritizes `options.node_env` if given', () => {
        mockFS({
          '/path/to/project/.env.development': 'DEVELOPMENT_ENV_VAR="should not be loaded"',
          '/path/to/project/.env.production': 'PRODUCTION_ENV_VAR=ok',
        });

        options.node_env = 'production';

        expect(process.env).not.toHaveProperty(['DEVELOPMENT_ENV_VAR', 'PRODUCTION_ENV_VAR']);

        dotenvify.config({ ...options });

        expect(process.env).toHaveProperty('PRODUCTION_ENV_VAR', 'ok');
      });
    });

    describe('when `options.path` is given', () => {
      let options;

      beforeEach(() => {
        options = { path: '/path/to/another/project' };
      });

      test('uses the given `options.path` as a working directory', () => {
        mockFS({
          '/path/to/another/project/.env': 'DEFAULT_ENV_VAR=ok',
          '/path/to/another/project/.env.local': 'LOCAL_ENV_VAR=ok',
        });

        expect(process.env).not.toHaveProperty(['DEFAULT_ENV_VAR', 'LOCAL_ENV_VAR']);

        dotenvify.config({ ...options, node_env: 'production' });

        expect(process.env).toMatchObject({
          DEFAULT_ENV_VAR: 'ok',
          LOCAL_ENV_VAR: 'ok',
        });
      });
    });

    describe('when `options.pattern` is given', () => {
      let options;

      beforeEach(() => {
        options = { pattern: '.env/[local/]env[.node_env]' };
      });

      test('reads files by the given `.env*` files naming convention', () => {
        mockFS({
          '/path/to/project/.env/env': 'DEFAULT_ENV_VAR=ok',
          '/path/to/project/.env/env.development': 'DEVELOPMENT_ENV_VAR=ok',
          '/path/to/project/.env/local/env': 'LOCAL_ENV_VAR=ok',
          '/path/to/project/.env/local/env.development': 'LOCAL_DEVELOPMENT_ENV_VAR=ok',
        });

        process.env.NODE_ENV = 'development';

        expect(process.env).not.toHaveProperty([
          'DEFAULT_ENV_VAR',
          'LOCAL_ENV_VAR',
          'DEVELOPMENT_ENV_VAR',
          'LOCAL_DEVELOPMENT_ENV_VAR',
        ]);

        dotenvify.config({ ...options });

        expect(process.env).toMatchObject({
          DEFAULT_ENV_VAR: 'ok',
          DEVELOPMENT_ENV_VAR: 'ok',
          LOCAL_ENV_VAR: 'ok',
          LOCAL_DEVELOPMENT_ENV_VAR: 'ok',
        });
      });
    });

    describe('when `options.files` is given', () => {
      let options;

      beforeEach(() => {
        options = {
          files: ['.env', '.env.production', '.env.local'],
        };
      });

      test('loads the given list of files', () => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
          '/path/to/project/.env.production': 'PRODUCTION_ENV_VAR=ok',
          '/path/to/project/.env.production.local': 'LOCAL_PRODUCTION_ENV_VAR=ok',
        });

        expect(process.env).not.toHaveProperty([
          'DEFAULT_ENV_VAR',
          'PRODUCTION_ENV_VAR',
          'LOCAL_ENV_VAR',
          'LOCAL_PRODUCTION_ENV_VAR',
        ]);

        const result = dotenvify.config({ ...options });

        expect(result).toMatchObject({
          parsed: {
            DEFAULT_ENV_VAR: 'ok',
            PRODUCTION_ENV_VAR: 'ok',
            LOCAL_ENV_VAR: 'ok',
          },
        });

        expect(process.env).toMatchObject({
          DEFAULT_ENV_VAR: 'ok',
          PRODUCTION_ENV_VAR: 'ok',
          LOCAL_ENV_VAR: 'ok',
        });

        expect(process.env).not.toHaveProperty('LOCAL_PRODUCTION_ENV_VAR');
      });

      test('ignores `options.node_env`', () => {
        options.node_env = 'development';

        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
          '/path/to/project/.env.development': 'DEVELOPMENT_ENV_VAR=ok',
          '/path/to/project/.env.production': 'PRODUCTION_ENV_VAR=ok',
        });

        expect(process.env).not.toHaveProperty([
          'DEFAULT_ENV_VAR',
          'DEVELOPMENT_ENV_VAR',
          'PRODUCTION_ENV_VAR',
          'LOCAL_ENV_VAR',
        ]);

        const result = dotenvify.config({ ...options });

        expect(result).toMatchObject({
          parsed: {
            DEFAULT_ENV_VAR: 'ok',
            PRODUCTION_ENV_VAR: 'ok',
            LOCAL_ENV_VAR: 'ok',
          },
        });

        expect(process.env).toMatchObject({
          DEFAULT_ENV_VAR: 'ok',
          PRODUCTION_ENV_VAR: 'ok',
          LOCAL_ENV_VAR: 'ok',
        });

        expect(process.env).not.toHaveProperty('DEVELOPMENT_ENV_VAR');
      });

      test('loads the list of files in the given order', () => {
        mockFS({
          '/path/to/project/.env':
            'DEFAULT_ENV_VAR=ok\n' +
            'PRODUCTION_ENV_VAR="should be overwritten by `.env.production"`',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
          '/path/to/project/.env.production':
            'LOCAL_ENV_VAR="should be overwritten by `.env.local"`\n' + 'PRODUCTION_ENV_VAR=ok',
        });

        expect(process.env).not.toHaveProperty([
          'DEFAULT_ENV_VAR',
          'PRODUCTION_ENV_VAR',
          'LOCAL_ENV_VAR',
        ]);

        const result = dotenvify.config({ ...options });

        expect(result).toMatchObject({
          parsed: {
            DEFAULT_ENV_VAR: 'ok',
            PRODUCTION_ENV_VAR: 'ok',
            LOCAL_ENV_VAR: 'ok',
          },
        });

        expect(process.env).toMatchObject({
          DEFAULT_ENV_VAR: 'ok',
          PRODUCTION_ENV_VAR: 'ok',
          LOCAL_ENV_VAR: 'ok',
        });
      });

      test('ignores missing files', () => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
        });

        expect(process.env).not.toHaveProperty([
          'DEFAULT_ENV_VAR',
          'PRODUCTION_ENV_VAR',
          'LOCAL_ENV_VAR',
        ]);

        const result = dotenvify.config({ ...options });

        expect(result).toMatchObject({
          parsed: {
            DEFAULT_ENV_VAR: 'ok',
          },
        });

        expect(process.env).toMatchObject({
          DEFAULT_ENV_VAR: 'ok',
        });

        expect(process.env).not.toHaveProperty('PRODUCTION_ENV_VAR');
        expect(process.env).not.toHaveProperty('LOCAL_ENV_VAR');
      });

      describe('… and `options.path` is given', () => {
        beforeEach(() => {
          options.path = '/path/to/another/project';
        });

        test('uses the given `options.path` as a working directory', () => {
          mockFS({
            '/path/to/another/project/.env': 'DEFAULT_ENV_VAR=ok',
            '/path/to/another/project/.env.production': 'PRODUCTION_ENV_VAR=ok',
            '/path/to/another/project/.env.local': 'LOCAL_ENV_VAR=ok',
          });

          expect(process.env).not.toHaveProperty([
            'DEFAULT_ENV_VAR',
            'PRODUCTION_ENV_VAR',
            'LOCAL_ENV_VAR',
          ]);

          const result = dotenvify.config({ ...options });

          expect(result).toMatchObject({
            parsed: {
              DEFAULT_ENV_VAR: 'ok',
              PRODUCTION_ENV_VAR: 'ok',
              LOCAL_ENV_VAR: 'ok',
            },
          });

          expect(process.env).toMatchObject({
            DEFAULT_ENV_VAR: 'ok',
            PRODUCTION_ENV_VAR: 'ok',
            LOCAL_ENV_VAR: 'ok',
          });
        });
      });
    });

    describe('when `options.encoding` is given', () => {
      let options;

      beforeEach(() => {
        options = { encoding: 'base64', node_env: 'production' };
      });

      test('provides the given `options.encoding` to `fs.readFileSync()`', () => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
        });

        expect(process.env).not.toHaveProperty(['DEFAULT_ENV_VAR', 'LOCAL_ENV_VAR']);

        dotenvify.config({ ...options });

        expect($fs_readFileSync).toHaveBeenCalledWith('/path/to/project/.env', {
          encoding: 'base64',
        });

        expect($fs_readFileSync).toHaveBeenCalledWith('/path/to/project/.env.local', {
          encoding: 'base64',
        });
      });
    });

    describe('when `options.purge_dotenv` is enabled', () => {
      let options;

      beforeEach(() => {
        options = { purge_dotenv: true, node_env: 'production' };
      });

      beforeEach(() => {
        mockFS({
          '/path/to/project/.env':
            'DEFAULT_ENV_VAR=ok\n' + 'SHARED_ENV_VAR="should be overwritten by `.env.local`"',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok\n' + 'SHARED_ENV_VAR=ok',
        });
      });

      test('fixes the "preloaded `.env` file" issue', () => {
        process.env.DEFAULT_ENV_VAR = 'ok';
        process.env.SHARED_ENV_VAR = 'should be overwritten by `.env.local`';

        dotenvify.config({ ...options });

        expect(process.env).toMatchObject({
          DEFAULT_ENV_VAR: 'ok',
          LOCAL_ENV_VAR: 'ok',
          SHARED_ENV_VAR: 'ok',
        });
      });

      test('provides `options.encoding` to `fs.readFileSync()` if given', () => {
        options.encoding = 'base64';

        dotenvify.config({ ...options });

        expect($fs_readFileSync.mock.calls[0][1]).toEqual({
          encoding: 'base64',
        });

        expect($fs_readFileSync.mock.calls[1][1]).toEqual({
          encoding: 'base64',
        });
      });

      test("doesn't fail if the default `.env` file is not present", () => {
        delete $dotenvFiles['/path/to/project/.env'];

        dotenvify.config({ ...options });

        expect(process.env).toMatchObject({
          LOCAL_ENV_VAR: 'ok',
          SHARED_ENV_VAR: 'ok',
        });

        expect(process.env).not.toHaveProperty('DEFAULT_ENV_VAR');
      });
    });

    describe('when `options.debug` is enabled', () => {
      let options;

      beforeEach(() => {
        options = { debug: true };
      });

      beforeEach(() => {
        jest.spyOn(console, 'debug').mockImplementation(() => {});
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      beforeEach(() => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
        });
      });

      test('prints out initialization options [0]', () => {
        dotenvify.config({ ...options });

        const calls = console.debug.mock.calls.flat();

        expect(calls).toEqual(expect.arrayContaining([expect.stringMatching(/dotenvify\b.*init/)]));
      });

      test('prints out initialization options [1]', () => {
        dotenvify.config({
          ...options,
          node_env: 'development',
        });

        const calls = console.debug.mock.calls.flat();

        expect(calls).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/dotenvify\b.*init/),
            expect.stringMatching(/options\.node_env/),
          ])
        );
      });

      test('prints out initialization options [2]', () => {
        dotenvify.config({
          ...options,
          node_env: 'production',
          default_node_env: 'development',
        });

        const calls = console.debug.mock.calls.flat();

        expect(calls).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/dotenvify\b.*init/),
            expect.stringMatching(/options\.node_env/),
            expect.stringMatching(/options\.default_node_env/),
          ])
        );
      });

      test('prints out initialization options [3]', () => {
        process.env.NODE_ENV = 'test';

        dotenvify.config({
          ...options,
          node_env: 'production',
          default_node_env: 'development',
          path: '/path/to/project',
          pattern: '.env[.node_env][.local]',
          encoding: 'utf8',
          purge_dotenv: false,
          silent: false,
        });

        const calls = console.debug.mock.calls.flat();

        expect(calls).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/dotenvify\b.*init/),
            expect.stringMatching(/options\.node_env/),
            expect.stringMatching(/options\.default_node_env/),
            expect.stringMatching(/options\.path/),
            expect.stringMatching(/options\.pattern/),
            expect.stringMatching(/options\.encoding/),
            expect.stringMatching(/options\.purge_dotenv/),
            expect.stringMatching(/options\.silent/),
          ])
        );
      });

      test('prints out initialization options [4]', () => {
        dotenvify.config({
          ...options,
          path: '/path/to/another/project',
          files: ['.env', '.env.production', '.env.local'],
        });

        const calls = console.debug.mock.calls;

        expect(calls.flat()).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/dotenvify\b.*init/),
            expect.stringMatching(/options\.path/),
            expect.stringMatching(/options\.files/),
          ])
        );
      });

      test('prints out effective node_env set by `options.node_env`', () => {
        dotenvify.config({
          ...options,
          node_env: 'production',
        });

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(
            /dotenvify\b.*operating in "production" environment.*`options\.node_env`/
          )
        );
      });

      test('prints out effective node_env set by `process.env.NODE_ENV`', () => {
        process.env.NODE_ENV = 'test';

        dotenvify.config({ ...options });

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(
            /dotenvify\b.*operating in "test" environment.*`process\.env\.NODE_ENV`/
          )
        );
      });

      test('prints out effective node_env taken from `options.default_node_env`', () => {
        delete process.env.NODE_ENV;
        dotenvify.config({
          ...options,
          default_node_env: 'development',
        });

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(
            /dotenvify\b.*operating in "development" environment.*`options\.default_node_env`/
          )
        );
      });

      test('notifies about operating in "no environment" mode when none of the related options is set', () => {
        delete process.env.NODE_ENV;
        dotenvify.config({ ...options });

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/dotenvify\b.*operating in "no environment" mode/)
        );
      });

      test('prints out the list of effective `.env*` files', () => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
          '/path/to/project/.env.development': 'DEVELOPMENT_ENV_VAR=ok',
          '/path/to/project/.env.development.local': 'LOCAL_DEVELOPMENT_ENV_VAR=ok',
        });

        dotenvify.config({
          ...options,
          node_env: 'development',
        });

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/dotenvify\b.*>> %s/),
          expect.stringMatching(/^\/path\/to\/project\/\.env$/)
        );

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/dotenvify\b.*>> %s/),
          expect.stringMatching(/^\/path\/to\/project\/\.env\.local$/)
        );

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/dotenvify\b.*>> %s/),
          expect.stringMatching(/^\/path\/to\/project\/\.env\.development$/)
        );

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/dotenvify\b.*>> %s/),
          expect.stringMatching(/^\/path\/to\/project\/\.env\.development\.local$/)
        );
      });

      test('prints out parsing files', () => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
          '/path/to/project/.env.development': 'DEVELOPMENT_ENV_VAR=ok',
          '/path/to/project/.env.development.local': 'LOCAL_DEVELOPMENT_ENV_VAR=ok',
        });

        dotenvify.config({
          ...options,
          node_env: 'development',
        });

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/dotenvify\b.*parsing.*%s/),
          expect.stringMatching(/^\/path\/to\/project\/\.env$/)
        );

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/dotenvify\b.*parsing.*%s/),
          expect.stringMatching(/^\/path\/to\/project\/\.env\.local$/)
        );

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/dotenvify\b.*parsing.*%s/),
          expect.stringMatching(/^\/path\/to\/project\/\.env\.development$/)
        );

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/dotenvify\b.*parsing.*%s/),
          expect.stringMatching(/^\/path\/to\/project\/\.env\.development\.local$/)
        );
      });

      test('prints out parsed environment variables', () => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
          '/path/to/project/.env.development': 'DEVELOPMENT_ENV_VAR=ok',
          '/path/to/project/.env.development.local': 'LOCAL_DEVELOPMENT_ENV_VAR=ok',
        });

        dotenvify.config({
          ...options,
          node_env: 'development',
        });

        const debugCalls = console.debug.mock.calls.flat();

        expect(debugCalls).toEqual(
          expect.arrayContaining([
            expect.stringContaining('DEFAULT_ENV_VAR'),
            expect.stringContaining('LOCAL_ENV_VAR'),
            expect.stringContaining('DEVELOPMENT_ENV_VAR'),
            expect.stringContaining('LOCAL_DEVELOPMENT_ENV_VAR'),
          ])
        );
      });

      test('prints out environment variables assigned to `process.env`', () => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
          '/path/to/project/.env.development': 'DEVELOPMENT_ENV_VAR=ok',
          '/path/to/project/.env.development.local': 'LOCAL_DEVELOPMENT_ENV_VAR=ok',
        });

        dotenvify.config({
          ...options,
          node_env: 'development',
        });

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/dotenvify\b.*merging.*variables.*`process.env`/)
        );

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/dotenvify\b.*>> process\.env\.%s/),
          'DEFAULT_ENV_VAR'
        );

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/dotenvify\b.*>> process\.env\.%s/),
          'LOCAL_ENV_VAR'
        );

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/dotenvify\b.*>> process\.env\.%s/),
          'DEVELOPMENT_ENV_VAR'
        );

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/dotenvify\b.*>> process\.env\.%s/),
          'LOCAL_DEVELOPMENT_ENV_VAR'
        );
      });

      test('informs when merging with overwrites', () => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok\n' + 'SHARED_ENV_VAR=1',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok\n' + 'SHARED_ENV_VAR=2',
          '/path/to/project/.env.development': 'DEVELOPMENT_ENV_VAR=ok\n' + 'SHARED_ENV_VAR=3',
          '/path/to/project/.env.development.local':
            'LOCAL_DEVELOPMENT_ENV_VAR=ok\n' + 'SHARED_ENV_VAR=4',
        });

        dotenvify.config({
          ...options,
          node_env: 'development',
        });

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/dotenvify\b.*%s.*overwritten by.*%s/),
          'SHARED_ENV_VAR',
          expect.stringMatching(/^\/path\/to\/project\/\.env\.local$/)
        );

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/dotenvify\b.*%s.*overwritten by.*%s/),
          'SHARED_ENV_VAR',
          expect.stringMatching(/^\/path\/to\/project\/\.env\.development$/)
        );

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/dotenvify\b.*%s.*overwritten by.*%s/),
          'SHARED_ENV_VAR',
          expect.stringMatching(/^\/path\/to\/project\/\.env\.development\.local$/)
        );
      });

      test('informs when predefined environment variable is not being overwritten', () => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR="should be predefined"',
        });

        process.env.DEFAULT_ENV_VAR = 'predefined';

        dotenvify.config({ ...options });

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/dotenvify\b.*%s.*predefined.*not.*overwritten/),
          'DEFAULT_ENV_VAR'
        );
      });

      test('prints out the completion status', () => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
        });

        dotenvify.config({
          ...options,
          node_env: 'development',
        });

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/dotenvify\b.*initialization completed/)
        );
      });

      describe('… and `options.node_env` is set to "test"', () => {
        beforeEach(() => {
          options.node_env = 'test';
        });

        test('notifies that `.env.local` is being skipped in "test" environment', () => {
          mockFS({
            '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
            '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
            '/path/to/project/.env.test': 'TEST_ENV_VAR=ok',
            '/path/to/project/.env.test.local': 'LOCAL_TEST_ENV_VAR=ok',
          });

          dotenvify.config({ ...options });

          expect(console.debug).toHaveBeenCalledWith(
            expect.stringMatching(/dotenvify\b.*%s.*is being skipped for "test" environment/),
            '.env.local'
          );
        });

        test("doesn't spam about skipping `.env.local` if it doesn't exist", () => {
          mockFS({
            '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
            '/path/to/project/.env.test': 'TEST_ENV_VAR=ok',
            '/path/to/project/.env.test.local': 'LOCAL_TEST_ENV_VAR=ok',
          });

          dotenvify.config({ ...options, debug: false });

          expect(console.debug).not.toHaveBeenCalled();
        });
      });

      describe('… and `options.purge_dotenv` is enabled', () => {
        beforeEach(() => {
          options.purge_dotenv = true;
        });

        test('prints out the "unloading `.env` file" message', () => {
          dotenvify.config({ ...options });

          expect(console.debug).toHaveBeenCalledWith(
            expect.stringMatching(/dotenvify\b.*`options\.purge_dotenv`.*unloading.*`\.env`/)
          );
        });
      });
    });

    describe('if parsing is failed', () => {
      beforeEach(() => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
        });
      });

      beforeEach(() => {
        $fs_readFileSync.mockImplementation((filename, options) => {
          if (filename === '/path/to/project/.env.local') {
            throw new Error('`.env.local` file reading error stub');
          }
          return $dotenvFiles[filename];
        });
      });

      beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      test("doesn't load any environment variables", () => {
        const processEnvCopy = { ...process.env };

        dotenvify.config({ node_env: 'production' });

        expect(process.env).toEqual(processEnvCopy);
      });

      test('returns the occurred error in the `error` property', () => {
        const result = dotenvify.config({ node_env: 'production' });

        expect(result).toEqual({
          error: expect.any(Error),
        });
        expect(result.error.message).toEqual(
          expect.stringContaining('`.env.local` file reading error stub')
        );
      });

      test('warns about the occurred error', () => {
        delete process.env.NODE_ENV;
        dotenvify.config();

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringMatching(/dotenvify\b.*`\.env\.local` file reading error stub/),
          expect.any(Error)
        );
      });
    });

    describe('when none of the appropriate ".env*" files is present', () => {
      beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      describe('… and no "node_env-related" options are set', () => {
        test('returns "no `.env*` files" error', () => {
          const result = dotenvify.config();

          expect(result).toEqual({
            error: expect.any(Error),
          });
          expect(result.error.message).toEqual(expect.stringContaining('no ".env*" files'));
        });

        test('warns about the "no `.env*` files" error', () => {
          delete process.env.NODE_ENV;
          dotenvify.config();

          expect(console.warn).toHaveBeenCalledWith(
            expect.stringMatching(/dotenvify\b.*no "\.env\*" files/),
            expect.any(Error)
          );
        });

        describe('the returning error message', () => {
          test('indicates the working directory', () => {
            const result = dotenvify.config({ silent: true });

            expect(result).toEqual({
              error: expect.any(Error),
            });
            expect(result.error.message).toEqual(expect.stringContaining('/path/to/project'));

            const pathResult = dotenvify.config({
              silent: true,
              path: '/path/to/another/project',
            });

            expect(pathResult).toEqual({
              error: expect.any(Error),
            });
            expect(pathResult.error.message).toEqual(
              expect.stringContaining('/path/to/another/project')
            );
          });

          test('indicates the naming convention pattern', () => {
            delete process.env.NODE_ENV;
            const result = dotenvify.config();

            // The error message should contain the effective pattern (with node_env replaced if present)
            expect(result.error.message).toEqual(
              expect.stringContaining('.env[.node_env][.local]')
            );

            const patternResult = dotenvify.config({
              pattern: 'config/[local/].env[.node_env]',
            });

            expect(patternResult.error.message).toEqual(
              expect.stringContaining('config/[local/].env[.node_env]')
            );
          });
        });
      });

      describe('… and the `NODE_ENV` environment variable is present', () => {
        beforeEach(() => {
          process.env.NODE_ENV = 'development';
        });

        test('returns "no `.env*` files" error', () => {
          const result = dotenvify.config();

          expect(result).toEqual({
            error: expect.any(Error),
          });
          expect(result.error.message).toEqual(expect.stringContaining('no ".env*" files'));
        });

        test('warns about the "no `.env*` files" error', () => {
          dotenvify.config();

          expect(console.warn).toHaveBeenCalledWith(
            expect.stringMatching(/dotenvify\b.*no "\.env\*" files/),
            expect.any(Error)
          );
        });

        describe('the returning error message', () => {
          test('indicates the working directory', () => {
            const result = dotenvify.config();

            expect(result.error).toBeInstanceOf(Error);
            expect(result.error).toHaveProperty('message');
            expect(result.error.message).toEqual(expect.stringContaining('/path/to/project'));

            const pathResult = dotenvify.config({
              path: '/path/to/another/project',
            });

            expect(pathResult.error).toBeInstanceOf(Error);
            expect(pathResult.error).toHaveProperty('message');
            expect(pathResult.error.message).toEqual(
              expect.stringContaining('/path/to/another/project')
            );
          });

          test('indicates the naming convention pattern for the specified node_env', () => {
            const result = dotenvify.config({ node_env: 'development' });

            expect(result.error).toBeInstanceOf(Error);
            expect(result.error).toHaveProperty('message');
            expect(result.error.message).toEqual(
              expect.stringContaining('.env[.development][.local]')
            );

            const patternResult = dotenvify.config({
              pattern: 'config/[local/].env[.node_env]',
              node_env: 'development',
            });

            expect(patternResult.error).toBeInstanceOf(Error);
            expect(patternResult.error).toHaveProperty('message');
            expect(patternResult.error.message).toEqual(
              expect.stringContaining('config/[local/].env[.development]')
            );
          });
        });
      });
    });

    describe('when `options.silent` is enabled', () => {
      let options;

      beforeEach(() => {
        options = { silent: true };
      });

      beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      test("doesn't warn if parsing is failed", () => {
        mockFS({
          '/path/to/project/.env': 'DEFAULT_ENV_VAR=ok',
          '/path/to/project/.env.local': 'LOCAL_ENV_VAR=ok',
        });

        // Override `.readFileSync` for specific file to throw
        $fs_readFileSync.mockImplementation(filename => {
          if (filename === '/path/to/project/.env.local') {
            throw new Error('`.env.local` file reading error stub');
          }
          return $dotenvFiles[filename];
        });

        const result = dotenvify.config({ ...options, node_env: 'production' });

        expect(console.warn).not.toHaveBeenCalled();

        expect(result.error).toBeInstanceOf(Error);
        expect(result.error).toHaveProperty('message', '`.env.local` file reading error stub');
      });

      test("doesn't warn about missing `.env*` files", () => {
        const result = dotenvify.config({ ...options });

        expect(console.warn).not.toHaveBeenCalled();

        expect(result.error).toBeInstanceOf(Error);
        expect(result.error).toHaveProperty('message');
        expect(result.error.message).toMatch(/no "\.env\*" files/);
      });
    });
  });
});
