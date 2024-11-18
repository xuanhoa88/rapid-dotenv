const { expect } = require('chai');
const cli_options = require('../../src/cli-options');

describe('cli_options', () => {
  it('maps related `--switches` to options', () => {
    expect(
      cli_options([
        'node',
        '-r',
        'rapid-dotenv/config',
        '--node-env',
        'production',
        '--default-node-env',
        'development',
        '--dotenvify-path',
        '/path/to/project',
        '--dotenvify-encoding',
        'latin1',
        '--dotenvify-purge-dotenv',
        'yes',
        '--dotenvify-debug',
        'enabled',
        '--dotenvify-silent',
        'true',
      ])
    ).to.deep.equal({
      node_env: 'production',
      default_node_env: 'development',
      path: '/path/to/project',
      encoding: 'latin1',
      purge_dotenv: 'yes',
      debug: 'enabled',
      silent: 'true',
    });
  });

  it('supports `--switch=value` syntax', () => {
    expect(
      cli_options([
        'node',
        '-r',
        'rapid-dotenv/config',
        '--node-env=production',
        '--default-node-env=development',
        '--dotenvify-path=/path/to/project',
        '--dotenvify-pattern=config/[local/].env[.node_env]',
        '--dotenvify-encoding=latin1',
        '--dotenvify-purge-dotenv=yes',
        '--dotenvify-debug=enabled',
        '--dotenvify-silent=true',
      ])
    ).to.deep.equal({
      node_env: 'production',
      default_node_env: 'development',
      path: '/path/to/project',
      pattern: 'config/[local/].env[.node_env]',
      encoding: 'latin1',
      purge_dotenv: 'yes',
      debug: 'enabled',
      silent: 'true',
    });
  });

  it("doesn't include undefined switches", () => {
    expect(
      cli_options([
        'node',
        '-r',
        'rapid-dotenv/config',
        '--default-node-env',
        'development',
        '--dotenvify-encoding',
        'latin1',
      ])
    ).to.have.keys(['default_node_env', 'encoding']);
  });

  it('ignores unrelated `--switches`', () => {
    expect(cli_options(['--foo', 'bar', '--baz=qux'])).to.be.empty;
  });
});
