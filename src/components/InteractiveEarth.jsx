import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { LocateFixed, RotateCcw, Play, Pause, Sparkles, Navigation } from 'lucide-react';

// Convert Latitude and Longitude to 3D Cartesian coordinates on sphere
function latLonToVector3(lat, lon, radius = 2.0) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// Major global weather cities for global intelligence feel
const GLOBAL_HUBS = [
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503, temp: '19°C' },
  { name: 'London', lat: 51.5074, lon: -0.1278, temp: '14°C' },
  { name: 'New York', lat: 40.7128, lon: -74.0060, temp: '16°C' },
  { name: 'Dubai', lat: 25.2048, lon: 55.2708, temp: '32°C' },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093, temp: '21°C' },
  { name: 'Cairo', lat: 30.0444, lon: 31.2357, temp: '26°C' },
];

/**
 * Generate a procedural high-resolution Earth texture on an HTML5 canvas.
 * Renders realistic oceans, continents, terrain, and lat/lon coordinate grid.
 */
function createProceduralEarthCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // 1. Deep Ocean Base with Radial / Depth Gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, H);
  oceanGrad.addColorStop(0, '#0a1d37');    // Arctic
  oceanGrad.addColorStop(0.2, '#08254b');
  oceanGrad.addColorStop(0.5, '#0b356b');  // Equator warm deep blue
  oceanGrad.addColorStop(0.8, '#08254b');
  oceanGrad.addColorStop(1, '#0a1d37');    // Antarctic
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, W, H);

  // Helper to project Lat/Lon to Canvas X, Y
  const p = (lat, lon) => {
    const x = ((lon + 180) / 360) * W;
    const y = ((90 - lat) / 180) * H;
    return [x, y];
  };

  const drawPoly = (coords, fill, stroke = null) => {
    ctx.beginPath();
    coords.forEach(([lat, lon], idx) => {
      const [x, y] = p(lat, lon);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  // 2. Continental outlines (accurate key landmass geometries)
  // Eurasia (Europe + Asia + India)
  const eurasia = [
    [70, 20], [72, 60], [75, 100], [72, 140], [65, 170], [60, 160], [55, 135],
    [45, 130], [35, 125], [22, 115], [10, 105], [5, 100], [15, 95],
    // India sub-continent
    [22, 90], [20, 85], [12, 80], [8, 77], [13, 74], [20, 72], [24, 68],
    // Middle east & Mediterranean
    [25, 60], [15, 50], [12, 45], [28, 35], [35, 36], [40, 28], [36, 15],
    [36, -5], [43, -9], [48, -4], [52, 5], [55, 8], [60, 5], [68, 15]
  ];
  drawPoly(eurasia, '#1e5f38', '#144125');

  // Scandinavia
  const scandinavia = [[58, 5], [65, 12], [71, 26], [68, 30], [60, 22], [56, 12]];
  drawPoly(scandinavia, '#1b5632', '#144125');

  // British Isles
  const uk = [[50, -5], [55, -5], [58, -3], [54, 0], [50, 1]];
  drawPoly(uk, '#236b3f', '#144125');

  // Africa
  const africa = [
    [37, 10], [35, -5], [30, -10], [20, -17], [10, -14], [5, 2], [4, 9],
    [-5, 12], [-15, 12], [-25, 15], [-34, 18], [-34, 26], [-30, 31],
    [-20, 35], [-10, 40], [0, 42], [12, 51], [15, 42], [28, 33], [32, 32]
  ];
  drawPoly(africa, '#635327', '#423719'); // Sahara golden-olive tone

  // Africa savanna / central green belt
  const centralAfrica = [
    [10, -14], [5, 2], [4, 9], [-5, 12], [-15, 12], [-20, 25],
    [-15, 32], [-5, 38], [5, 35], [10, 20]
  ];
  drawPoly(centralAfrica, '#22693e');

  // Madagascar
  drawPoly([[-12, 49], [-16, 49], [-25, 47], [-25, 43], [-15, 46]], '#22693e');

  // North America
  const northAmerica = [
    [70, -160], [72, -130], [70, -90], [60, -65], [47, -53], [42, -70],
    [30, -81], [25, -80], [28, -96], [20, -97], [16, -93], [14, -86],
    [9, -79], [15, -95], [20, -105], [32, -117], [40, -124], [48, -125],
    [58, -136], [60, -148], [65, -168]
  ];
  drawPoly(northAmerica, '#255e39', '#154124');

  // Greenland
  const greenland = [[60, -45], [70, -25], [82, -30], [80, -65], [68, -55]];
  drawPoly(greenland, '#e8f1f5', '#b8c9d4');

  // South America
  const southAmerica = [
    [12, -72], [10, -62], [5, -52], [-5, -35], [-15, -39], [-23, -42],
    [-35, -55], [-45, -65], [-55, -68], [-52, -75], [-40, -73], [-30, -71],
    [-18, -70], [-5, -80], [0, -80], [8, -77]
  ];
  drawPoly(southAmerica, '#1c5e35', '#123f23');

  // Australia
  const australia = [
    [-12, 131], [-15, 136], [-12, 142], [-23, 151], [-32, 153], [-38, 148],
    [-38, 140], [-35, 117], [-28, 114], [-21, 114], [-15, 124]
  ];
  drawPoly(australia, '#8c672b', '#5c431b');

  // New Zealand
  drawPoly([[-35, 174], [-41, 175], [-46, 168], [-44, 169]], '#2a7243');

  // Japan
  drawPoly([[45, 142], [40, 140], [35, 136], [32, 130], [38, 138]], '#2a7243');

  // Antarctica
  const antarctica = [
    [-65, -180], [-68, -120], [-72, -60], [-64, -60], [-70, 0],
    [-66, 60], [-65, 120], [-68, 180], [-90, 180], [-90, -180]
  ];
  drawPoly(antarctica, '#f0f5fa', '#d4e1ec');

  // 3. Subtle Latitude & Longitude Coordinate Lines (Elegant Space Mesh)
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1.5;
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * H;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let lon = -150; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  // Equator Highlight
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();

  return canvas;
}

/**
 * Generate procedural cloud layer texture on canvas
 */
function createProceduralCloudsCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  // Soft atmospheric clouds bands
  const drawCloudPuff = (cx, cy, rx, ry, alpha) => {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    grad.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.5})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  // Tropical and mid-latitude cloud belts
  for (let i = 0; i < 45; i++) {
    const x = (i * 27 + 10) % W;
    const y = H * 0.45 + Math.sin(i * 1.3) * 60;
    drawCloudPuff(x, y, 70 + (i % 3) * 20, 25 + (i % 2) * 10, 0.25);
  }
  // Northern storm tracks
  for (let i = 0; i < 30; i++) {
    const x = (i * 37 + 50) % W;
    const y = H * 0.22 + Math.cos(i * 1.5) * 40;
    drawCloudPuff(x, y, 65 + (i % 2) * 15, 20, 0.2);
  }
  // Southern roaring forties
  for (let i = 0; i < 35; i++) {
    const x = (i * 31 + 80) % W;
    const y = H * 0.75 + Math.sin(i * 1.2) * 35;
    drawCloudPuff(x, y, 80 + (i % 3) * 20, 22, 0.22);
  }

  return canvas;
}

export default function InteractiveEarth({
  location = { lat: 13.1143, lon: 80.1548, city: 'Live Location' },
  weather = null,
}) {
  const mountRef = useRef(null);
  const [isRotating, setIsRotating] = useState(true);
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const earthGroupRef = useRef(null);
  const cloudsRef = useRef(null);
  const beaconRef = useRef(null);
  const pulseRef = useRef(null);
  const targetRotationRef = useRef({ x: 0.25, y: -1.2 });
  const cameraRef = useRef(null);

  // User location coordinates fallback to India (Ambattur / Chennai / Delhi)
  const userLat = Number(location?.lat ?? 13.1143);
  const userLon = Number(location?.lon ?? 80.1548);
  const cityName = location?.city || location?.name || 'Your Location';

  // Center globe on user's coordinates
  const focusUserLocation = useCallback(() => {
    if (!earthGroupRef.current) return;
    // Rotate to face lat/lon
    const targetY = -((userLon + 180) * (Math.PI / 180)) + Math.PI / 2;
    const targetX = (userLat * (Math.PI / 180)) * 0.5;
    targetRotationRef.current = { x: targetX, y: targetY };
  }, [userLat, userLon]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Dimensions
    const width = container.clientWidth || 280;
    const height = container.clientHeight || 280;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.8);
    cameraRef.current = camera;

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 3. Lighting
    // Directional sunlight illuminating Earth
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.4);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    // Soft celestial ambient blue light for night side
    const ambientLight = new THREE.AmbientLight(0x0e2547, 0.7);
    scene.add(ambientLight);

    // Subtle rim backlight
    const backLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    backLight.position.set(-5, -2, -4);
    scene.add(backLight);

    // 4. Earth Group (Rotated by user / animation)
    const earthGroup = new THREE.Group();
    earthGroupRef.current = earthGroup;
    scene.add(earthGroup);

    // Base procedural texture
    const proceduralCanvas = createProceduralEarthCanvas();
    const proceduralTexture = new THREE.CanvasTexture(proceduralCanvas);
    proceduralTexture.colorSpace = THREE.SRGBColorSpace;

    // Earth Sphere Mesh
    const earthGeometry = new THREE.SphereGeometry(2, 64, 64);
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: proceduralTexture,
      specular: new THREE.Color(0x336699),
      shininess: 24,
      emissive: new THREE.Color(0x020b17),
      emissiveIntensity: 0.35,
    });
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    earthGroup.add(earthMesh);

    // Attempt to smoothly upgrade to NASA Blue Marble photo texture if available
    const texLoader = new THREE.TextureLoader();
    texLoader.crossOrigin = 'anonymous';
    texLoader.load(
      'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
      (onlineTex) => {
        onlineTex.colorSpace = THREE.SRGBColorSpace;
        earthMaterial.map = onlineTex;
        earthMaterial.needsUpdate = true;
      },
      undefined,
      () => {
        // Fallback already active with rich procedural canvas!
      }
    );

    // 5. Clouds Layer (Rotates separately)
    const cloudsCanvas = createProceduralCloudsCanvas();
    const cloudsTexture = new THREE.CanvasTexture(cloudsCanvas);
    const cloudsGeometry = new THREE.SphereGeometry(2.035, 64, 64);
    const cloudsMaterial = new THREE.MeshLambertMaterial({
      map: cloudsTexture,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const cloudsMesh = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
    earthGroup.add(cloudsMesh);
    cloudsRef.current = cloudsMesh;

    // 6. Atmospheric Fresnel Glow (Space halo)
    const atmosphereGeometry = new THREE.SphereGeometry(2.08, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.6);
          gl_FragColor = vec4(0.22, 0.74, 1.0, 1.0) * intensity * 1.35;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphereMesh);

    // 7. Live User Location Beacon Pin
    const beaconGroup = new THREE.Group();
    earthGroup.add(beaconGroup);

    const pinPos = latLonToVector3(userLat, userLon, 2.015);
    beaconGroup.position.copy(pinPos);
    beaconGroup.lookAt(pinPos.clone().multiplyScalar(2));

    // Core glowing marker
    const pinGeom = new THREE.SphereGeometry(0.045, 16, 16);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const pinMesh = new THREE.Mesh(pinGeom, pinMat);
    beaconGroup.add(pinMesh);

    // Stem / needle
    const stemGeom = new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8);
    stemGeom.translate(0, 0.06, 0);
    const stemMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const stemMesh = new THREE.Mesh(stemGeom, stemMat);
    stemMesh.rotation.x = Math.PI / 2;
    beaconGroup.add(stemMesh);

    // Radar pulsing ring
    const ringGeom = new THREE.RingGeometry(0.05, 0.08, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    beaconGroup.add(ringMesh);
    pulseRef.current = ringMesh;
    beaconRef.current = beaconGroup;

    // Global city hub markers
    GLOBAL_HUBS.forEach((hub) => {
      const pos = latLonToVector3(hub.lat, hub.lon, 2.01);
      const hubGeom = new THREE.SphereGeometry(0.025, 12, 12);
      const hubMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const hubMesh = new THREE.Mesh(hubGeom, hubMat);
      hubMesh.position.copy(pos);
      earthGroup.add(hubMesh);
    });

    // Initial position facing user location
    const initialTargetY = -((userLon + 180) * (Math.PI / 180)) + Math.PI / 2;
    earthGroup.rotation.y = initialTargetY;
    earthGroup.rotation.x = (userLat * (Math.PI / 180)) * 0.35;
    targetRotationRef.current = { x: earthGroup.rotation.x, y: earthGroup.rotation.y };

    // 8. Interaction Handling (Drag to rotate, inertia, pinch/wheel to zoom)
    let pointerDown = false;
    let prevPointer = { x: 0, y: 0 };
    let dragVelocity = { x: 0, y: 0 };

    const onPointerDown = (e) => {
      pointerDown = true;
      setIsDragging(true);
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      prevPointer = { x: clientX, y: clientY };
      dragVelocity = { x: 0, y: 0 };
    };

    const onPointerMove = (e) => {
      if (!pointerDown) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - prevPointer.x;
      const dy = clientY - prevPointer.y;

      dragVelocity = { x: dx * 0.005, y: dy * 0.005 };
      targetRotationRef.current.y += dragVelocity.x;
      targetRotationRef.current.x = Math.max(-0.8, Math.min(0.8, targetRotationRef.current.x + dragVelocity.y));

      prevPointer = { x: clientX, y: clientY };
    };

    const onPointerUp = () => {
      pointerDown = false;
      setIsDragging(false);
    };

    const onWheel = (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY * 0.003;
      camera.position.z = Math.max(4.2, Math.min(7.2, camera.position.z + zoomDelta));
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    domElement.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
    domElement.addEventListener('wheel', onWheel, { passive: false });

    // 9. Resize Observer
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    ro.observe(container);

    // 10. Animation Loop
    let animId;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Smooth damping interpolation toward target rotation
      earthGroup.rotation.y += (targetRotationRef.current.y - earthGroup.rotation.y) * 0.08;
      earthGroup.rotation.x += (targetRotationRef.current.x - earthGroup.rotation.x) * 0.08;

      // Auto rotation when not dragging
      if (!pointerDown && isRotating) {
        targetRotationRef.current.y += 0.0018;
      }

      // Clouds independent atmospheric drift
      if (cloudsRef.current) {
        cloudsRef.current.rotation.y += 0.0006;
      }

      // Pulse beacon ring animation
      if (pulseRef.current) {
        const pulseScale = 1 + (time % 1.6) * 1.2;
        pulseRef.current.scale.set(pulseScale, pulseScale, 1);
        pulseRef.current.material.opacity = Math.max(0, 0.8 - (time % 1.6) * 0.5);
      }

      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      domElement.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      domElement.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      domElement.removeEventListener('wheel', onWheel);

      earthGeometry.dispose();
      earthMaterial.dispose();
      cloudsGeometry.dispose();
      cloudsMaterial.dispose();
      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();
      proceduralTexture.dispose();
      cloudsTexture.dispose();
      renderer.dispose();
      if (container.contains(domElement)) {
        container.removeChild(domElement);
      }
    };
  }, [userLat, userLon, isRotating]);

  return (
    <div
      className="interactive-earth-wrapper"
      style={{
        position: 'relative',
        width: '280px',
        height: '280px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      {/* 3D WebGL Canvas Container */}
      <div
        ref={mountRef}
        style={{
          width: '100%',
          height: '100%',
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          position: 'relative',
        }}
        title="Interactive 3D Earth: Drag to rotate, scroll to zoom"
      />

      {/* Floating Live Weather Badge for Detected Location */}
      <div
        className="earth-hud-badge"
        style={{
          position: 'absolute',
          top: '12px',
          right: '8px',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '9999px',
          padding: '4px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: '#fff',
          fontSize: '11px',
          fontWeight: 600,
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            boxShadow: '0 0 8px #10b981',
            display: 'inline-block',
          }}
        />
        <span>{cityName}</span>
        {weather?.temp !== undefined && (
          <span style={{ color: '#38bdf8', fontWeight: 700 }}>
            {Math.round(weather.temp)}°C
          </span>
        )}
      </div>

      {/* Interactive Controls Overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '9999px',
          padding: '3px 8px',
          zIndex: 5,
        }}
      >
        {/* Focus user location button */}
        <button
          type="button"
          onClick={focusUserLocation}
          title="Center on my location"
          aria-label="Center globe on my location"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#38bdf8',
            cursor: 'pointer',
            padding: '3px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <Navigation size={13} />
        </button>

        <span style={{ color: 'rgba(255, 255, 255, 0.2)', fontSize: '10px' }}>|</span>

        {/* Toggle rotation button */}
        <button
          type="button"
          onClick={() => setIsRotating((prev) => !prev)}
          title={isRotating ? 'Pause auto-rotation' : 'Resume auto-rotation'}
          aria-label={isRotating ? 'Pause rotation' : 'Resume rotation'}
          style={{
            background: 'transparent',
            border: 'none',
            color: isRotating ? '#10b981' : '#94a3b8',
            cursor: 'pointer',
            padding: '3px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {isRotating ? <Pause size={12} /> : <Play size={12} />}
        </button>

        <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '10px', paddingRight: '2px' }}>
          Drag to spin
        </span>
      </div>
    </div>
  );
}
