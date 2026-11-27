import { createDemoTelemetry, demoAssistant } from './demo'
import type { AssistantAdapter, TelemetryAdapter } from './model'

// Replace these adapters with the team implementations once their interfaces are available.
export const services: {
  telemetry: TelemetryAdapter
  assistant: AssistantAdapter
  demoTelemetry: boolean
  demoAssistant: boolean
} = {
  telemetry: createDemoTelemetry(),
  assistant: demoAssistant,
  demoTelemetry: true,
  demoAssistant: true,
}

