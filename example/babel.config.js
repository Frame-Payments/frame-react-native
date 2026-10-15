const fs = require('fs');
const path = require('path');

function frameEnv() {
  const env = {};
  const envFile = path.join(__dirname, '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!key.startsWith('FRAME_')) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  }
  for (const key of ['FRAME_SECRET_KEY', 'FRAME_PUBLISHABLE_KEY']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return env;
}

module.exports = function (api) {
  const env = frameEnv();
  api.cache.using(() => JSON.stringify(env));
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      function inlineFrameEnv({ types: t }) {
        return {
          visitor: {
            MemberExpression(p) {
              const node = p.node;
              if (
                node.object?.type !== 'MemberExpression' ||
                node.object.object?.name !== 'process' ||
                node.object.property?.name !== 'env' ||
                node.property?.type !== 'Identifier' ||
                !Object.prototype.hasOwnProperty.call(env, node.property.name)
              ) {
                return;
              }
              p.replaceWith(t.stringLiteral(env[node.property.name]));
            },
          },
        };
      },
    ],
  };
};
