// js/map.js
let map;
let currentData = null;

const mapConfig = {
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  center: [-3.7038, 40.4168],
  zoom: 13,
  attributionControl: false,
};

function initMap() {
  map = new maplibregl.Map(mapConfig);

  map.on("load", () => {
    setupLayers();
    animateEntrance();
  });
}

function setupLayers() {
  // Sources and layers will be added dynamically when searching
  map.addSource("osm-data", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  // Buildings
  map.addLayer({
    id: "buildings-layer",
    type: "fill",
    source: "osm-data",
    filter: ["has", "building"],
    paint: {
      "fill-color": "#000",
      "fill-opacity": 0.1,
    },
  });

  // Water
  map.addLayer({
    id: "water-layer",
    type: "fill",
    source: "osm-data",
    filter: ["any", ["has", "waterway"], ["has", "natural"]],
    paint: {
      "fill-color": "#3b82f6",
      "fill-opacity": 0.4,
    },
  });

  // Streets
  map.addLayer({
    id: "streets-layer",
    type: "line",
    source: "osm-data",
    filter: ["has", "highway"],
    layout: {
      "line-join": "round",
      "line-cap": "round",
    },
    paint: {
      "line-color": "#94a3b8",
      "line-width": 2,
    },
  });
}

async function searchCity() {
  const query = document.getElementById("cityInput").value;
  if (!query) return;

  showLoading(true);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&limit=1`
    );
    const data = await res.json();

    if (data && data.length > 0) {
      const { lat, lon, boundingbox } = data[0];
      const bounds = [
        [parseFloat(boundingbox[2]), parseFloat(boundingbox[0])], // sw [lon, lat]
        [parseFloat(boundingbox[3]), parseFloat(boundingbox[1])], // ne [lon, lat]
      ];

      map.fitBounds(bounds, { padding: 50, duration: 2000 });
      await fetchData(bounds);
    } else {
      alert("Ciudad no encontrada.");
    }
  } catch (err) {
    console.error(err);
    alert("Error al buscar ciudad.");
  } finally {
    showLoading(false);
  }
}

async function fetchData(bounds) {
  showLoading(true);
  updateStatus("Analizando áreas vectoriales...", 0);

  // MapLibre bounds are [ [minLon, minLat], [maxLon, maxLat] ]
  const west = bounds[0][0];
  const south = bounds[0][1];
  const east = bounds[1][0];
  const north = bounds[1][1];

  const query = `
        [out:json][timeout:25];
        (
          way["highway"](${south},${west},${north},${east});
          way["building"](${south},${west},${north},${east});
          way["natural"="water"](${south},${west},${north},${east});
        );
        out geom;
    `;

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
    });
    const data = await res.json();

    if (data.elements) {
      currentData = osmtogeojson(data);
      map.getSource("osm-data").setData(currentData);
      updateStatus("Mapa procesado con éxito", 100);
    }
  } catch (err) {
    console.error("Fetch failed", err);
  } finally {
    showLoading(false);
  }
}

function showLoading(show) {
  const el = document.getElementById("loadingOverlay");
  if (show) gsap.to(el, { autoAlpha: 1, duration: 0.3, display: "flex" });
  else gsap.to(el, { autoAlpha: 0, duration: 0.3, display: "none" });
}

function updateStatus(text, percent) {
  document.getElementById("statusText").textContent = text;
  document.getElementById("overlayStatus").textContent = text;
  const pContainer = document.getElementById("progressContainer");
  const pBar = document.getElementById("progressBar");

  pContainer.style.display = "block";
  pBar.style.width = percent + "%";
}

function animateEntrance() {
  gsap.from("aside", { x: -400, duration: 1, ease: "expo.out" });
  gsap.from(".relative.group", {
    opacity: 0,
    y: 20,
    duration: 0.8,
    delay: 0.5,
  });
}

window.onload = initMap;
