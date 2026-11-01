
import './App.css'
import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import axios from 'axios'
import 'maplibre-gl/dist/maplibre-gl.css'

const API_BASE = 'http://127.0.0.1:8000'

function App() {
  const mapContainer = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])

  const [source, setSource] = useState('')
  const [destination, setDestination] = useState('')

  const [sourceResults, setSourceResults] = useState([])
  const [destinationResults, setDestinationResults] = useState([])

  const [selectedSource, setSelectedSource] = useState(null)
  const [selectedDestination, setSelectedDestination] = useState(null)

  const [distance, setDistance] = useState(null)
  const [duration, setDuration] = useState(null)
  const [routes, setRoutes] = useState([])
  const [weather, setWeather] = useState(null)
  const [traffic, setTraffic] = useState(null)

  const [searchingSource, setSearchingSource] = useState(false)
  const [searchingDestination, setSearchingDestination] = useState(false)
  const [loadingRoute, setLoadingRoute] = useState(false)

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [77.1, 28.6],
      zoom: 9
    })

    map.addControl(
      new maplibregl.NavigationControl(),
      'top-right'
    )

    mapRef.current = map

    return () => {
      markersRef.current.forEach(marker => marker.remove())
      map.remove()
    }
  }, [])

  // =========================
  // SEARCH LOCATIONS
  // =========================

  const searchPlaces = async (query) => {
    const response = await axios.get(`${API_BASE}/search`, {
      params: { q: query.trim() }
    })

    return response.data
  }

  const handleSourceSearch = async () => {
    if (source.trim().length < 2) {
      alert('Enter at least 2 characters for source')
      return
    }

    setSearchingSource(true)
    setSourceResults([])
    setSelectedSource(null)

    try {
      const results = await searchPlaces(source)
      setSourceResults(results)

      if (results.length === 0) {
        alert('Source not found in the searchable Delhi-NCR area')
      }
    } catch (error) {
      console.error('Source search error:', error)
      alert('Source search failed. Check whether the backend is running.')
    } finally {
      setSearchingSource(false)
    }
  }

  const handleDestinationSearch = async () => {
    if (destination.trim().length < 2) {
      alert('Enter at least 2 characters for destination')
      return
    }

    setSearchingDestination(true)
    setDestinationResults([])
    setSelectedDestination(null)

    try {
      const results = await searchPlaces(destination)
      setDestinationResults(results)

      if (results.length === 0) {
        alert('Destination not found in the searchable Delhi-NCR area')
      }
    } catch (error) {
      console.error('Destination search error:', error)
      alert('Destination search failed. Check whether the backend is running.')
    } finally {
      setSearchingDestination(false)
    }
  }

  const chooseSource = (place) => {
    setSelectedSource(place)
    setSource(place.display_name)
    setSourceResults([])
  }

  const chooseDestination = (place) => {
    setSelectedDestination(place)
    setDestination(place.display_name)
    setDestinationResults([])
  }

  // =========================
  // GENERATE ROUTE
  // =========================

  const generateRoute = async () => {
    if (!selectedSource || !selectedDestination) {
      alert('Search and select both source and destination from the results first.')
      return
    }

    const apiKey = import.meta.env.VITE_ORS_API_KEY
    const weatherKey = import.meta.env.VITE_OPENWEATHER_API_KEY

    if (!apiKey) {
      alert('OpenRouteService API key is missing from frontend/.env')
      return
    }

    if (!weatherKey) {
      alert('OpenWeather API key is missing from frontend/.env')
      return
    }

    const sourceCoords = [
      Number(selectedSource.lon),
      Number(selectedSource.lat)
    ]

    const destCoords = [
      Number(selectedDestination.lon),
      Number(selectedDestination.lat)
    ]

    if (
      !sourceCoords.every(Number.isFinite) ||
      !destCoords.every(Number.isFinite)
    ) {
      alert('Invalid location coordinates. Please search and select again.')
      return
    }

    setLoadingRoute(true)

    try {
      // =========================
      // OPENROUTESERVICE
      // =========================

      const routeRes = await axios.post(
        'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
        {
          coordinates: [sourceCoords, destCoords]
        },
        {
          headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json'
          }
        }
      )

      const feature = routeRes.data.features?.[0]

      if (!feature?.geometry?.coordinates?.length) {
        throw new Error('No drivable route was returned for these locations.')
      }

      const routeCoords = feature.geometry.coordinates
      const summary = feature.properties.summary

      const distanceKm = (summary.distance / 1000).toFixed(1)
      const durationMin = (summary.duration / 60).toFixed(0)

      setDistance(distanceKm)
      setDuration(durationMin)

      // Route 2 and Route 3 are estimates, not actual alternative routes.
      setRoutes([
        {
          name: 'Best Route',
          distance: distanceKm,
          duration: durationMin
        },
        {
          name: 'Route 2 (Estimate)',
          distance: (Number(distanceKm) + 8).toFixed(1),
          duration: (Number(durationMin) + 35).toFixed(0)
        },
        {
          name: 'Route 3 (Estimate)',
          distance: (Number(distanceKm) + 15).toFixed(1),
          duration: (Number(durationMin) + 55).toFixed(0)
        }
      ])

      // =========================
      // WEATHER BY COORDINATES
      // =========================

      const weatherRes = await axios.get(
        'https://api.openweathermap.org/data/2.5/weather',
        {
          params: {
            lat: destCoords[1],
            lon: destCoords[0],
            appid: weatherKey
          }
        }
      )

      const weatherData = weatherRes.data
      const rain = weatherData.rain?.['1h'] || 0

      setWeather({
        temp: (weatherData.main.temp - 273.15).toFixed(1),
        humidity: weatherData.main.humidity,
        clouds: weatherData.clouds.all,
        rain
      })

      // =========================
      // AI TRAFFIC PREDICTION
      // =========================

      const now = new Date()
      const hour = now.getHours()
      const day = now.getDay()

      const predictRes = await axios.post(
        `${API_BASE}/predict`,
        {
          temp: weatherData.main.temp,
          rain_1h: rain,
          snow_1h: weatherData.snow?.['1h'] || 0,
          clouds_all: weatherData.clouds.all,
          hour,
          day_of_week: day,
          month: now.getMonth() + 1,
          is_weekend: [0, 6].includes(day) ? 1 : 0,
          rush_hour: [7, 8, 9, 17, 18, 19].includes(hour) ? 1 : 0
        }
      )

      setTraffic(predictRes.data)

      // =========================
      // DRAW ROUTE ON MAP
      // =========================

      const routeGeoJSON = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routeCoords
        }
      }

      const map = mapRef.current

      if (!map) {
        throw new Error('Map is not ready yet. Please try again.')
      }

      const drawRoute = () => {
        const bounds = new maplibregl.LngLatBounds()

        routeCoords.forEach(coord => bounds.extend(coord))

        map.fitBounds(bounds, { padding: 80, maxZoom: 15 })

        const lineColor =
          predictRes.data.prediction === 2
            ? '#ef4444'
            : predictRes.data.prediction === 1
              ? '#f59e0b'
              : '#22c55e'

        if (map.getSource('route')) {
          map.getSource('route').setData(routeGeoJSON)

          if (map.getLayer('route')) {
            map.setPaintProperty('route', 'line-color', lineColor)
          }
        } else {
          map.addSource('route', {
            type: 'geojson',
            data: routeGeoJSON
          })

          map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': lineColor,
              'line-width': 6
            }
          })
        }

        // Remove previous route endpoint markers.
        markersRef.current.forEach(marker => marker.remove())
        markersRef.current = []

        const sourceMarker = new maplibregl.Marker({ color: '#22c55e' })
          .setLngLat(sourceCoords)
          .setPopup(new maplibregl.Popup().setText(`Start: ${selectedSource.display_name}`))
          .addTo(map)

        const destinationMarker = new maplibregl.Marker({ color: '#ef4444' })
          .setLngLat(destCoords)
          .setPopup(new maplibregl.Popup().setText(`Destination: ${selectedDestination.display_name}`))
          .addTo(map)

        markersRef.current = [sourceMarker, destinationMarker]
      }

      if (map.isStyleLoaded()) {
        drawRoute()
      } else {
        map.once('load', drawRoute)
      }

      console.log('Route successfully generated')
    } catch (error) {
      console.error('FULL ERROR:', error)
      console.error('ERROR RESPONSE:', error.response?.data)

      const message =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.response?.data?.detail ||
        error.message ||
        'Route search failed'

      alert(message)
    } finally {
      setLoadingRoute(false)
    }
  }

  return (
    <div className="app">
      <div className="sidebar">
        <h1>🚦 Smart Traffic AI</h1>
        <p>Delhi-NCR route planner</p>

        {/* SOURCE SEARCH */}
        <label>Source</label>
        <input
          className="input"
          placeholder="Search road, shop, building or area"
          value={source}
          onChange={(e) => {
            setSource(e.target.value)
            setSelectedSource(null)
            setSourceResults([])
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSourceSearch()
          }}
        />

        <button
          className="btn"
          onClick={handleSourceSearch}
          disabled={searchingSource}
        >
          {searchingSource ? 'Searching...' : 'Find Source'}
        </button>

        {sourceResults.length > 0 && (
          <div className="search-results">
            <b>Select source location</b>

            {sourceResults.map((place, index) => (
              <button
                type="button"
                className="search-result"
                key={`${place.lat}-${place.lon}-${index}`}
                onClick={() => chooseSource(place)}
              >
                📍 {place.display_name}
              </button>
            ))}
          </div>
        )}

        {selectedSource && (
          <p className="selected-location">
            ✓ Source selected
          </p>
        )}

        {/* DESTINATION SEARCH */}
        <label>Destination</label>
        <input
          className="input"
          placeholder="Search destination in Delhi-NCR"
          value={destination}
          onChange={(e) => {
            setDestination(e.target.value)
            setSelectedDestination(null)
            setDestinationResults([])
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleDestinationSearch()
          }}
        />

        <button
          className="btn"
          onClick={handleDestinationSearch}
          disabled={searchingDestination}
        >
          {searchingDestination ? 'Searching...' : 'Find Destination'}
        </button>

        {destinationResults.length > 0 && (
          <div className="search-results">
            <b>Select destination</b>

            {destinationResults.map((place, index) => (
              <button
                type="button"
                className="search-result"
                key={`${place.lat}-${place.lon}-${index}`}
                onClick={() => chooseDestination(place)}
              >
                📍 {place.display_name}
              </button>
            ))}
          </div>
        )}

        {selectedDestination && (
          <p className="selected-location">
            ✓ Destination selected
          </p>
        )}

        <button
          className="btn"
          onClick={generateRoute}
          disabled={loadingRoute}
        >
          {loadingRoute ? 'Generating Route...' : 'Generate Route'}
        </button>

        {routes.length > 0 && (
          <div className="card">
            <h3>🛣 Route Options</h3>

            {routes.map((route, index) => (
              <div key={index} className="route-option">
                <b>{route.name}</b>
                <br />
                {route.distance} km • {route.duration} min
              </div>
            ))}
          </div>
        )}

        {distance !== null && (
          <div className="card">
            <h3>📍 Route Info</h3>
            <p>Distance: {distance} km</p>
            <p>ETA: {duration} min</p>
          </div>
        )}

        {weather && (
          <div className="card">
            <h3>🌦 Weather at destination</h3>
            <p>Temperature: {weather.temp}°C</p>
            <p>Humidity: {weather.humidity}%</p>
            <p>Clouds: {weather.clouds}%</p>
            <p>Rain (last hour): {weather.rain} mm</p>
          </div>
        )}

        {traffic && (
          <div className="card">
            <h3>🚦 AI Traffic Prediction</h3>
            <p>{traffic.label}</p>
          </div>
        )}

        <div className="card">
          <h3>🚨 Alerts</h3>
          <p>Live accident and roadwork alerts are not connected yet.</p>
        </div>
      </div>

      <div ref={mapContainer} className="map-container" />
    </div>
  )
}

export default App
