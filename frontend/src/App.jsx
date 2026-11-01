
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
  const gpsMarkerRef = useRef(null)
  const gpsWatchIdRef = useRef(null)
  const lastRerouteAtRef = useRef(0)
  const lastGpsRef = useRef(null)
  const isNavigatingRef = useRef(false)

  const [source, setSource] = useState('')
  const [destination, setDestination] = useState('')

  const [sourceResults, setSourceResults] = useState([])
  const [destinationResults, setDestinationResults] = useState([])

  const [selectedSource, setSelectedSource] = useState(null)
  const [selectedDestination, setSelectedDestination] = useState(null)

  const [distance, setDistance] = useState(null)
  const [duration, setDuration] = useState(null)
  const [routes, setRoutes] = useState([])
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0)
  const [weather, setWeather] = useState(null)
  const [traffic, setTraffic] = useState(null)
  const [alertType, setAlertType] = useState('Accident')
  const [alertNote, setAlertNote] = useState('')
  const [roadAlerts, setRoadAlerts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('smartTrafficRoadAlerts') || '[]') } catch { return [] }
  })
  const [trafficOverlayOn, setTrafficOverlayOn] = useState(true)

  const [searchingSource, setSearchingSource] = useState(false)
  const [searchingDestination, setSearchingDestination] = useState(false)
  const [loadingRoute, setLoadingRoute] = useState(false)
  const [activePanel, setActivePanel] = useState('routes')
  const [isNavigating, setIsNavigating] = useState(false)
  const [currentPosition, setCurrentPosition] = useState(null)
  const [gpsStatus, setGpsStatus] = useState('GPS not started')
  const [navigationInstruction, setNavigationInstruction] = useState('Follow the highlighted route')
  const [remainingDistance, setRemainingDistance] = useState(null)
  const [remainingMinutes, setRemainingMinutes] = useState(null)

  // Favourite places
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('trafficFavorites') || '[]')
    } catch {
      return []
    }
  })

  // Recent trips
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('trafficRecentSearches') || '[]')
    } catch {
      return []
    }
  })

  // Prediction history
  const [predictionHistory, setPredictionHistory] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem('trafficPredictionHistory') || '[]'
      )
    } catch {
      return []
    }
  })

  // Initialise map
  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [77.1, 28.6],
      zoom: 9
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    mapRef.current = map

    return () => {
      if (gpsWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current)
      }
      markersRef.current.forEach(marker => marker.remove())
      gpsMarkerRef.current?.remove()
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
  // FAVOURITES AND RECENT TRIPS
  // =========================

  const saveFavorites = (items) => {
    setFavorites(items)
    localStorage.setItem('trafficFavorites', JSON.stringify(items))
  }

  const addFavorite = (place, label) => {
    if (!place) return

    const exists = favorites.some(
      item =>
        item.label === label &&
        item.lat === place.lat &&
        item.lon === place.lon
    )

    if (exists) {
      alert('This favourite is already saved.')
      return
    }

    saveFavorites([
      ...favorites,
      {
        label,
        name: place.display_name,
        lat: String(place.lat),
        lon: String(place.lon)
      }
    ])
  }

  const removeFavorite = (index) => {
    saveFavorites(favorites.filter((_, i) => i !== index))
  }

  const saveRecentTrip = (from, to) => {
    const trip = {
      source: from,
      destination: to,
      savedAt: new Date().toISOString()
    }

    const updated = [
      trip,
      ...recentSearches.filter(
        item => item.source !== from || item.destination !== to
      )
    ].slice(0, 10)

    setRecentSearches(updated)
    localStorage.setItem('trafficRecentSearches', JSON.stringify(updated))
  }

  const useRecentTrip = (trip) => {
    setSource(trip.source)
    setDestination(trip.destination)
    setSelectedSource(null)
    setSelectedDestination(null)
    setSourceResults([])
    setDestinationResults([])
  }

  const useFavoriteAsSource = (place) => {
    setSource(place.name)
    setSelectedSource({
      display_name: place.name,
      lat: place.lat,
      lon: place.lon
    })
    setSourceResults([])
  }

  const useFavoriteAsDestination = (place) => {
    setDestination(place.name)
    setSelectedDestination({
      display_name: place.name,
      lat: place.lat,
      lon: place.lon
    })
    setDestinationResults([])
  }

  // =========================
  // PREDICTION HISTORY
  // =========================

  const clearPredictionHistory = () => {
    setPredictionHistory([])
    localStorage.removeItem('trafficPredictionHistory')
  }

  const recordPrediction = ({
    from,
    to,
    distanceKm,
    durationMin,
    prediction
  }) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: from,
      destination: to,
      distance: Number(distanceKm),
      duration: Number(durationMin),
      traffic:
        prediction?.label ||
        prediction?.traffic ||
        prediction?.prediction ||
        'Unknown',
      savedAt: new Date().toISOString()
    }

    setPredictionHistory(previous => {
      const updated = [entry, ...previous].slice(0, 50)
      localStorage.setItem(
        'trafficPredictionHistory',
        JSON.stringify(updated)
      )
      return updated
    })
  }

  // =========================
  // DRAW / SELECT A ROUTE
  // =========================

  const displayRouteOnMap = (route, trafficData = traffic) => {
    const map = mapRef.current
    if (!map || !route?.coordinates?.length) return

    const routeGeoJSON = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: route.coordinates
      }
    }

    const trafficValue = Number(
      trafficData?.prediction ?? trafficData?.class_id ?? -1
    )

    const lineColor =
      trafficValue === 2
        ? '#ef4444'
        : trafficValue === 1
          ? '#f59e0b'
          : '#22c55e'

    const drawRoute = () => {
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

      const bounds = new maplibregl.LngLatBounds()
      route.coordinates.forEach(coord => bounds.extend(coord))
      map.fitBounds(bounds, { padding: 80, maxZoom: 15 })
    }

    if (map.isStyleLoaded()) {
      drawRoute()
    } else {
      map.once('load', drawRoute)
    }
  }

  const selectRoute = (route, index) => {
    setSelectedRouteIndex(index)
    setDistance(route.distance)
    setDuration(route.duration)
    displayRouteOnMap(route)
  }

  // =========================
  // LIVE GPS NAVIGATION
  // =========================

  const getCurrentGpsPosition = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser does not support GPS location.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      position => resolve(position),
      error => reject(new Error(
        error.code === 1 ? 'Location permission was denied. Allow location access in your browser.' :
        error.code === 2 ? 'Your current location could not be determined. Try again outdoors.' :
        'GPS request timed out. Please try again.'
      )),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    )
  })

  const haversineMeters = (a, b) => {
    const toRad = value => value * Math.PI / 180
    const dLat = toRad(Number(b[1]) - Number(a[1]))
    const dLon = toRad(Number(b[0]) - Number(a[0]))
    const lat1 = toRad(Number(a[1]))
    const lat2 = toRad(Number(b[1]))
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  }

  const updateGpsMarkerAndCamera = (position) => {
    const coords = [position.coords.longitude, position.coords.latitude]
    lastGpsRef.current = coords
    setCurrentPosition({ lon: coords[0], lat: coords[1], accuracy: position.coords.accuracy })
    setGpsStatus(`GPS accuracy ±${Math.round(position.coords.accuracy || 0)} m`)

    const map = mapRef.current
    if (!map) return
    if (!gpsMarkerRef.current) {
      const element = document.createElement('div')
      element.className = 'gps-position-marker'
      element.setAttribute('aria-label', 'Your vehicle location')
      element.innerHTML = '<span class="car-marker-halo"></span><span class="car-marker-icon"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 22l3.2-8.2A4 4 0 0 1 19 11h10a4 4 0 0 1 3.8 2.8L36 22l3.2 3.1A4 4 0 0 1 40.5 28v9a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-2H14.5v2a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-9a4 4 0 0 1 1.3-2.9L12 22z" fill="#2478f2" stroke="white" stroke-width="2.5"/><path d="M17 15h14l2.5 7h-19z" fill="#dcecff"/><circle cx="14" cy="28" r="2" fill="white"/><circle cx="34" cy="28" r="2" fill="white"/></svg></span>'
      gpsMarkerRef.current = new maplibregl.Marker({ element, anchor: 'center', rotationAlignment: 'map' }).setLngLat(coords).addTo(map)
    } else {
      gpsMarkerRef.current.setLngLat(coords)
    }

    if (isNavigatingRef.current) {
      // Keep the vehicle in view like a phone navigation app. Use GPS heading
      // when available, otherwise keep the current map bearing until heading arrives.
      const gpsHeading = position.coords.heading
      const bearing = Number.isFinite(gpsHeading) && gpsHeading >= 0 ? gpsHeading : map.getBearing()
      gpsMarkerRef.current?.setRotation?.(0)
      map.easeTo({
        center: coords,
        zoom: 17.5,
        bearing,
        pitch: 55,
        duration: 650,
        essential: true
      })

      const activeRoute = routes[selectedRouteIndex]
      if (activeRoute?.coordinates?.length) {
        let nearestIndex = 0
        let nearestMeters = Infinity
        activeRoute.coordinates.forEach((point, index) => {
          const meters = haversineMeters(coords, point)
          if (meters < nearestMeters) { nearestMeters = meters; nearestIndex = index }
        })
        const steps = activeRoute.steps || []
        const nextStep = steps.find(step => Array.isArray(step.way_points) && step.way_points[1] >= nearestIndex)
        if (nextStep?.instruction) setNavigationInstruction(nextStep.instruction)
        const totalPoints = activeRoute.coordinates.length
        const progress = totalPoints > 1 ? nearestIndex / (totalPoints - 1) : 0
        setRemainingDistance((Number(activeRoute.distance) * (1 - progress)).toFixed(1))
        setRemainingMinutes(Math.max(0, Math.round(Number(activeRoute.duration) * (1 - progress))))

        // Basic off-route detection; wait 30 seconds between reroute requests.
        if (nearestMeters > 250 && Date.now() - lastRerouteAtRef.current > 30000 && selectedDestination) {
          lastRerouteAtRef.current = Date.now()
          const gpsPlace = { display_name: 'Current GPS location', lat: coords[1], lon: coords[0] }
          setSource('Current GPS location')
          setSelectedSource(gpsPlace)
          generateRoute(gpsPlace, true)
        }
      }
    }
  }

  const startNavigation = async () => {
    if (!selectedDestination) {
      alert('Search and select a destination first.')
      return
    }
    try {
      setGpsStatus('Getting GPS location…')
      const position = await getCurrentGpsPosition()
      const gpsPlace = {
        display_name: 'Current GPS location',
        lat: position.coords.latitude,
        lon: position.coords.longitude
      }
      setSource('Current GPS location')
      setSelectedSource(gpsPlace)
      isNavigatingRef.current = true
      setIsNavigating(true)
      updateGpsMarkerAndCamera(position)
      await generateRoute(gpsPlace)
      if (navigator.geolocation && gpsWatchIdRef.current === null) {
        gpsWatchIdRef.current = navigator.geolocation.watchPosition(
          updateGpsMarkerAndCamera,
          error => setGpsStatus(error.code === 1 ? 'GPS permission denied' : 'GPS signal unavailable'),
          { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
        )
      }
    } catch (error) {
      isNavigatingRef.current = false
      setIsNavigating(false)
      setGpsStatus('GPS unavailable')
      alert(error.message || 'Could not start GPS navigation.')
    }
  }

  const stopNavigation = () => {
    isNavigatingRef.current = false
    setIsNavigating(false)
    setNavigationInstruction('Navigation ended')
    setRemainingDistance(null)
    setRemainingMinutes(null)
    if (gpsWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current)
      gpsWatchIdRef.current = null
    }
    const map = mapRef.current
    if (map) map.easeTo({ pitch: 0, bearing: 0, duration: 500 })
  }

  // =========================
  // GENERATE ROUTE
  // =========================

  const generateRoute = async (sourceOverride = null, isReroute = false) => {
    const routeSource = sourceOverride || selectedSource

    if (!routeSource || !selectedDestination) {
      alert('Please select both a starting point and a destination before finding a route.')
      return
    }

    const apiKey = import.meta.env.VITE_ORS_API_KEY
    const weatherKey = import.meta.env.VITE_OPENWEATHER_API_KEY

    if (!apiKey) {
      alert('OpenRouteService API key is missing. Add VITE_ORS_API_KEY to frontend/.env and restart the frontend.')
      return
    }

    const sourceCoords = [Number(routeSource.lon), Number(routeSource.lat)]
    const destCoords = [Number(selectedDestination.lon), Number(selectedDestination.lat)]

    if (![...sourceCoords, ...destCoords].every(Number.isFinite)) {
      alert('Invalid location coordinates. Please search for each place and select a result from the dropdown.')
      return
    }

    setLoadingRoute(true)
    try {
      const routeRes = await axios.post(
        'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
        {
          coordinates: [sourceCoords, destCoords],
          alternative_routes: { target_count: 3, share_factor: 0.6, weight_factor: 1.4 }
        },
        { headers: { Authorization: apiKey, 'Content-Type': 'application/json' } }
      )

      const features = (routeRes.data.features || []).filter(
        feature => feature?.geometry?.coordinates?.length && feature?.properties?.summary
      )
      if (!features.length) throw new Error('No drivable route found. Try different locations.')

      const actualRoutes = features.map((feature, index) => ({
        id: index,
        name: index === 0 ? 'Recommended Route' : `Alternative ${index}`,
        distance: (feature.properties.summary.distance / 1000).toFixed(1),
        duration: (feature.properties.summary.duration / 60).toFixed(0),
        coordinates: feature.geometry.coordinates,
        steps: (feature.properties.segments || []).flatMap(segment => segment.steps || [])
      }))

      setRoutes(actualRoutes)
      setSelectedRouteIndex(0)
      const initialRoute = actualRoutes[0]
      setDistance(initialRoute.distance)
      setDuration(initialRoute.duration)
      // Draw the actual route immediately. Weather or AI failures must not block routing.
      displayRouteOnMap(initialRoute, traffic)
      setNavigationInstruction(isReroute ? 'Route updated. Continue on the new route.' : 'Follow the highlighted route')

      // Weather and AI prediction are optional enhancements, not prerequisites for route display.
      try {
        if (!weatherKey) throw new Error('Weather API key is not configured')
        const weatherRes = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
          params: { lat: destCoords[1], lon: destCoords[0], appid: weatherKey }
        })
        const weatherData = weatherRes.data
        const rain = weatherData.rain?.['1h'] || 0
        setWeather({
          temp: (weatherData.main.temp - 273.15).toFixed(1),
          humidity: weatherData.main.humidity,
          clouds: weatherData.clouds.all,
          rain
        })

        const now = new Date()
        const day = now.getDay()
        const predictRes = await axios.post(`${API_BASE}/predict`, {
          temp: weatherData.main.temp,
          rain_1h: rain,
          snow_1h: weatherData.snow?.['1h'] || 0,
          clouds_all: weatherData.clouds.all,
          hour: now.getHours(),
          day_of_week: day,
          month: now.getMonth() + 1,
          is_weekend: [0, 6].includes(day) ? 1 : 0,
          rush_hour: [7, 8, 9, 17, 18, 19].includes(now.getHours()) ? 1 : 0
        })
        setTraffic(predictRes.data)
        displayRouteOnMap(initialRoute, predictRes.data)
        recordPrediction({
          from: routeSource.display_name,
          to: selectedDestination.display_name,
          distanceKm: initialRoute.distance,
          durationMin: initialRoute.duration,
          prediction: predictRes.data
        })
      } catch (predictionError) {
        console.warn('Route found, but weather/AI prediction is unavailable:', predictionError.message)
        setTraffic(null)
      }

      saveRecentTrip(routeSource.display_name, selectedDestination.display_name)
      console.log(`Received ${actualRoutes.length} real route(s).`)
    } catch (error) {
      console.error('Route generation error:', error)
      const status = error.response?.status
      const apiMessage = error.response?.data?.error?.message || error.response?.data?.message || error.response?.data?.detail
      const message = status === 401 || status === 403
        ? 'OpenRouteService rejected the API key. Check VITE_ORS_API_KEY in frontend/.env.'
        : status === 429
          ? 'Route service rate limit reached. Please wait a little and try again.'
          : apiMessage || error.message || 'Route search failed. Check your internet connection and API key.'
      alert(message)
    } finally {
      setLoadingRoute(false)
    }
  }

  const submitRoadAlert = () => {
    if (!currentPosition && !selectedSource && !selectedDestination) {
      alert('Select a location or enable GPS before reporting a road issue.')
      return
    }
    const coords = currentPosition
      ? [currentPosition.lon ?? currentPosition.longitude ?? currentPosition.coords?.longitude, currentPosition.lat ?? currentPosition.latitude ?? currentPosition.coords?.latitude]
      : [Number((selectedSource || selectedDestination).lon), Number((selectedSource || selectedDestination).lat)]
    const alertItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: alertType,
      note: alertNote.trim(),
      coords,
      location: currentPosition ? 'Current GPS location' : (selectedSource || selectedDestination).display_name,
      createdAt: new Date().toISOString(),
      status: 'Community report'
    }
    const updated = [alertItem, ...roadAlerts].slice(0, 50)
    setRoadAlerts(updated)
    localStorage.setItem('smartTrafficRoadAlerts', JSON.stringify(updated))
    if (mapRef.current && coords.every(Number.isFinite)) {
      const markerEl = document.createElement('div')
      markerEl.className = 'road-alert-map-marker'
      markerEl.textContent = alertType === 'Accident' ? '⚠' : alertType === 'Roadwork' ? '🚧' : alertType === 'Waterlogging' ? '🌧' : '🕳'
      new maplibregl.Marker({ element: markerEl, anchor: 'bottom' }).setLngLat(coords).setPopup(new maplibregl.Popup({ offset: 18 }).setText(`${alertType}: ${alertNote.trim() || 'Community report'} · ${new Date().toLocaleString()}`)).addTo(mapRef.current)
    }
    setAlertNote('')
    alert('Road alert saved on this device. It has not been sent to a public/live traffic service.')
  }

  const removeRoadAlert = (id) => {
    const updated = roadAlerts.filter(item => item.id !== id)
    setRoadAlerts(updated)
    localStorage.setItem('smartTrafficRoadAlerts', JSON.stringify(updated))
  }

  // =========================
  // ANALYTICS VALUES
  // =========================

  const highTrafficCount = predictionHistory.filter(item =>
    String(item.traffic).toLowerCase().includes('high')
  ).length

  const averageDistance = predictionHistory.length
    ? (
        predictionHistory.reduce(
          (sum, item) => sum + (Number(item.distance) || 0),
          0
        ) / predictionHistory.length
      ).toFixed(1)
    : '0.0'

  const averageDuration = predictionHistory.length
    ? Math.round(
        predictionHistory.reduce(
          (sum, item) => sum + (Number(item.duration) || 0),
          0
        ) / predictionHistory.length
      )
    : 0

  return (
    <div className="map-app">
      {/* Full-screen map */}
      <div ref={mapContainer} className="map-container" />

      {/* Floating search panel */}
      <section className="map-top-panel">
        <div className="brand-row">
          <div className="brand-icon">🚦</div>
          <div className="brand-copy">
            <h1>Smart Traffic AI</h1>
            <p>Delhi-NCR route planner</p>
          </div>
        </div>

        <div className="search-stack">
          <div className="search-line">
            <span className="location-dot source-dot" />
            <input
              className="map-search-input"
              placeholder="Choose starting point"
              value={source}
              onChange={e => {
                setSource(e.target.value)
                setSelectedSource(null)
                setSourceResults([])
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSourceSearch()
              }}
            />
            <button
              className="search-action"
              onClick={handleSourceSearch}
              disabled={searchingSource}
              title="Search starting point"
            >
              {searchingSource ? '…' : '↵'}
            </button>
          </div>

          <div className="search-divider" />

          <div className="search-line">
            <span className="location-dot destination-dot" />
            <input
              className="map-search-input"
              placeholder="Choose destination"
              value={destination}
              onChange={e => {
                setDestination(e.target.value)
                setSelectedDestination(null)
                setDestinationResults([])
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') handleDestinationSearch()
              }}
            />
            <button
              className="search-action"
              onClick={handleDestinationSearch}
              disabled={searchingDestination}
              title="Search destination"
            >
              {searchingDestination ? '…' : '↵'}
            </button>
          </div>
        </div>

        <button className="gps-source-button" type="button" onClick={async () => {
          try {
            setGpsStatus('Getting GPS location…')
            const position = await getCurrentGpsPosition()
            const gpsPlace = { display_name: 'Current GPS location', lat: position.coords.latitude, lon: position.coords.longitude }
            setSource('Current GPS location')
            setSelectedSource(gpsPlace)
            updateGpsMarkerAndCamera(position)
            setGpsStatus('Current location selected')
          } catch (error) {
            setGpsStatus('GPS unavailable')
            alert(error.message)
          }
        }}>◎ Use my current location</button>

        {(selectedSource || selectedDestination) && (
          <div className="selection-note">
            {selectedSource ? '✓ Start selected' : 'Select a starting point'}
            {' · '}
            {selectedDestination ? '✓ Destination selected' : 'Select a destination'}
          </div>
        )}

        {sourceResults.length > 0 && (
          <div className="floating-results">
            <strong>Choose starting point</strong>
            {sourceResults.map((place, index) => (
              <button
                type="button"
                className="search-result"
                key={`${place.lat}-${place.lon}-${index}`}
                onClick={() => chooseSource(place)}
              >
                <span>📍</span>
                <span>{place.display_name}</span>
              </button>
            ))}
          </div>
        )}

        {destinationResults.length > 0 && (
          <div className="floating-results">
            <strong>Choose destination</strong>
            {destinationResults.map((place, index) => (
              <button
                type="button"
                className="search-result"
                key={`${place.lat}-${place.lon}-${index}`}
                onClick={() => chooseDestination(place)}
              >
                <span>📍</span>
                <span>{place.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Floating navigation */}
      <nav className="map-toolbar">
        <button
          className={`map-chip ${activePanel === 'routes' ? 'map-chip-active' : ''}`}
          onClick={() => setActivePanel('routes')}
        >
          <span>↗</span> Routes
        </button>
        <button
          className={`map-chip ${activePanel === 'analytics' ? 'map-chip-active' : ''}`}
          onClick={() => setActivePanel('analytics')}
        >
          <span>▥</span> Analytics
        </button>
        <button
          className={`map-chip ${activePanel === 'saved' ? 'map-chip-active' : ''}`}
          onClick={() => setActivePanel('saved')}
        >
          <span>♡</span> Saved
        </button>
        <button
          className={`map-chip ${activePanel === 'traffic' ? 'map-chip-active' : ''}`}
          onClick={() => setActivePanel('traffic')}
        >
          <span>◉</span> Traffic AI
        </button>
        <button
          className={`map-chip ${activePanel === 'alerts' ? 'map-chip-active' : ''}`}
          onClick={() => setActivePanel('alerts')}
        >
          <span>⚠</span> Road alerts
        </button>
      </nav>

      {isNavigating && (
        <section className="navigation-guidance" aria-live="polite">
          <div className="navigation-turn-icon">↱</div>
          <div className="navigation-guidance-copy">
            <strong>{navigationInstruction}</strong>
            <span>{gpsStatus}</span>
          </div>
          <button type="button" className="navigation-stop-button" onClick={stopNavigation}>End</button>
        </section>
      )}

      {/* Expandable details panel */}
      {activePanel && (
        <section className="map-details-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-eyebrow">SMART TRAFFIC AI</p>
              <h2>
                {activePanel === 'routes' && 'Your journey'}
                {activePanel === 'analytics' && 'Trip analytics'}
                {activePanel === 'saved' && 'Saved places & trips'}
                {activePanel === 'traffic' && 'Traffic intelligence'}
                {activePanel === 'alerts' && 'Road alerts & safety'}
              </h2>
            </div>
            <button
              className="icon-button"
              onClick={() => setActivePanel(null)}
              aria-label="Close panel"
            >
              ✕
            </button>
          </div>

          <div className="panel-content">
            {activePanel === 'routes' && (
              <>
                <button
                  className="primary-action"
                  onClick={() => generateRoute()}
                  disabled={loadingRoute}
                >
                  {loadingRoute ? 'Finding routes…' : '↗ Find best route'}
                </button>

                <button
                  className="start-navigation-action"
                  onClick={startNavigation}
                  disabled={loadingRoute || !selectedDestination}
                >
                  {isNavigating ? '● Navigation running' : '▶ Start live navigation'}
                </button>

                {routes.length > 0 ? (
                  <>
                    <div className="panel-section-title">
                      Available routes ({routes.length})
                    </div>
                    {routes.map((route, index) => (
                      <button
                        type="button"
                        key={route.id}
                        className={`modern-route-card ${
                          selectedRouteIndex === index ? 'route-card-selected' : ''
                        }`}
                        onClick={() => selectRoute(route, index)}
                      >
                        <div className="route-card-top">
                          <strong>
                            {index === 0 ? 'Recommended route' : `Alternative ${index}`}
                          </strong>
                          {selectedRouteIndex === index && (
                            <span className="recommended-tag">Selected</span>
                          )}
                        </div>
                        <div className="route-card-metrics">
                          <span>◷ {route.duration} min</span>
                          <span>↔ {route.distance} km</span>
                        </div>
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="panel-empty">
                    <div className="empty-icon">↗</div>
                    <strong>Ready to hit the road?</strong>
                    <p>Choose your starting point and destination, then find your route.</p>
                  </div>
                )}

                {traffic && (
                  <div className="weather-strip">
                    <div>
                      <span>Traffic prediction</span>
                      <strong>
                        {traffic.label || traffic.traffic || traffic.prediction || 'Unavailable'}
                      </strong>
                    </div>
                    {weather && (
                      <div>
                        <span>Destination weather</span>
                        <strong>{weather.temp}°C</strong>
                      </div>
                    )}
                  </div>
                )}

                <p className="panel-footnote">
                  Predictions use weather and time inputs from your model; this is not a live traffic feed.
                </p>
              </>
            )}

            {activePanel === 'analytics' && (
              <>
                <div className="analytics-grid">
                  <div className="analytics-stat">
                    <span>Total predictions</span>
                    <strong>{predictionHistory.length}</strong>
                  </div>
                  <div className="analytics-stat">
                    <span>High traffic</span>
                    <strong>{highTrafficCount}</strong>
                  </div>
                  <div className="analytics-stat">
                    <span>Average distance</span>
                    <strong>{averageDistance} km</strong>
                  </div>
                  <div className="analytics-stat">
                    <span>Average ETA</span>
                    <strong>{averageDuration} min</strong>
                  </div>
                </div>

                <div className="panel-section-title">Prediction breakdown</div>
                {['Low', 'Medium', 'High'].map(level => {
                  const count = predictionHistory.filter(item =>
                    String(item.traffic).toLowerCase().includes(level.toLowerCase())
                  ).length
                  const percentage = predictionHistory.length
                    ? Math.round((count / predictionHistory.length) * 100)
                    : 0

                  return (
                    <div className="distribution-row" key={level}>
                      <div className="distribution-label">
                        <span>{level} traffic</span>
                        <strong>{percentage}%</strong>
                      </div>
                      <div className="distribution-track">
                        <div
                          className={`distribution-fill distribution-${level.toLowerCase()}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}

                <div className="panel-section-title">Recent predictions</div>
                {predictionHistory.length === 0 ? (
                  <p className="panel-footnote">
                    Your prediction history will appear here after you generate a route.
                  </p>
                ) : (
                  predictionHistory.slice(0, 8).map(item => (
                    <div className="saved-list-item" key={item.id}>
                      <div>
                        <strong>{String(item.traffic)} traffic</strong>
                        <p>{item.source} → {item.destination}</p>
                        <small>{item.distance} km · {item.duration} min</small>
                      </div>
                    </div>
                  ))
                )}

                <button
                  className="secondary-action"
                  onClick={clearPredictionHistory}
                  disabled={predictionHistory.length === 0}
                >
                  Clear prediction history
                </button>
              </>
            )}

            {activePanel === 'traffic' && (
              <>
                <div className="traffic-status-card">
                  <div className="traffic-status-top"><span className="traffic-status-dot" /><strong>{traffic ? (traffic.label || traffic.traffic || `Class ${traffic.prediction}`) : 'Waiting for route prediction'}</strong></div>
                  <p>{traffic ? 'AI model output for the current route inputs.' : 'Find a route to run your existing traffic prediction model.'}</p>
                  <small>Model prediction · Not a verified live traffic feed</small>
                </div>
                <div className="panel-section-title">Route traffic legend</div>
                <div className="traffic-legend">
                  <span><i className="legend-green" /> Low</span>
                  <span><i className="legend-amber" /> Moderate</span>
                  <span><i className="legend-red" /> High</span>
                </div>
                <button className="secondary-action" onClick={() => { setTrafficOverlayOn(!trafficOverlayOn); const map = mapRef.current; if (map?.getLayer('route')) map.setLayoutProperty('route', 'visibility', trafficOverlayOn ? 'none' : 'visible') }}>
                  {trafficOverlayOn ? 'Hide route traffic overlay' : 'Show route traffic overlay'}
                </button>
                <div className="panel-section-title">Forecast horizon</div>
                <div className="forecast-grid">
                  {['15 min', '30 min', '60 min'].map(horizon => <div className="forecast-tile" key={horizon}><strong>{horizon}</strong><span>{traffic ? 'Current model class' : 'No prediction yet'}</span><small>{traffic ? (traffic.label || traffic.traffic || `Class ${traffic.prediction}`) : 'Run route prediction'}</small></div>)}
                </div>
                <p className="panel-footnote">These tiles currently repeat the present model classification as a baseline. True future forecasts require a time-series forecasting endpoint; this app does not claim these are independently predicted future values.</p>
                <div className="panel-section-title">Live traffic provider</div>
                <p className="panel-footnote">A real road-by-road heatmap needs a traffic provider/API. The current map uses OpenFreeMap basemap and OpenRouteService routing, neither of which by itself supplies a verified Delhi-NCR live traffic heatmap here.</p>
              </>
            )}

            {activePanel === 'alerts' && (
              <>
                <div className="alert-disclaimer">Community reports are stored on this device only. They are not broadcast to other drivers or verified by a traffic authority.</div>
                <label className="alert-form-label" htmlFor="road-alert-type">Report type</label>
                <select id="road-alert-type" className="alert-form-control" value={alertType} onChange={e => setAlertType(e.target.value)}>
                  <option>Accident</option><option>Roadwork</option><option>Waterlogging</option><option>Pothole</option><option>Road closure</option><option>Other hazard</option>
                </select>
                <label className="alert-form-label" htmlFor="road-alert-note">Details (optional)</label>
                <textarea id="road-alert-note" className="alert-form-control alert-note" placeholder="e.g. left lane blocked near the crossing" value={alertNote} onChange={e => setAlertNote(e.target.value)} rows={3} />
                <button className="primary-action" onClick={submitRoadAlert}>＋ Report road issue</button>
                <div className="panel-section-title">Recent reports ({roadAlerts.length})</div>
                {roadAlerts.length === 0 ? <div className="panel-empty"><div className="empty-icon">⚠</div><strong>No reports yet</strong><p>Reports you add will appear here and be pinned on the map.</p></div> : roadAlerts.slice(0, 10).map(item => <div className="road-alert-item" key={item.id}><div className="road-alert-icon">{item.type === 'Accident' ? '⚠️' : item.type === 'Roadwork' ? '🚧' : item.type === 'Waterlogging' ? '🌧️' : '🕳️'}</div><div className="road-alert-copy"><strong>{item.type}</strong><p>{item.note || item.location}</p><small>{new Date(item.createdAt).toLocaleString()} · Device-only report</small></div><button className="alert-remove" onClick={() => removeRoadAlert(item.id)} aria-label="Delete report">×</button></div>)}
              </>
            )}

            {activePanel === 'saved' && (
              <>
                <div className="panel-section-title">Favourite places</div>

                {selectedSource && (
                  <button
                    className="secondary-action"
                    onClick={() => {
                      const label = window.prompt(
                        'Save source as (e.g. Home, College, Office):'
                      )
                      if (label?.trim()) addFavorite(selectedSource, label.trim())
                    }}
                  >
                    ♡ Save starting point
                  </button>
                )}

                {selectedDestination && (
                  <button
                    className="secondary-action"
                    onClick={() => {
                      const label = window.prompt(
                        'Save destination as (e.g. Home, College, Office):'
                      )
                      if (label?.trim()) addFavorite(selectedDestination, label.trim())
                    }}
                  >
                    ♡ Save destination
                  </button>
                )}

                {favorites.length === 0 ? (
                  <p className="panel-footnote">Your favourite places will appear here.</p>
                ) : (
                  favorites.map((place, index) => (
                    <div
                      className="saved-list-item"
                      key={`${place.lat}-${place.lon}-${index}`}
                    >
                      <div>
                        <strong>♡ {place.label}</strong>
                        <p>{place.name}</p>
                        <div className="saved-item-actions">
                          <button onClick={() => useFavoriteAsSource(place)}>
                            Use as start
                          </button>
                          <button onClick={() => useFavoriteAsDestination(place)}>
                            Use as destination
                          </button>
                          <button onClick={() => removeFavorite(index)}>Remove</button>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                <div className="panel-section-title">Recent trips</div>
                {recentSearches.length === 0 ? (
                  <p className="panel-footnote">Completed trips will appear here.</p>
                ) : (
                  recentSearches.map((trip, index) => (
                    <button
                      type="button"
                      className="saved-list-item saved-trip-button"
                      key={`${trip.savedAt}-${index}`}
                      onClick={() => useRecentTrip(trip)}
                    >
                      <div>
                        <strong>{trip.source}</strong>
                        <p>↓ {trip.destination}</p>
                        <small>Tap to reuse this trip</small>
                      </div>
                      <span>→</span>
                    </button>
                  ))
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* Bottom journey summary */}
      <section className="map-bottom-card">
        <div className="bottom-card-heading">
          <div className="bottom-route-icon">↗</div>
          <div className="bottom-route-title">
            <strong>
              {selectedSource && selectedDestination ? 'Your journey' : 'Plan your journey'}
            </strong>
            <span>
              {selectedSource && selectedDestination
                ? `${selectedSource.display_name.split(',')[0]} → ${
                    selectedDestination.display_name.split(',')[0]
                  }`
                : 'Select a start and destination'}
            </span>
          </div>
        </div>

        <div className="bottom-metrics">
          <div>
            <strong>{distance !== null ? `${distance} km` : '—'}</strong>
            <span>Distance</span>
          </div>
          <div>
            <strong>{duration !== null ? `${duration} min` : '—'}</strong>
            <span>Estimated time</span>
          </div>
          <div>
            <strong>
              {traffic
                ? traffic.label || traffic.traffic || traffic.prediction || '—'
                : '—'}
            </strong>
            <span>AI prediction</span>
          </div>
        </div>

        {isNavigating && (
          <div className="live-navigation-metrics">
            <div><strong>{remainingDistance ?? distance ?? '—'} km</strong><span>Remaining</span></div>
            <div><strong>{remainingMinutes ?? duration ?? '—'} min</strong><span>ETA</span></div>
            <span className="gps-live-indicator">● LIVE GPS</span>
          </div>
        )}

        <button
          className="bottom-action"
          onClick={isNavigating ? stopNavigation : (selectedDestination ? startNavigation : generateRoute)}
          disabled={loadingRoute}
        >
          {loadingRoute ? 'Finding…' : isNavigating ? 'End navigation' : selectedDestination ? 'Start navigation' : 'Find route'}
        </button>
      </section>
    </div>
  )
}

export default App
