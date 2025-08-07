import dotenvify, { DEFAULT_PATTERN } from '../../src/dotenvify';

dotenvify.listFiles({});
dotenvify.listFiles({ node_env: 'development' });
dotenvify.listFiles({ path: '/path/to/project' });
dotenvify.listFiles({ pattern: DEFAULT_PATTERN });
dotenvify.listFiles({ debug: true });
dotenvify.listFiles({
  node_env: 'development',
  path: '/path/to/project',
  pattern: DEFAULT_PATTERN,
  debug: true,
});

dotenvify.parse('/path/to/project/.env');
dotenvify.parse('/path/to/project/.env', {});
dotenvify.parse('/path/to/project/.env', { encoding: 'utf8' });
dotenvify.parse('/path/to/project/.env', { debug: true });
dotenvify.parse('/path/to/project/.env', {
  encoding: 'utf8',
  debug: true,
});

dotenvify.parse(['/path/to/project/.env']);
dotenvify.parse(['/path/to/project/.env'], {});
dotenvify.parse(['/path/to/project/.env'], { encoding: 'utf8' });
dotenvify.parse(['/path/to/project/.env'], { debug: true });
dotenvify.parse(['/path/to/project/.env'], {
  encoding: 'utf8',
  debug: true,
});

const parsed: { [name: string]: string } = dotenvify.parse('/path/to/project/.env');
const typed: { VARNAME: string } = dotenvify.parse('/path/to/project/.env');

// --

dotenvify.load('/path/to/project/.env');
dotenvify.load('/path/to/project/.env', {});
dotenvify.load('/path/to/project/.env', { encoding: 'utf8' });
dotenvify.load('/path/to/project/.env', { debug: true });
dotenvify.load('/path/to/project/.env', { silent: true });
dotenvify.load('/path/to/project/.env', {
  encoding: 'utf8',
  debug: true,
  silent: false,
});

dotenvify.load(['/path/to/project/.env']);
dotenvify.load(['/path/to/project/.env'], {});
dotenvify.load(['/path/to/project/.env'], { encoding: 'utf8' });
dotenvify.load(['/path/to/project/.env'], { debug: true });
dotenvify.load(['/path/to/project/.env'], { silent: true });
dotenvify.load(['/path/to/project/.env'], {
  encoding: 'utf8',
  debug: true,
  silent: false,
});

const defaultLoadResult = dotenvify.load('/path/to/project/.env');
const value1: string | undefined = defaultLoadResult.parsed?.['VARNAME'];
const error1: Error | undefined = defaultLoadResult.error;

const typedLoadResult = dotenvify.load<{ VARNAME: string }>('/path/to/project/.env');
const value2: string | undefined = typedLoadResult.parsed?.VARNAME;
const error2: Error | undefined = typedLoadResult.error;

// --

dotenvify.unload('/path/to/project/.env');
dotenvify.unload('/path/to/project/.env', {});
dotenvify.unload('/path/to/project/.env', { encoding: 'utf8' });

dotenvify.unload(['/path/to/project/.env']);
dotenvify.unload(['/path/to/project/.env'], {});
dotenvify.unload(['/path/to/project/.env'], { encoding: 'utf8' });

// --

dotenvify.config();
dotenvify.config({});
dotenvify.config({ node_env: 'production' });
dotenvify.config({ default_node_env: 'development' });
dotenvify.config({ path: '/path/to/project' });
dotenvify.config({ pattern: '.env[.node_env][.local]' });
dotenvify.config({ files: ['.env', '.env.local'] });
dotenvify.config({ encoding: 'utf8' });
dotenvify.config({ purge_dotenv: true });
dotenvify.config({ debug: true });
dotenvify.config({ silent: true });
dotenvify.config({
  node_env: 'production',
  default_node_env: 'development',
  path: '/path/to/project',
  pattern: '.env[.node_env][.local]',
  files: ['.env', '.env.local'],
  encoding: 'utf8',
  purge_dotenv: true,
  debug: true,
  silent: false,
});

const defaultConfigResult = dotenvify.config();
const value3: string | undefined = defaultConfigResult.parsed?.['VARNAME'];
const error3: Error | undefined = defaultConfigResult.error;

const typedConfigResult = dotenvify.config<{ VARNAME: string }>();
const value4: string | undefined = typedConfigResult.parsed?.VARNAME;
const error4: Error | undefined = typedConfigResult.error;
