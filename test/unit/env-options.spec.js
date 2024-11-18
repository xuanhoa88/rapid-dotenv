const { expect } = require("chai");
const env_options = require("../../src/env-options");

describe("env_options", () => {
  it("maps related environment variables to options", () => {
    expect(
      env_options({
        NODE_ENV: "production",
        DEFAULT_NODE_ENV: "development",
        ENVIFY_PATH: "/path/to/project",
        ENVIFY_PATTERN: "config/[local/].env[.node_env]",
        ENVIFY_ENCODING: "latin1",
        ENVIFY_PURGE_DOTENV: "yes",
        ENVIFY_DEBUG: "enabled",
        ENVIFY_SILENT: "true",
      })
    ).to.deep.equal({
      node_env: "production",
      default_node_env: "development",
      path: "/path/to/project",
      pattern: "config/[local/].env[.node_env]",
      encoding: "latin1",
      purge_dotenv: "yes",
      debug: "enabled",
      silent: "true",
    });
  });

  it("doesn't include undefined environment variables", () => {
    expect(
      env_options({
        DEFAULT_NODE_ENV: "development",
        ENVIFY_ENCODING: "latin1",
      })
    ).to.have.keys(["default_node_env", "encoding"]);
  });

  it("ignores unrelated environment variables", () => {
    expect(env_options({ PATH: "/usr/local/bin" })).to.be.empty;
  });
});
