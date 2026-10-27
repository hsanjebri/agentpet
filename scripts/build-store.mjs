// Builds the Microsoft Store package (.appx) with the identity from Partner Center
// (Product identity), given as environment variables. See docs/microsoft-store.md.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const FIELDS = {
  identityName: 'STORE_IDENTITY_NAME',
  publisher: 'STORE_PUBLISHER',
  publisherDisplayName: 'STORE_PUBLISHER_DISPLAY_NAME',
  displayName: 'STORE_DISPLAY_NAME'
}

const missing = Object.values(FIELDS).filter((name) => !process.env[name])
if (missing.length) {
  console.error(`Missing ${missing.join(', ')} (see docs/microsoft-store.md).`)
  process.exit(1)
}

// run electron-builder's CLI with this Node, no shell: values like "Noodle Desk Cat" stay whole
const cli = createRequire(import.meta.url).resolve('electron-builder/cli.js')
const args = [cli, '--win', 'appx', '--publish', 'never', ...process.argv.slice(2)]
for (const [field, name] of Object.entries(FIELDS)) args.push(`-c.appx.${field}=${process.env[name]}`)

const result = spawnSync(process.execPath, args, { stdio: 'inherit' })
process.exit(result.status ?? 1)
