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
          'https://api.openrouteservice.org/geocode/search',
          {
            params: {
              api_key: apiKey,
              text: source,
              size: 1
            }
          }
        )

      const destRes =
        await axios.get(
          'https://api.openrouteservice.org/geocode/search',
          {
            params: {
              api_key: apiKey,
              text: destination,
              size: 1
            }
          }
        )

      const sourceCoords =
        sourceRes.data.features[0]
        .geometry.coordinates

      const destCoords =
        destRes.data.features[0]
        .geometry.coordinates

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

const routeGeoJSON = {
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: routeCoords
  }
}

const map = mapRef.current

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
      'line-color': '#2563eb',
      'line-width': 6
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

        <div className="card">
          <h3>🌦 Weather</h3>
          <p>Temperature: --</p>
          <p>Humidity: --</p>
          <p>Clouds: --</p>
        </div>

        <div className="card">
          <h3>🚦 Traffic Score</h3>
          <p>Waiting for route...</p>
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