import './App.css'
import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import axios from 'axios'
import 'maplibre-gl/dist/maplibre-gl.css'

function App() {

  const mapContainer = useRef(null)
  const mapRef = useRef(null)

  const [source, setSource] = useState('')
  const [destination, setDestination] = useState('')
  const [distance, setDistance] = useState(null)
  const [duration, setDuration] = useState(null)
  const [routes, setRoutes] = useState([])
  const [weather, setWeather] = useState(null)
const [traffic, setTraffic] = useState(null)

  useEffect(() => {

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [78.9629, 20.5937],
      zoom: 4.5
    })

    map.addControl(
      new maplibregl.NavigationControl(),
      'top-right'
    )

    mapRef.current = map

    return () => map.remove()

  }, [])

  const generateRoute = async () => {

    try {

      const apiKey =
        import.meta.env.VITE_ORS_API_KEY

      const sourceRes =
  await axios.get(
    'https://nominatim.openstreetmap.org/search',
    {
      params: {
        q: source,
        format: 'json',
        limit: 1
      }
    }
  )

      const destRes =
  await axios.get(
    'https://nominatim.openstreetmap.org/search',
    {
      params: {
        q: destination,
        format: 'json',
        limit: 1
      }
    }
  )

   const sourceCoords = [
  parseFloat(
    sourceRes.data[0].lon
  ),
  parseFloat(
    sourceRes.data[0].lat
  )
]

      const destCoords = [
  parseFloat(
    destRes.data[0].lon
  ),
  parseFloat(
    destRes.data[0].lat
  )
]
if (
  sourceRes.data.length === 0 ||
  destRes.data.length === 0
) {
  alert(
    'Location not found'
  )
  return
}

        const routeRes =
  await axios.post(
    'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
    {
      coordinates: [
        sourceCoords,
        destCoords
      ]
    },
    {
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json'
      }
    }
  )

const routeCoords =
  routeRes.data.features[0]
    .geometry.coordinates

    const summary =
  routeRes.data.features[0]
    .properties.summary

const distanceKm =
  (summary.distance / 1000).toFixed(1)

const durationMin =
  (summary.duration / 60).toFixed(0)

setDistance(distanceKm)
setDuration(durationMin)

setRoutes([
  {
    name: 'Best Route',
    distance: distanceKm,
    duration: durationMin
  },
  {
    name: 'Route 2',
    distance: (
      parseFloat(distanceKm) + 8
    ).toFixed(1),
    duration: (
      parseInt(durationMin) + 35
    ).toFixed(0)
  },
  {
    name: 'Route 3',
    distance: (
      parseFloat(distanceKm) + 15
    ).toFixed(1),
    duration: (
      parseInt(durationMin) + 55
    ).toFixed(0)
  }
]) 

const weatherRes =
  await axios.get(
    'https://api.openweathermap.org/data/2.5/weather',
    {
      params: {
        q: destination,
        appid: import.meta.env.VITE_OPENWEATHER_API_KEY
      }
    }
  )

setWeather({
  temp: (
    weatherRes.data.main.temp - 273.15
  ).toFixed(1),

  humidity:
    weatherRes.data.main.humidity,

  clouds:
    weatherRes.data.clouds.all,

  rain:
    weatherRes.data.rain?.['1h'] || 0
})

const now = new Date()

const predictRes =
  await axios.post(
    'http://127.0.0.1:8000/predict',
    {
      temp:
        weatherRes.data.main.temp,

      rain_1h:
        weatherRes.data.rain?.['1h'] || 0,

      snow_1h: 0,

      clouds_all:
        weatherRes.data.clouds.all,

      hour:
        now.getHours(),

      day_of_week:
        now.getDay(),

      month:
        now.getMonth() + 1,

      is_weekend:
        [0,6].includes(
          now.getDay()
        ) ? 1 : 0,

      rush_hour:
        [7,8,9,17,18,19]
        .includes(
          now.getHours()
        ) ? 1 : 0
    }
  )

setTraffic(
  predictRes.data
)

if (
  Math.random() > 0.7
) {

  const accidentPoint =
    routeCoords[
      Math.floor(
        routeCoords.length / 2
      )
    ]

  new maplibregl.Marker({
    color: 'red'
  })
  .setLngLat(accidentPoint)
  .setPopup(
    new maplibregl.Popup()
      .setHTML(
        '<h3>🚨 Accident Reported</h3>'
      )
  )
  .addTo(mapRef.current)

}

const routeGeoJSON = {
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: routeCoords
  }
}

const map = mapRef.current
const bounds =
  new maplibregl.LngLatBounds()

routeCoords.forEach(coord => {
  bounds.extend(coord)
})

map.fitBounds(bounds,{
  padding:100
})

if (map.getSource('route')) {

  map.getSource('route')
    .setData(routeGeoJSON)

} else {

  map.addSource(
    'route',
    {
      type: 'geojson',
      data: routeGeoJSON
    }
  )

  map.addLayer({
    id: 'route',
    type: 'line',
    source: 'route',
    paint: {
  'line-color':
    predictRes.data.prediction === 2
      ? '#ef4444'
      : predictRes.data.prediction === 1
      ? '#f59e0b'
      : '#22c55e',

  'line-width': 7
}
  })
}
      console.log(routeRes.data)

      console.log(
        sourceCoords,
        destCoords
      )

    } catch (error) {

  console.error(error)

  alert(
    'Route Search Failed'
  )
}
  }

  return (
    <div className="app">

      <div className="sidebar">

        <h1>🚦 Smart Traffic AI</h1>

        <input
          className="input"
          placeholder="Source"
          value={source}
          onChange={(e) =>
            setSource(e.target.value)
          }
        />

        <input
          className="input"
          placeholder="Destination"
          value={destination}
          onChange={(e) =>
            setDestination(e.target.value)
          }
        />

        <button
          className="btn"
          onClick={generateRoute}
        >
          Generate Route
        </button>

{routes.length > 0 && (

<div className="card">

  <h3>🛣 Route Options</h3>

  {routes.map((route,index)=>(

    <div
      key={index}
      className="route-option"
    >

      <b>{route.name}</b>

      <br/>

      {route.distance} km • {route.duration} min

    </div>

  ))}

</div>

)} 


        {distance && (

  <div className="card">

    <h3>📍 Route Info</h3>

    <p>
      Distance: {distance} km
    </p>

    <p>
      ETA: {duration} min
    </p>

  </div>

)}

        {weather && (

<div className="card">

  <h3>🌦 Weather</h3>

  <p>
    Temperature:
    {weather.temp}°C
  </p>

  <p>
    Humidity:
    {weather.humidity}%
  </p>

  <p>
    Clouds:
    {weather.clouds}%
  </p>

</div>

)}
       {traffic && (

<div className="card">

  <h3>🚦 AI Traffic</h3>

  <p>
    {traffic.label}
  </p>

</div>

)}
<div className="card">

  <h3>🚨 Alerts</h3>

  <p>
    ⚠ Road Construction Ahead
  </p>

  <p>
    🚨 Accident Risk Moderate
  </p>

</div>

      </div>

      <div
        ref={mapContainer}
        className="map-container"
      />

    </div>
  )
}

export default App