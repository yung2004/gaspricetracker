import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const API_BASE = ''

async function fetchCSV(url) {
  const response = await fetch(`${API_BASE}${url}`)
  const text = await response.text()
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',')
  const data = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',')
    if (values.length >= headers.length) {
      const row = {}
      headers.forEach((header, index) => {
        row[header.trim()] = values[index]?.trim() || ''
      })
      data.push(row)
    }
  }
  return data
}

function parseDate(dateStr) {
  const [date, time] = dateStr.split(' ')
  const [year, month, day] = date.split('-')
  const [hour, minute, second] = time.split(':')
  return new Date(year, month - 1, day, hour, minute, second)
}

function formatDate(date) {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function StatCard({ title, value, subtitle, icon, color, badge }) {
  return (
    <div className="bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm font-medium">{title}</p>
          <p className={`text-3xl font-bold mt-2 ${color}`}>{value}</p>
          {badge && <p className={`text-xl font-semibold mt-1 ${color}`}>{badge}</p>}
          {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
        </div>
        {icon && <div className={`p-3 rounded-lg ${color.replace('text-', 'bg-').replace('900', '900/20')}`}>
          {icon}
        </div>}
      </div>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <div className="h-80">
        {children}
      </div>
    </div>
  )
}

function ToggleButton({ enabled, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
        enabled 
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
          : 'bg-slate-700/50 text-slate-400 border border-slate-600'
      }`}
    >
      <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
      <span className="text-sm font-medium">
        Auto-refresh {enabled ? 'ON' : 'OFF'}
      </span>
    </button>
  )
}

function App() {
  const [avgData, setAvgData] = useState([])
  const [vendorsData, setVendorsData] = useState([])
  const [latestPrice, setLatestPrice] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [lowestStation, setLowestStation] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [loading, setLoading] = useState(true)
  const [visibleStations, setVisibleStations] = useState({})

  const loadData = useCallback(async () => {
    try {
      const [avg, vendors] = await Promise.all([
        fetchCSV('/gaspricetracker/data/richmond/avg.csv'),
        fetchCSV('/gaspricetracker/data/richmond/vendors.csv')
      ])
      
      setAvgData(avg)
      setVendorsData(vendors)
      
      if (avg.length > 0) {
        const latest = avg[avg.length - 1]
        setLatestPrice(latest.price)
        setLastUpdated(latest['capture time'])
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      loadData()
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [autoRefresh, loadData])

  const chartData = avgData.map(row => ({
    date: parseDate(row['capture time']).getTime(),
    price: parseFloat(row.price),
    time: formatDate(parseDate(row['capture time']))
  })).sort((a, b) => a.date - b.date)

  const now = Date.now()
  const last24hData = chartData.filter(d => now - d.date <= 24 * 60 * 60 * 1000)

  const last24hVendorPrices = vendorsData
    .filter(r => now - parseDate(r['capture time']).getTime() <= 24 * 60 * 60 * 1000)
    .map(r => parseFloat(r.price))

  const vendorGroups = vendorsData.reduce((acc, row) => {
    const name = row['station name']
    if (!acc[name]) acc[name] = []
    acc[name].push({
      date: parseDate(row['capture time']).getTime(),
      price: parseFloat(row.price),
      time: formatDate(row['capture time'])
    })
    return acc
  }, {})

  const latestTimestamp = vendorsData.length > 0 
    ? Math.max(...vendorsData.map(r => parseDate(r['capture time']).getTime()))
    : null

  const latestStations = latestTimestamp 
    ? vendorsData.filter(r => parseDate(r['capture time']).getTime() === latestTimestamp)
    : []

  const lowestInLatest = latestStations.length > 0 
    ? latestStations.reduce((min, r) => parseFloat(r.price) < parseFloat(min.price) ? r : min, latestStations[0])
    : null

  useEffect(() => {
    const initial = {}
    Object.keys(vendorGroups).forEach(name => {
      initial[name] = true
    })
    setVisibleStations(initial)
  }, [vendorsData])

  const toggleStation = (name) => {
    setVisibleStations(prev => ({
      ...prev,
      [name]: !prev[name]
    }))
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-slate-400 text-sm">{payload[0]?.payload?.time}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-white font-semibold" style={{ color: entry.color }}>
              {entry.name}: ${entry.value?.toFixed(3)}/L
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-slate-400 mt-4">Loading ...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Richmond Gas Prices</h1>
            <p className="text-slate-400 mt-1">Real-time fuel price monitoring</p>
          </div>
          <ToggleButton enabled={autoRefresh} onToggle={() => setAutoRefresh(!autoRefresh)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            title="Lowest Price"
            value={lowestInLatest ? `$${parseFloat(lowestInLatest.price).toFixed(3)}/L` + " (" + lowestInLatest['station name'] + ")" : 'N/A'}
            subtitle={lowestInLatest ? `Updated: ${formatDate(parseDate( lowestInLatest['capture time']))}` : ''}
            color="text-emerald-400"
            
          />
          <StatCard
            title="Average Price"
            value={`$${latestPrice || '0.000'}/L`}
            subtitle={lastUpdated ? `Updated: ${formatDate(parseDate(lastUpdated))}` : ''}
            color="text-amber-400"
          />
          <StatCard
            title="Price Range (24h)"
            value={last24hVendorPrices.length > 0 ? `$${Math.min(...last24hVendorPrices).toFixed(3)} - $${Math.max(...last24hVendorPrices).toFixed(3)}` : 'N/A'}
            subtitle="All Stations Min to Max"
            color="text-blue-400"
          />
        </div>

        <ChartCard title="Average Price History">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="date" 
                type="number"
                scale="time"
                stroke="#94a3b8"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(value) => formatDate(new Date(value))}
                domain={['auto', 'auto']}
              />
              <YAxis 
                stroke="#94a3b8"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                domain={['auto', 'auto']}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="price" 
                name="Average"
                stroke="#10b981" 
                strokeWidth={3}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#10b981' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="mt-6">
          <ChartCard title="Station Prices History">
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.keys(vendorGroups).map((name, index) => (
                <button
                  key={name}
                  onClick={() => toggleStation(name)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                    visibleStations[name]
                      ? 'text-white'
                      : 'bg-slate-700 text-slate-500 line-through'
                  }`}
                  style={{
                    backgroundColor: visibleStations[name] ? COLORS[index % COLORS.length] + '40' : undefined,
                    borderWidth: '1px',
                    borderColor: visibleStations[name] ? COLORS[index % COLORS.length] : '#475569'
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="date" 
                  type="number"
                  scale="time"
                  stroke="#94a3b8"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(value) => formatDate(new Date(value))}
                  domain={['auto', 'auto']}
                />
                <YAxis 
                  stroke="#94a3b8"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  domain={['auto', 'auto']}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip content={<CustomTooltip />} />
                {Object.entries(vendorGroups)
                  .filter(([name]) => visibleStations[name])
                  .map(([name, data], index) => (
                    <Line
                      key={name}
                      type="monotone"
                      data={data.sort((a, b) => a.date - b.date)}
                      dataKey="price"
                      name={name}
                      stroke={COLORS[Object.keys(vendorGroups).indexOf(name) % COLORS.length]}
                      strokeWidth={2}
                      dot={{ fill: COLORS[Object.keys(vendorGroups).indexOf(name) % COLORS.length], r: 3 }}
                      connectNulls
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="mt-6 text-center text-slate-500 text-sm">
          <p>Auto-refresh every 5 minutes {autoRefresh ? '• Enabled' : '• Disabled'}</p>
        </div>
      </div>
    </div>
  )
}

export default App
