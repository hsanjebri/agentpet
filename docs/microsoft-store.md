# Publishing on the Microsoft Store

Store installs never show the "Windows protected your PC" (SmartScreen) warning, the Store keeps
the app updated, and people can find it there. Registration is free for individual developers.

The app side is ready: `npm run build:store` / the **Store package** workflow builds an `.appx`,
the Store version doesn't self-update (the Store does) and hides "Start on login", tiles are in
`build/appx/`, and the privacy policy is at `site/privacy.html`.

## 1 · Developer account (once, ~15 min + verification)

1. Go to <https://storedeveloper.microsoft.com> › **Get started** › **Individual**.
2. Sign in with a Microsoft account, fill in your details, verify your identity (ID + selfie).
   Approval can take a few hours to a few days.

## 2 · Reserve the name

1. Partner Center › **Apps and games** › **New product** › **MSIX or PWA app**.
2. Reserve a name. "Noodle" is probably taken; try for example **Noodle Desk Cat** or **AgentPet**.
3. Open the app › **Product management** › **Product identity**. Copy:

| Partner Center field | GitHub repository variable |
| --- | --- |
| Package/Identity/Name (e.g. `12345YourName.NoodleDeskCat`) | `STORE_IDENTITY_NAME` |
| Package/Identity/Publisher (`CN=…`) | `STORE_PUBLISHER` |
| Package/Properties/PublisherDisplayName | `STORE_PUBLISHER_DISPLAY_NAME` |
| the reserved name | `STORE_DISPLAY_NAME` |

4. GitHub › the repo › **Settings › Secrets and variables › Actions › Variables** › add the four.
   (They're public identity values, not secrets.)

## 3 · Build the package

GitHub › **Actions › Store package › Run workflow**. When it's done, download the
`store-package` artifact: it contains `AgentPet-Store.appx`.

## 4 · Submit

Partner Center › the app › **Start your submission**:

- **Pricing and availability:** Free, markets of your choice.
- **Properties:** category *Productivity* (or *Personalization*); privacy policy URL:
  `https://noodle-gray.vercel.app/privacy.html` (or your domain).
- **Age ratings:** answer the questionnaire (no violence, no purchases; "users can interact"
  = yes only because of Friends, which shares a pet name).
- **Packages:** upload `AgentPet-Store.appx`.
- **Store listing:** description, at least one screenshot (1366×768 or larger: a desktop with
  Noodle on it), app icon (from `build/icon.png`).
- **Submission options › Restricted capabilities:** the package declares `runFullTrust`
  (every desktop app does). Explain: "Desktop pet app built with Electron; needs full trust to
  draw its always-on-top window and run its local helpers."

Certification usually takes 1–3 days. Every later version: bump the version, run the workflow,
upload the new `.appx` in a new submission.

## Good to know

- The Store version can't run the installer's uninstall step, so Claude Code isn't disconnected
  automatically when it's removed: disconnect first in Settings › Claude Code (the hooks fail
  silently anyway if the app is gone).
- Settings live in a Store-private folder, separate from an installer copy: installing the Store
  version next to the installer version gives a fresh cat.
