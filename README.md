# OpenCode Mobile Chat (React Native)

A frontend-only React Native chat client for connecting to your OpenCode `serve` API.

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Start the dev server

```bash
npm run start
```

3. Open in Expo Go (or press `a` / `i` for emulator)

## Gateway URL

At first launch, the app asks for your OpenCode Base URL.
Default value:

`http://127.0.0.1:4096`

For real-device testing, use your computer's LAN IP (for example `http://192.168.50.64:4096`).

Before using the app, start OpenCode server:

```bash
opencode serve --hostname 0.0.0.0 --port 4096
```

## Internationalization

The app includes built-in i18n with English and Chinese (`EN` / `ZH` toggle in the header).
English is the default language.

## API Usage (Current)

- Creates a session with `POST /session/`
- Sends prompts with `POST /session/:sessionID/prompt_async` (with fallbacks)
- Polls messages from `GET /session/:sessionID/message`
- Verifies server with `GET /global/health` when saving Base URL
