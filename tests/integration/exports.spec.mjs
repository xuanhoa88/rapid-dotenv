import { createRequire } from 'module';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
// Jest does not need explicit import for expect

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

describe('exports', () => {
  let _processEnvBackup;

  beforeAll(() => {
    _processEnvBackup = process.env;
  });

  beforeEach(() => {
    process.env = { ..._processEnvBackup };
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = _processEnvBackup;
  });

  beforeEach(() => {
    jest.spyOn(process, 'cwd').mockReturnValue(resolve(__dirname, 'fixtures', 'env'));
  });

  afterEach(() => {
    process.cwd.mockRestore();
  });

  describe('CommonJS', () => {
    test('should load module using require', () => {
      const dotenv = require('../../src/dotenvify'); // self-require
      expect(dotenv).toEqual(expect.objectContaining({
        listFiles: expect.any(Function),
        config: expect.any(Function),
        parse: expect.any(Function),
        load: expect.any(Function),
        unload: expect.any(Function),
      }));
    });
  });

  describe('ES Module', () => {
    const dotenvPath = resolve('./src/dotenvify.js');
    test('should load module using import', async () => {
      const dotenv = await import(dotenvPath); // self-import
      expect(dotenv).toEqual(expect.objectContaining({
        listFiles: expect.any(Function),
        config: expect.any(Function),
        parse: expect.any(Function),
        load: expect.any(Function),
        unload: expect.any(Function),
        default: expect.anything(),
      }));
    });
  });
});
