import { readFileSync } from 'fs';
import { join } from 'path';

// The SDK_VERSION constant in src/client.ts is hardcoded (see comment there
// for why we don't import package.json directly). This test fails CI if the
// two drift, so a release `npm version` bump that forgets to update client.ts
// is caught before publish.
describe('SDK_VERSION constant', () => {
  it('matches package.json version', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));
    const clientSource = readFileSync(join(__dirname, '..', 'client.ts'), 'utf-8');
    const match = clientSource.match(/const SDK_VERSION = '([^']+)';/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe(pkg.version);
  });
});
