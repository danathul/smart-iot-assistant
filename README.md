# NEST AI

Responsive React, Vite, and TypeScript frontend for NEST AI.
The approved light theme uses mist backgrounds, white cards, teal controls, and distinct status colors.

[Figma design and prototype](https://www.figma.com/design/tG1inuztzjnfehjM9DqThk)

## Start the demo

Use Node.js 22.12+ or a current LTS release.

```sh
npm ci
npm run dev
```

On Windows PowerShell, use `npm.cmd ci` and `npm.cmd run dev` if running scripts is disabled. Stop the dev server with Ctrl+C before reinstalling dependencies. After the first install, use the dev command on its own.

Open the local URL printed by Vite and select **Open dashboard**. The demo starts in **Normal** and stores scenario changes in the running session. Run `npm run build` to generate the production build in `dist/`.

## Demo walkthrough

1. Open **Simulator** and choose **Gas Leak**. Check that Gas Level changes to **860 ppm**.
2. Select **View dashboard** to see the updated safety status. Check **Alerts → Critical** for the event.
3. Try **High Temp**, **High Energy**, and **Normal**. See all four sensors under **Analytics**.
4. Open **Home Assistant** and ask about an active reading. **Response settings** contains the execution preference and details. Both choices use local demo responses.
5. While the app is open, disconnect the network and try the demo assistant again. The offline banner should appear. Opening a fresh page offline requires separate hosting or caching support.

## Handoff to the Firebase and AI owners

This repository delivers the frontend and its demo data. Member 2 owns Firebase integration and hosting, and Member 3 owns AI integration. The adapter types are in `src/model.ts`. Each owner can replace their implementation in `src/services.ts` and switch its demo flag to false after connecting the real service.

### Member 2 · Firebase

- `getSensorReadings()` returns an initial `Snapshot`.
- `subscribeToReadings(next, error)` streams `Snapshot` updates and returns an unsubscribe function.
- `getSensorHistory(sensor)` returns `HistoryPoint[]` for the last 24 hours.
- `setScenario(scenario)` applies a scenario and resolves when accepted. Publish the resulting reading and alert updates through the subscriptions.
- `subscribeToAlerts(next, error)` streams newest-first `SensorAlert[]` and returns an unsubscribe function. Alert IDs should be unique.

Normalize Firestore timestamps to ISO 8601 strings and readings to the units declared in `src/model.ts`. Ensure the display thresholds match the backend rules. Publish the verified build from `dist/` using the team's Firebase Hosting project. The hash-based routes work without history fallback rewrites.

### Member 3 · AI

Implement `askAssistant(question, sensorContext, preferredMode)` with the project's provider. If the team function accepts two arguments, wrap it and treat the third argument as a UI preference only. Return the true provider execution mode (`ON_DEVICE` or `IN_CLOUD`), measured `latencyMs`, and ISO `readingTimestamp` for the source reading. The UI displays response metadata from this return value.

## Verify

```sh
npm run build
npx playwright install chromium
npm test
```

The Playwright suite covers desktop and mobile navigation, all scenario states, alerts, analytics, chat and the offline demo.


