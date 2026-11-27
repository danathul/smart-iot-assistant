import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { formatDate, formatTime, readingSeverity, scenarioKeys, scenarios, sensorKeys, sensors } from './model'
import type { HistoryPoint, Mode, Reply, Scenario, Sensor, SensorAlert, Severity, Snapshot } from './model'
import { services } from './services'
import { Badge, Icon, Notice, Orb, SensorCard, Trend, number, tone } from './ui'

function useHistory(sensor: Sensor, timestamp?: string) {
  const [retry, setRetry] = useState(0)
  const [request, setRequest] = useState<{ key: string; points?: HistoryPoint[]; error?: boolean }>()
  const key = sensor + timestamp + retry
  useEffect(() => {
    let current = true
    services.telemetry.getSensorHistory(sensor).then(
      points => { if (current) setRequest({ key, points: [...points].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)) }) },
      () => { if (current) setRequest({ key, error: true }) },
    )
    return () => { current = false }
  }, [sensor, key])
  return { points: request?.key === key ? request.points : undefined, failed: request?.key === key && request.error, retry: () => setRetry(r => r + 1) }
}

export function Dashboard({ snapshot }: { snapshot: Snapshot }) {
  const history = useHistory('temperature', snapshot.timestamp)
  const elevated = sensorKeys.filter(sensor => readingSeverity(sensor, snapshot.values[sensor]))
  const severity = elevated.some(sensor => readingSeverity(sensor, snapshot.values[sensor]) === 'Critical') ? 'Critical' : elevated.length ? 'Warning' : undefined
  const scenario = scenarios[snapshot.scenario]
  return <>
    <section className="hero" data-state={tone(severity)}>
      <Orb icon={scenario.icon} mobile />
      <div className="hero-copy">
        <span className="eyebrow">Home status</span>
        <h2>{severity ? snapshot.scenario === 'normal' ? 'Elevated sensor readings' : scenario.label + ' detected' : 'Everything is safe'}</h2>
        <p className="muted">{severity ? elevated.map(sensor => sensors[sensor].label).join(', ') + ' above threshold.' : 'Your home is being monitored.'}</p>
        <p className={`hero-status ${tone(severity)}`}>● {severity ? 'Attention needed' : 'Sensors online'}</p>
      </div>
      <div className="hero-visual">
        <Badge tone={tone(severity)}>{severity ?? 'Operational'}</Badge>
        <span className={`house ${tone(severity)}`}><Icon name="HomeIcon2" /><i /></span>
      </div>
    </section>
    <div className="section-heading"><h2>Live Sensors</h2><a className="control" href="#simulator"><Icon name="SlidersIcon" />Simulator</a></div>
    <div className="sensor-grid">{sensorKeys.map(sensor => <SensorCard key={sensor} sensor={sensor} value={snapshot.values[sensor]} />)}</div>
    <div className="dashboard-lower">
      {history.failed ? <Notice error retry={history.retry}>Unable to load temperature history.</Notice> : history.points ? <Trend compact sensor="temperature" points={history.points} /> : <Notice>Loading temperature history…</Notice>}
      <section className="panel assistant-preview">
        <Orb icon="SparkIcon1" mobile />
        <div><h2>Home Assistant</h2><p className="muted desktop-only">Learn what your home readings mean.</p>
        <p>{severity ? 'Ask about the current readings.' : 'All four readings are in range.'}</p>

        <a className="control primary" href="#assistant"><Icon name="ArrowIcon" />Open assistant</a></div>
      </section>
    </div>
  </>
}

export function Analytics({ snapshot }: { snapshot?: Snapshot }) {
  const [sensor, setSensor] = useState<Sensor>('temperature')
  const history = useHistory(sensor, snapshot?.timestamp)
  const info = sensors[sensor]
  const latest = history.points?.at(-1)
  const latestSeverity = latest && readingSeverity(sensor, latest.value)
  return <>
    <div className="filters" aria-label="Sensor">{sensorKeys.map(key => <button key={key} aria-pressed={sensor === key} onClick={() => setSensor(key)}>{sensors[key].label}</button>)}</div>
    {history.failed ? <Notice error retry={history.retry}>Unable to load sensor history.</Notice> : !history.points ? <Notice>Loading sensor history…</Notice> :
      <div className="analytics-grid">
        <Trend sensor={sensor} points={history.points} />
        <section className="panel history"><h2>Historical readings</h2><p className="muted">{info.label}</p>
          {latest && <div className="latest-reading">
            <p className="muted">Last updated <time dateTime={latest.timestamp}>{formatDate(latest.timestamp)}</time></p>
            <Badge tone={tone(latestSeverity)}>{latestSeverity ?? 'Normal'}</Badge>
          </div>}
          {history.points.length ? <table><thead><tr><th scope="col">Time</th><th scope="col">Reading</th><th scope="col">Status</th></tr></thead>
          <tbody>{[...history.points].reverse().slice(0, 8).map((point, i) => {
            const severity = readingSeverity(sensor, point.value)
            return <tr key={point.timestamp + i}><td><time dateTime={point.timestamp}>{formatDate(point.timestamp)}</time></td><td>{number(point.value)} {info.unit}</td><td className={tone(severity)}>{severity ?? 'Normal'}</td></tr>
          })}</tbody></table> : <p className="empty">No historical readings available.</p>}
        </section>
      </div>}
  </>
}

export function Alerts({ alerts }: { alerts: SensorAlert[] | undefined }) {
  const [filter, setFilter] = useState<Severity | 'All alerts'>('All alerts')
  const visible = alerts?.filter(alert => filter === 'All alerts' || alert.severity === filter)
  return <>
    <div className="filters" aria-label="Alert severity">{(['All alerts', 'Critical', 'Warning', 'Info'] as const).map(label => <button key={label} aria-pressed={filter === label} onClick={() => setFilter(label)}>{label}</button>)}</div>
    {!visible ? <Notice>Loading alerts…</Notice> : !visible.length ? <Notice>No alerts for this filter.</Notice> :
      <ul className="alert-list">{visible.map(alert => <li key={alert.id} className="panel alert-row">
        <Orb scope="alerts" icon={alert.sensor ? sensors[alert.sensor].icon : 'ShieldIcon'} />
        <div><h2>{alert.title}</h2><p className="muted">{alert.reason}</p></div>
        <Badge tone={tone(alert.severity)}>{alert.severity}</Badge>
        <time dateTime={alert.timestamp}><Icon name="ClockIcon" scope="alerts" />{formatDate(alert.timestamp)}</time>
      </li>)}</ul>}
  </>
}

export function Simulator({ snapshot, onScenario }: { snapshot: Snapshot; onScenario: (scenario: Scenario) => Promise<void> }) {
  const [pending, setPending] = useState<Scenario>()
  const [error, setError] = useState(false)
  const lock = useRef(false)
  async function change(scenario: Scenario) {
    if (lock.current || snapshot.scenario === scenario) return
    lock.current = true
    setError(false); setPending(scenario)
    try { await onScenario(scenario) } catch { setError(true) }
    finally { setPending(undefined); lock.current = false }
  }
  return <div className="split">
    <section className="panel padded"><h2>Simulation mode</h2><p className="muted">Choose a scenario to update the readings.</p>
      {error && <Notice error>Could not change the scenario. Choose it again to retry.</Notice>}
      <div className="scenario-list">{scenarioKeys.map(key => <button key={key} aria-pressed={snapshot.scenario === key} disabled={!!pending} onClick={() => void change(key)}>
        <Orb icon={scenarios[key].icon} scope="simulator" /><span className="scenario-copy"><strong>{scenarios[key].label}</strong><small>{scenarios[key].description}</small></span>
        <span className="accent">{pending === key ? 'Applying…' : snapshot.scenario === key ? 'Active' : ''}</span>
      </button>)}</div>
    </section>
    <section className="panel padded"><h2>Scenario output</h2><p className="muted" aria-live="polite">{scenarios[snapshot.scenario].label} · Simulated readings</p>
      <ul className="output-list">{sensorKeys.map(sensor => <li key={sensor}><Icon name={sensors[sensor].icon + '1'} scope="simulator" /><span>{sensors[sensor].label}</span><strong className={tone(readingSeverity(sensor, snapshot.values[sensor]))}>{number(snapshot.values[sensor])} {sensors[sensor].unit}</strong></li>)}</ul>
      <a className="control primary" href="#overview"><Icon name="ArrowIcon" />View dashboard</a>
    </section>
  </div>
}

const modeName = (mode: Mode) => mode === 'ON_DEVICE' ? 'ON DEVICE' : 'IN CLOUD'
const prompts = ['Is the gas level safe?', 'Check temperature', 'Any elevated readings?']
type Exchange = { question: string; reply?: Reply; pending?: boolean; error?: boolean }

export function Assistant({ snapshot, online }: { snapshot?: Snapshot; online: boolean }) {
  const [text, setText] = useState('')
  const [mode, setMode] = useState<Mode>('ON_DEVICE')
  const [chat, setChat] = useState<Exchange[]>([])
  const [sending, setSending] = useState(false)
  const lock = useRef(false)
  const messages = useRef<HTMLDivElement>(null)
  const disabled = !snapshot || sending || (!online && !services.demoAssistant && mode === 'IN_CLOUD')
  const latestReply = [...chat].reverse().find(turn => turn.reply)?.reply

  useEffect(() => {
    const node = messages.current
    if (node && chat.length) node.scrollTop = node.scrollHeight
  }, [chat])

  async function send(value: string) {
    const question = value.trim()
    if (lock.current || disabled || !question || !snapshot) return
    lock.current = true; setSending(true); setText('')
    setChat(list => [...list, { question, pending: true }])
    try {
      const reply = await services.assistant.askAssistant(question, snapshot, mode)
      setChat(list => [...list.slice(0, -1), { question, reply }])
    } catch {
      setChat(list => [...list.slice(0, -1), { question, error: true }])
    } finally {
      lock.current = false; setSending(false)
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void send(text) }
  return <div className="assistant-grid">
    <section className="panel chat">
      <div className="chat-head"><Orb icon="SparkIcon1" scope="assistant" /><div><h2>Home Assistant</h2><p className="muted">{snapshot ? 'Sensor context · ' + formatTime(snapshot.timestamp) : 'Waiting for sensor context'}</p></div></div>
      <div className="chat-log" role="log" aria-label="Conversation" ref={messages}>
        <div className="bubble"><strong>Home Assistant</strong><p>Ask about gas, temperature, humidity or energy.</p>{services.demoAssistant && <Badge>SAMPLE RESPONSES</Badge>}</div>
        {chat.map((turn, i) => <div className="turn" key={i}>
          <div className="bubble user-bubble">{turn.question}</div>
          <div className="bubble"><strong>Home Assistant</strong>
            {turn.pending ? <p>Checking readings…</p> : turn.error ? <><p className="danger">Could not get a response.</p><button disabled={disabled} onClick={() => void send(turn.question)}>Retry</button></> : turn.reply && <>
              <p>{turn.reply.answer}</p>
              {!services.demoAssistant && <small className="reply-meta">{modeName(turn.reply.executionMode)} · {turn.reply.latencyMs} ms · reading {formatDate(turn.reply.readingTimestamp)}</small>}
            </>}
          </div>
        </div>)}
      </div>
      <div className="suggestions"><p className="muted">Suggested questions</p><div className="filters">{prompts.map(prompt => <button key={prompt} disabled={disabled} onClick={() => void send(prompt)}>{prompt}</button>)}</div></div>
      <form className="composer" onSubmit={submit}>
        <input aria-label="Message" placeholder="Ask about your home…" value={text} onChange={event => setText(event.target.value)} maxLength={500} />
        <button className="primary" disabled={disabled || !text.trim()}>Send</button>
      </form>
    </section>
    <details className="panel padded execution"><summary>Response settings</summary>
      <div className="filters" aria-label="Preferred execution mode"><button aria-pressed={mode === 'ON_DEVICE'} onClick={() => setMode('ON_DEVICE')}>On-device</button><button aria-pressed={mode === 'IN_CLOUD'} onClick={() => setMode('IN_CLOUD')}>Cloud</button></div>
      <p className="muted">{latestReply ? 'Last response · ' + modeName(latestReply.executionMode) + ' · ' + latestReply.latencyMs + ' ms · reading ' + formatDate(latestReply.readingTimestamp) : 'Response details appear here after a reply.'}</p>
      {services.demoAssistant && <p className="muted">Both modes use simulated replies.</p>}
    </details>
  </div>
}


