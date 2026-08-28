module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Inline process.env.FRAME_* as string literals at transform time.
    // @react-native/babel-preset does NOT inline process.env on its own, so
    // App.tsx's `process.env.FRAME_PUBLISHABLE_KEY` would be undefined on-device
    // without this. metro.config.js loads example/.env into process.env before
    // Babel runs, so the values are available here. Scoped to just the two
    // FRAME_* keys via `include` so no other env vars leak into the bundle.
    [
      'transform-inline-environment-variables',
      { include: ['FRAME_PUBLISHABLE_KEY', 'FRAME_SECRET_KEY', 'FRAME_BASE_URL', 'FRAME_ACCOUNT_ID', 'FRAME_CAPABILITIES'] },
    ],
  ],
};
