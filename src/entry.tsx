import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import '@fontsource-variable/inter'
import './theme.css'
import './mist.css'
import { services } from './services'
import type { SensorAlert, Snapshot } from './model'
import { Alerts, Analytics, Assistant, Dashboard, Simulator } from './views'
import { Badge, Brand, Icon, Notice } from './ui'

const routes = {
  overview: ['Overview', 'Home', 'HomeIcon1', 'Home Overview', 'Live readings and safety status for your home.'],
  analytics: ['Analytics', 'Trends', 'ChartIcon', 'Sensor Analytics', 'Explore historical readings and trends.'],
  assistant: ['Assistant', 'Help', 'SparkIcon', 'Home Assistant', 'Ask about your home and current readings.'],
  alerts: ['Alerts', 'Alerts', 'BellIcon', 'Alerts Center', 'Review sensor alerts by severity and time.'],
  simulator: ['Simulator', 'Sim', 'SlidersIcon', 'Simulator', 'Switch scenarios to preview changes in home status.'],
} as const
type WorkspaceRoute = keyof typeof routes
type Route = WorkspaceRoute | 'welcome'
const routeKeys = Object.keys(routes) as WorkspaceRoute[]
function routeFromHash(): Route {
  const route = location.hash.slice(1)
  return routeKeys.find(key => key === route) ?? (route ? 'overview' : 'welcome')
}

function useTelemetry() {
  const [snapshot, setSnapshot] = useState<Snapshot>()
  const [alerts, setAlerts] = useState<SensorAlert[]>()
  const [readError, setReadError] = useState(false)
  const [alertError, setAlertError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  useEffect(() => {
    let active = true
    let receivedLive = false
    const nextReading = (value: Snapshot) => { if (active) { setSnapshot(value); setReadError(false) } }
    const failReading = () => { if (active) setReadError(true) }
    services.telemetry.getSensorReadings().then(value => {
      if (!receivedLive) nextReading(value)
    }, () => { if (!receivedLive) failReading() })
    const stopRead = services.telemetry.subscribeToReadings(value => {
      receivedLive = true; nextReading(value)
    }, failReading)
    const stopAlerts = services.telemetry.subscribeToAlerts(value => {
      if (active) { setAlerts(value); setAlertError(false) }
    }, () => { if (active) setAlertError(true) })
    return () => { active = false; stopRead(); stopAlerts() }
  }, [retryCount])
  function retry() { setReadError(false); setAlertError(false); setRetryCount(count => count + 1) }
  return { snapshot, alerts, readError, alertError, retry }
}

function App() {
  const [route, setRoute] = useState(routeFromHash)
  const [online, setOnline] = useState(navigator.onLine)
  const { snapshot, alerts, readError, alertError, retry } = useTelemetry()
  const [name,, , title, subtitle] = routes[route === 'welcome' ? 'overview' : route]
  useEffect(() => {
    const navigate = () => { setRoute(routeFromHash()); window.scrollTo(0, 0) }
    const syncNetwork = () => setOnline(navigator.onLine)
    window.addEventListener('hashchange', navigate)
    window.addEventListener('online', syncNetwork)
    window.addEventListener('offline', syncNetwork)
    return () => {
      window.removeEventListener('hashchange', navigate)
      window.removeEventListener('online', syncNetwork)
      window.removeEventListener('offline', syncNetwork)
    }
  }, [])
  useEffect(() => { document.title = route === 'welcome' ? 'SENSEORA' : title + ' | SENSEORA' }, [route, title])
  if (route === 'welcome') {
    return <main className="welcome">
      <section className="panel welcome-card">
        <Brand />
        <h1>Welcome to SENSEORA</h1>
        <p className="muted">See how your home is doing, check sensor readings, and review alerts in one place.</p>
        {services.demoTelemetry && <p className="muted welcome-note">This demo uses simulated sensors.</p>}
        <a className="control primary" href="#overview">Open dashboard<Icon name="ArrowIcon" /></a>
      </section>
    </main>
  }
  return <div className="shell">
    <header className="mobile-head"><Brand /><Badge>{services.demoTelemetry ? 'DEMO' : 'LIVE'}</Badge></header>
    <aside className="sidebar">
      <Brand /><p className="eyebrow workspace-label">Workspace</p>
      <section className="panel environment"><Badge>{services.demoTelemetry ? 'Simulation' : 'Connected'}</Badge><p className="muted">{services.demoTelemetry ? 'Demo sensor network' : 'Live sensor network'}</p></section>
    </aside>
    <nav className="nav" aria-label="Workspace">{routeKeys.map(key => {
      const [desktop, mobile, icon] = routes[key]
      return <a key={key} href={'#' + key} aria-current={route === key ? 'page' : undefined}>
        <Icon name={icon} mobile /><span className="nav-desktop">{desktop}</span><span className="nav-mobile">{mobile}</span>
      </a>
    })}</nav>
    <main className="main" id="workspace">
      <div className="breadcrumb"><span>Workspace&nbsp; / &nbsp;{name}</span><Badge>{services.demoTelemetry ? 'DEMO DATA' : 'LIVE DATA'}</Badge></div>
      <div className="page-heading"><h1>{title}</h1><p className="muted">{route === 'assistant' && !services.demoTelemetry ? 'Ask about your home and current sensor data.' : subtitle}</p></div>
      {!online && <Notice>{services.demoTelemetry ? 'Offline · simulation is available on this device.' : snapshot ? 'Offline · showing the last available readings.' : 'Offline · readings are unavailable.'}</Notice>}
      {readError && <Notice error retry={retry}>{snapshot ? 'Sensor connection interrupted. Showing the last available readings.' : 'Unable to connect to the sensors.'}</Notice>}
      {route === 'overview' && (snapshot ? <Dashboard snapshot={snapshot} /> : !readError && <Notice>Loading sensor readings…</Notice>)}
      {route === 'analytics' && <Analytics snapshot={snapshot} />}
      <div hidden={route !== 'assistant'}><Assistant snapshot={snapshot} online={online} /></div>
      {route === 'alerts' && <>
        {alertError && <Notice error retry={retry}>Unable to refresh alerts.</Notice>}
        {(!alertError || alerts) && <Alerts alerts={alerts} />}
      </>}
      {route === 'simulator' && (snapshot ? <Simulator snapshot={snapshot} onScenario={scenario => services.telemetry.setScenario(scenario)} /> : !readError && <Notice>Loading simulator…</Notice>)}
    </main>
  </div>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><MotionConfig reducedMotion="user"><App /></MotionConfig></StrictMode>,
)


