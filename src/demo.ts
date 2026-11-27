import { readingSeverity, scenarioKeys, sensorKeys, sensors } from './model'
import type { AssistantAdapter, HistoryPoint, Scenario, Sensor, SensorAlert, Snapshot, TelemetryAdapter } from './model'

const normal = { temperature: 24.5, humidity: 48, gas: 120, energy: 320 }
const incident: Partial<Record<Scenario, Sensor>> = { gasLeak: 'gas', highTemp: 'temperature', highEnergy: 'energy' }
const override: Partial<Record<Scenario, number>> = { gasLeak: 860, highTemp: 38.2, highEnergy: 1450 }
const titles: Record<Sensor, string> = { gas: 'Gas level above threshold', temperature: 'Temperature above threshold', energy: 'High energy usage', humidity: 'High humidity' }
const locations: Record<Sensor, string> = { gas: 'Kitchen sensor', temperature: 'Living room sensor', energy: 'Main meter', humidity: 'Living room sensor' }
const samples = [0.12, 0.23, 0.18, 0.41, 0.34, 0.58, 0.48, 0.67, 0.57, 0.75, 0.67, 0.88, 0.81]

function makeSnapshot(scenario: Scenario, timestamp = new Date().toISOString()): Snapshot {
  const values = { ...normal }
  const sensor = incident[scenario]
  const value = override[scenario]
  if (sensor && value !== undefined) values[sensor] = value
  return { scenario, timestamp, values }
}

function makeAlert(scenario: Scenario, timestamp: string): SensorAlert | undefined {
  const sensor = incident[scenario]
  if (!sensor) return
  const value = makeSnapshot(scenario, timestamp).values[sensor]
  return {
    id: scenario + timestamp, title: titles[sensor], reason: locations[sensor] + ' · ' + value + ' ' + sensors[sensor].unit,
    timestamp, severity: readingSeverity(sensor, value) ?? 'Info', sensor,
  }
}

export function createDemoTelemetry(): TelemetryAdapter {
  const now = Date.now()
  const ago = (minutes: number) => new Date(now - minutes * 60000).toISOString()
  let snapshot = makeSnapshot('normal', ago(0))
  let alerts: SensorAlert[] = scenarioKeys.slice(1).flatMap((scenario, i) => makeAlert(scenario, ago(54 + i * 84)) ?? [])
  alerts.push({ id: 'restored', title: 'Monitoring restored', reason: 'Sensor network reconnected', timestamp: ago(320), severity: 'Info' })
  const readingListeners = new Set<(data: Snapshot) => void>()
  const alertListeners = new Set<(data: SensorAlert[]) => void>()
  const series = Object.fromEntries(sensorKeys.map(sensor => {
    const base = normal[sensor]
    const spread = { temperature: 6.2, humidity: 14, gas: 38, energy: 155 }[sensor]
    const points = samples.map((v, i) => ({
      value: Number((base + (v - .81) * spread).toFixed(sensor === 'temperature' ? 1 : 0)),
      timestamp: ago((samples.length - i - 1) * 120),
    }))
    return [sensor, points]
  })) as Record<Sensor, HistoryPoint[]>

  return {
    async getSensorReadings() { return snapshot },
    subscribeToReadings(next) { readingListeners.add(next); next(snapshot); return () => { readingListeners.delete(next) } },
    async getSensorHistory(sensor) {
      return [...series[sensor].filter(p => p.timestamp < snapshot.timestamp), { value: snapshot.values[sensor], timestamp: snapshot.timestamp }]
    },
    async setScenario(scenario) {
      if (snapshot.scenario === scenario) return
      snapshot = makeSnapshot(scenario)
      const alert = makeAlert(scenario, snapshot.timestamp)
      if (alert) alerts = [alert, ...alerts]
      readingListeners.forEach(next => next(snapshot))
      alertListeners.forEach(next => next(alerts))
    },
    subscribeToAlerts(next) { alertListeners.add(next); next(alerts); return () => { alertListeners.delete(next) } },
  }
}

const questions: Record<Sensor, RegExp> = {
  temperature: /temp|heat|hot|حرارة/i, humidity: /humid|moist|رطوبة/i,
  gas: /gas|leak|ppm|غاز|تسرب/i, energy: /energy|power|electric|طاقة|كهرب/i,
}
export const demoAssistant: AssistantAdapter = {
  async askAssistant(question, snapshot, preferredMode) {
    const start = performance.now()
    await new Promise(resolve => setTimeout(resolve, preferredMode === 'ON_DEVICE' ? 180 : 470))
    const requested = sensorKeys.filter(sensor => questions[sensor].test(question))
    const elevated = sensorKeys.filter(sensor => readingSeverity(sensor, snapshot.values[sensor]))
    const relevant = requested.length ? requested : elevated.length ? elevated : sensorKeys
    const readings = relevant.map(sensor => {
      const value = snapshot.values[sensor]
      return sensors[sensor].label + ' is ' + value + ' ' + sensors[sensor].unit + ' (' +
        (readingSeverity(sensor, value) ? 'above the demo threshold' : 'within the demo range') + ').'
    })
    return { answer: readings.join(' '), executionMode: preferredMode, latencyMs: Math.round(performance.now() - start), readingTimestamp: snapshot.timestamp }
  },
}

