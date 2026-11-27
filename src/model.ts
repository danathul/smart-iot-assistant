export const sensors = {
  temperature: { label: 'Temperature', unit: '°C', icon: 'TempIcon', threshold: 35 },
  humidity: { label: 'Humidity', unit: '%', icon: 'WaterIcon', threshold: 65 },
  gas: { label: 'Gas Level', unit: 'ppm', icon: 'GasIcon', threshold: 500 },
  energy: { label: 'Energy', unit: 'W', icon: 'EnergyIcon', threshold: 1000 },
} as const

export type Sensor = keyof typeof sensors
export const sensorKeys = Object.keys(sensors) as Sensor[]
export const scenarios = {
  normal: { label: 'Normal', description: 'All readings within range', icon: 'ShieldIcon' },
  gasLeak: { label: 'Gas Leak', description: 'Gas level above threshold', icon: 'GasIcon' },
  highTemp: { label: 'High Temp', description: 'Temperature above threshold', icon: 'TempIcon' },
  highEnergy: { label: 'High Energy', description: 'Power draw above threshold', icon: 'EnergyIcon' },
} as const
export type Scenario = keyof typeof scenarios
export const scenarioKeys = Object.keys(scenarios) as Scenario[]
export type Severity = 'Critical' | 'Warning' | 'Info'
export type Snapshot = { values: Record<Sensor, number>; timestamp: string; scenario: Scenario }
export type HistoryPoint = { value: number; timestamp: string }
export type SensorAlert = { id: string; title: string; reason: string; timestamp: string; severity: Severity; sensor?: Sensor }
export type Mode = 'ON_DEVICE' | 'IN_CLOUD'
export type Reply = { answer: string; executionMode: Mode; latencyMs: number; readingTimestamp: string }

type Watch<T> = (next: (data: T) => void, error: (error: unknown) => void) => () => void
export interface TelemetryAdapter {
  getSensorReadings(): Promise<Snapshot>
  subscribeToReadings: Watch<Snapshot>
  getSensorHistory(sensor: Sensor): Promise<HistoryPoint[]>
  setScenario(scenario: Scenario): Promise<void>
  subscribeToAlerts: Watch<SensorAlert[]>
}
export interface AssistantAdapter {
  askAssistant(question: string, sensorContext: Snapshot, preferredMode: Mode): Promise<Reply>
}

export function readingSeverity(sensor: Sensor, value: number): 'Critical' | 'Warning' | undefined {
  if (value < sensors[sensor].threshold) return
  return sensor === 'gas' || sensor === 'temperature' ? 'Critical' : 'Warning'
}

export function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(timestamp))
}
export function formatDate(timestamp: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(timestamp))
}

