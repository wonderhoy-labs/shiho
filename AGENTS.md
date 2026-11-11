# AGENTS.md

Read the Wonderhoy Labs unification skill, [.claude/skills/wonderhoy-unification/SKILL.md](.claude/skills/wonderhoy-unification/SKILL.md),
before changing anything. It's the same in every Wonderhoy Labs repository. This file only adds what's particular
to Shiho.

## What Shiho is

A phone's network through the computer, from an Isolated Web App in Chrome. Shira's VPN app on the phone hands every
connection over adb; Shiho opens each one itself with Direct Sockets instead of relaying through a Wisp server. Minori's
machines and Android's Terminal (through Minori's Terminal link) come along for free. Named for Hinomori Shiho of
Leo/need.

## Layout

| Path                   | What                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `android/`             | The phone app: Shira's `LinkVpnService` with Shiho's name, socket and screen                  |
| `packages/shiho/`      | `@wonderhoy-labs/shiho`: the Direct Sockets upstream for Shira, the adb server client, Trusted Types |
| `web/`                 | The app when installed as an IWA, and the install page on GitHub Pages                        |
| `web/plugins/shiho.ts` | Version constants and the IWA manifest (`.well-known/manifest.webmanifest`)                   |
| `tools/bundle.ts`      | Signs `web/dist` into `web/dist/shiho.swbn`                                                   |

## Build, test and format

```bash
pnpm install
pnpm format && pnpm lint && pnpm typecheck && pnpm unify
pnpm --dir packages/shiho test && pnpm --filter ./web build
```

## Things to know

- **Shiho has its own phone app**, `com.wonderhoylabs.shiho` in `android/`, like Shira, Akiyama and Saki. Its VPN
  service, bridge and network stack are Shira's `shira:vpn` and `shira:tunnel` AARs (from Shira's releases, through the
  Ivy repository in `settings.gradle.kts`); the app only adds its name, socket (`localabstract:shiho`), words and
  screen. Anything the phone side needs goes into Shira's library and a Shira release, never a copy here. Its signing key
  is `~/.config/wonderhoy-labs/shiho/release.keystore` (alias `shiho`, password in `keystore-password`) and the
  `SHIHO_KEYSTORE*` secrets. Never replace it.
- **Never replace the IWA key.** It's `~/.config/wonderhoy-labs/shiho/iwa-key.pem` (Ed25519) and the `SHIHO_IWA_KEY`
  secret, and it is Shiho's address: `isolated-app://7bnazaslgp73mlrzgb7e2x3opemnthhgdnmwhjb3rfudf75pivtqaaic/`.
- **Chrome 156's IWA rules**, found the hard way:
  - Loopback and LAN sockets need the permissions policies `loopback-network`, `local-network` and
    `local-network-access` (not `direct-sockets-private`), and the person's OK in a prompt.
  - `TCPSocket.close()` throws synchronously while its streams are locked. Close by cancelling the reader and closing
    the writer.
  - Trusted Types are enforced for script URLs, so `new Worker(url)` needs `trustSameOriginScripts()` first.
- **Testing**: the IWA only runs from a signed bundle (the dev server's React preamble breaks the IWA's CSP). Start
  Chrome for Testing with `--enable-features=IsolatedWebApps,IsolatedWebAppDevMode
  --install-isolated-web-app-from-file=...` and `--remote-debugging-port`. CDP's `Browser.grantPermissions` doesn't
  apply to `isolated-app:` origins; to skip the Local Network Access prompt in a test profile, quit Chrome and add
  `"isolated-app://<id>,*": {"setting": 1}` under `profile.content_settings.exceptions` for `local_network_access`,
  `local_network` and `loopback_network` in `Default/Preferences`. Use the emulator `Minori_Test_API_37` (port 5556)
  first, and don't put the user's real phone traffic in public screenshots.
- The README's testing section is the truth. Update it with exactly what ran.

## Exceptions to the guideline

- **No wash behind the page.** `web/src/ui/styles.css` sets `.app` to the plain surface colour. The shared wash of
  primary and tertiary containers looked like a stain with Shiho's lime, and the maintainer called it out.
