import { useEffect, useRef } from 'react';

/**
 * WeatherAnimation
 * Renders 12 distinct, realistic canvas-based weather animations designed
 * specifically for weather card backgrounds.
 * 
 * Supported conditions:
 * - 'sunny': vibrant golden sun, rotating rays, floating dust motes, wispy clouds
 * - 'partly-cloudy': azure sky (or deep night sky if after dark) with 3D puffy drifting cumulus clouds
 * - 'cloudy': steel-blue overcast with 4 distinct horizontal layered cloud sheets
 * - 'overcast': dark ominous charcoal rolling storm cloud masses
 * - 'light-rain': delicate falling raindrops with expanding water ripples at bottom
 * - 'heavy-rain': dense diagonal rainfall streaks with splashing spray mist
 * - 'thunderstorm': stormy dark sky, heavy rain, and dramatic multi-stage electric lightning
 * - 'fog': undulating horizontal mist banks and wavy fog ribbons
 * - 'snow': snowflakes swaying back and forth with natural sinusoidal drift
 * - 'clear-night': deep midnight indigo sky, glowing crescent moon, 65 twinkling stars, shooting stars
 * - 'sunrise': morning dawn colors (violet, coral, amber), rising sun rays, morning ground mist
 * - 'sunset': rich evening dusk (purple, magenta, burning orange), sinking sun glow, silhouette clouds
 */

export const WEATHER_ANIMATIONS = [
  { id: 'sunny', label: 'Sunny', icon: '☀️' },
  { id: 'partly-cloudy', label: 'Partly Cloudy', icon: '⛅' },
  { id: 'cloudy', label: 'Cloudy', icon: '☁️' },
  { id: 'overcast', label: 'Overcast', icon: '🌫️' },
  { id: 'light-rain', label: 'Light Rain', icon: '🌦️' },
  { id: 'heavy-rain', label: 'Heavy Rain', icon: '🌧️' },
  { id: 'thunderstorm', label: 'Thunderstorm', icon: '⛈️' },
  { id: 'fog', label: 'Fog / Mist', icon: '🌁' },
  { id: 'snow', label: 'Snow', icon: '❄️' },
  { id: 'clear-night', label: 'Clear Night', icon: '🌙' },
  { id: 'sunrise', label: 'Sunrise', icon: '🌅' },
  { id: 'sunset', label: 'Sunset', icon: '🌇' },
];

export function resolveWeatherAnimationType(weather) {
  if (!weather) return 'sunny';
  
  // Explicit override if passed
  if (weather.animationType) return weather.animationType;

  // Determine time of day
  let hour = 12; // default midday
  const rawTime = weather.time || weather.observedAt;
  if (rawTime) {
    const d = new Date(rawTime);
    if (!isNaN(d.getTime())) {
      hour = d.getHours();
    }
  } else {
    hour = new Date().getHours();
  }

  const isNight = hour >= 20 || hour < 5;
  const isSunrise = hour >= 5 && hour < 7;
  const isSunset = hour >= 17 && hour < 20;

  const code = weather.weatherCode !== undefined 
    ? Number(weather.weatherCode) 
    : (weather.condition?.code !== undefined ? Number(weather.condition.code) : null);
  const desc = (weather.description || weather.condition?.label || '').toLowerCase();

  // Precipitation & severe conditions take priority
  if (code === 95 || code === 96 || code === 99 || desc.includes('thunder')) {
    return 'thunderstorm';
  }
  if (code === 65 || code === 81 || code === 82 || desc.includes('heavy rain') || desc.includes('violent')) {
    return 'heavy-rain';
  }
  if (
    code === 51 || code === 53 || code === 55 ||
    code === 61 || code === 63 || code === 80 ||
    desc.includes('rain') || desc.includes('drizzle') || desc.includes('shower')
  ) {
    return 'light-rain';
  }
  if (
    code === 71 || code === 73 || code === 75 ||
    code === 85 || code === 86 ||
    desc.includes('snow') || desc.includes('blizzard') || desc.includes('hail')
  ) {
    return 'snow';
  }
  if (code === 45 || code === 48 || desc.includes('fog') || desc.includes('mist')) {
    return 'fog';
  }

  // Cloud & Clear conditions with time-of-day awareness
  if (code === 3 || desc.includes('overcast')) {
    return 'overcast';
  }
  if (code === 2 || desc.includes('partly')) {
    if (isSunrise) return 'sunrise';
    if (isSunset) return 'sunset';
    return 'partly-cloudy';
  }
  if (desc.includes('cloud')) {
    return 'cloudy';
  }

  // Clear / Sunny variants
  if (isNight) return 'clear-night';
  if (isSunrise) return 'sunrise';
  if (isSunset) return 'sunset';
  return 'sunny';
}

export default function WeatherAnimation({ weather, type }) {
  const canvasRef = useRef(null);
  const animType = type || resolveWeatherAnimationType(weather);

  // Time of day detection for night clouds
  let hour = 12;
  const rawTime = weather?.time || weather?.observedAt;
  if (rawTime) {
    const d = new Date(rawTime);
    if (!isNaN(d.getTime())) hour = d.getHours();
  } else {
    hour = new Date().getHours();
  }
  const isNight = hour >= 20 || hour < 5;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = null;
    let width = (canvas.width = canvas.offsetWidth || 320);
    let height = (canvas.height = canvas.offsetHeight || 220);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          width = canvas.width = Math.floor(w);
          height = canvas.height = Math.floor(h);
        }
      }
    });
    resizeObserver.observe(canvas);

    let time = 0;

    // Rain particles
    const rainCount = animType === 'heavy-rain' ? 160 : animType === 'thunderstorm' ? 130 : 65;
    const rainDrops = Array.from({ length: rainCount }, () => ({
      x: Math.random() * (width + 120) - 60,
      y: Math.random() * height,
      length: Math.random() * 14 + (animType === 'heavy-rain' ? 18 : 10),
      speed: Math.random() * 6 + (animType === 'heavy-rain' ? 12 : 7),
      opacity: Math.random() * 0.45 + 0.3,
      slant: animType === 'heavy-rain' ? -2.6 : -1.3,
    }));

    // Splashes for rain
    const splashes = [];

    // Snow particles
    const snowCount = 70;
    const snowflakes = Array.from({ length: snowCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2.8 + 1,
      speed: Math.random() * 1.1 + 0.5,
      swaySpeed: Math.random() * 0.02 + 0.01,
      swayOffset: Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.65 + 0.35,
    }));

    // Stars for clear night
    const starCount = 65;
    const stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * (height * 0.85),
      radius: Math.random() * 1.5 + 0.5,
      twinkleSpeed: Math.random() * 0.035 + 0.015,
      twinkleOffset: Math.random() * Math.PI * 2,
      baseAlpha: Math.random() * 0.55 + 0.35,
    }));

    // Shooting star state
    let shootingStar = null;
    let nextShootingStarTime = 140;

    // Thunderstorm lightning state
    let lightningFlash = 0;
    let lightningCooldown = Math.floor(Math.random() * 200 + 130);

    // Floating sun motes
    const sunMotes = Array.from({ length: 18 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2.2 + 1,
      vx: Math.random() * 0.3 + 0.1,
      vy: Math.random() * -0.3 - 0.1,
      alpha: Math.random() * 0.35 + 0.15,
    }));

    // Cloud masses for cloud-based conditions
    const cloudCount = animType === 'overcast' ? 5 : animType === 'cloudy' ? 4 : 3;
    const clouds = Array.from({ length: cloudCount }, (_, i) => ({
      x: (i / cloudCount) * width + Math.random() * 40,
      y: 18 + i * 28 + Math.random() * 15,
      radius: 42 + Math.random() * 38,
      speed: 0.16 + (i % 2) * 0.1,
      opacity: animType === 'overcast' ? 0.38 + i * 0.07 : 0.2 + i * 0.06,
    }));

    // Fog mist layers
    const fogLayers = [
      { y: height * 0.32, speed: 0.28, offset: 0, opacity: 0.2, height: 50 },
      { y: height * 0.52, speed: -0.2, offset: 60, opacity: 0.26, height: 65 },
      { y: height * 0.72, speed: 0.24, offset: 130, opacity: 0.32, height: 75 },
    ];

    // Main render loop
    const render = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      switch (animType) {
        case 'sunny':
          drawSunny();
          break;
        case 'partly-cloudy':
          drawPartlyCloudy();
          break;
        case 'cloudy':
          drawCloudy();
          break;
        case 'overcast':
          drawOvercast();
          break;
        case 'light-rain':
          drawRain(false);
          break;
        case 'heavy-rain':
          drawRain(true);
          break;
        case 'thunderstorm':
          drawThunderstorm();
          break;
        case 'fog':
          drawFog();
          break;
        case 'snow':
          drawSnow();
          break;
        case 'clear-night':
          drawClearNight();
          break;
        case 'sunrise':
          drawSunrise();
          break;
        case 'sunset':
          drawSunset();
          break;
        default:
          drawSunny();
      }

      if (!prefersReducedMotion) {
        animId = requestAnimationFrame(render);
      }
    };

    // --- 12 ANIMATION DRAWERS ---

    // 1. SUNNY: Rotating golden sunburst rays, glowing orb, floating golden motes, soft clouds
    function drawSunny() {
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#0284c7');
      bgGrad.addColorStop(0.4, '#0369a1');
      bgGrad.addColorStop(0.85, '#075985');
      bgGrad.addColorStop(1, '#78350f');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const sunX = width * 0.8;
      const sunY = height * 0.24;
      const pulse = Math.sin(time * 0.025) * 8;

      // Rotating sunburst rays
      ctx.save();
      ctx.translate(sunX, sunY);
      ctx.rotate(time * 0.003);
      const rayCount = 8;
      for (let i = 0; i < rayCount; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const angle = (i * Math.PI * 2) / rayCount;
        ctx.lineTo(Math.cos(angle - 0.12) * (width * 0.95), Math.sin(angle - 0.12) * (width * 0.95));
        ctx.lineTo(Math.cos(angle + 0.12) * (width * 0.95), Math.sin(angle + 0.12) * (width * 0.95));
        ctx.closePath();
        const rayGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, width * 0.9);
        rayGrad.addColorStop(0, 'rgba(251, 191, 36, 0.2)');
        rayGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.06)');
        rayGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = rayGrad;
        ctx.fill();
      }
      ctx.restore();

      // Outer radial sun glow
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 15, sunX, sunY, 110 + pulse);
      sunGlow.addColorStop(0, 'rgba(254, 240, 138, 0.55)');
      sunGlow.addColorStop(0.4, 'rgba(251, 191, 36, 0.25)');
      sunGlow.addColorStop(0.8, 'rgba(245, 158, 11, 0.08)');
      sunGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 110 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Sun core
      const sunCore = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 28);
      sunCore.addColorStop(0, '#fffbeb');
      sunCore.addColorStop(0.6, '#fef08a');
      sunCore.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = sunCore;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 28, 0, Math.PI * 2);
      ctx.fill();

      // Floating golden sun motes
      sunMotes.forEach((m) => {
        m.x += m.vx;
        m.y += m.vy;
        if (m.x > width) m.x = 0;
        if (m.y < 0) m.y = height;
        ctx.fillStyle = `rgba(254, 240, 138, ${m.alpha})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Gentle floating wispy clouds
      drawWispyCloud((time * 0.25) % (width + 140) - 70, height * 0.42, 0.16);
      drawWispyCloud(((time * 0.18) + 160) % (width + 140) - 70, height * 0.68, 0.12);
    }

    // 2. PARTLY CLOUDY: Daytime azure sky with 3D puffy clouds (or nighttime moon & night clouds)
    function drawPartlyCloudy() {
      if (isNight) {
        // Deep nighttime sky with clouds
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#030712');
        bgGrad.addColorStop(0.5, '#0b132b');
        bgGrad.addColorStop(1, '#151d38');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Crescent moon with halo
        const moonX = width * 0.8;
        const moonY = height * 0.25;
        const moonGlow = ctx.createRadialGradient(moonX, moonY, 8, moonX, moonY, 55);
        moonGlow.addColorStop(0, 'rgba(224, 231, 255, 0.35)');
        moonGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = moonGlow;
        ctx.beginPath();
        ctx.arc(moonX, moonY, 55, 0, Math.PI * 2);
        ctx.fill();

        // Twinkling stars
        stars.slice(0, 30).forEach((star) => {
          const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset);
          ctx.fillStyle = `rgba(241, 245, 249, ${Math.max(0.1, star.baseAlpha + twinkle * 0.3)})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
          ctx.fill();
        });

        // Night puffy clouds drifting past
        clouds.forEach((cloud, idx) => {
          cloud.x += cloud.speed * 0.8;
          if (cloud.x - cloud.radius * 2 > width) {
            cloud.x = -cloud.radius * 2;
          }
          drawPuffyCloud(cloud.x, cloud.y + Math.sin((time + idx * 40) * 0.015) * 3, cloud.radius, 0.28, '#1e293b');
        });
        return;
      }

      // Daytime azure sky gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#1d4ed8');
      bgGrad.addColorStop(0.5, '#2563eb');
      bgGrad.addColorStop(1, '#3b82f6');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Sun peeking behind clouds
      const sunX = width * 0.35;
      const sunY = height * 0.28;
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, 75);
      sunGlow.addColorStop(0, 'rgba(253, 224, 71, 0.45)');
      sunGlow.addColorStop(0.5, 'rgba(245, 158, 11, 0.18)');
      sunGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 75, 0, Math.PI * 2);
      ctx.fill();

      // Puffy cumulus clouds drifting
      clouds.forEach((cloud, idx) => {
        cloud.x += cloud.speed;
        if (cloud.x - cloud.radius * 2 > width) {
          cloud.x = -cloud.radius * 2;
        }
        drawPuffyCloud(cloud.x, cloud.y + Math.sin((time + idx * 40) * 0.015) * 3, cloud.radius, cloud.opacity);
      });
    }

    // 3. CLOUDY: Steel-blue overcast with 4 horizontal layered cloud sheets
    function drawCloudy() {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#1e293b');
      bgGrad.addColorStop(0.5, '#334155');
      bgGrad.addColorStop(1, '#475569');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      clouds.forEach((cloud, idx) => {
        cloud.x += cloud.speed * 0.85;
        if (cloud.x - cloud.radius * 2.5 > width) {
          cloud.x = -cloud.radius * 2.5;
        }
        drawLayeredCloud(cloud.x, cloud.y, cloud.radius * 1.35, cloud.opacity, idx % 2 === 0);
      });
    }

    // 4. OVERCAST: Dark ominous rolling charcoal cloud masses
    function drawOvercast() {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#090d16');
      bgGrad.addColorStop(0.5, '#151d2c');
      bgGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      clouds.forEach((cloud) => {
        cloud.x += cloud.speed * 0.65;
        if (cloud.x - cloud.radius * 3 > width) {
          cloud.x = -cloud.radius * 3;
        }
        drawHeavyCloudMass(cloud.x, cloud.y + 12, cloud.radius * 1.55, cloud.opacity);
      });
    }

    // 5 & 6. RAIN: Light rain ripples or heavy rain splash spray
    function drawRain(isHeavy) {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, isHeavy ? '#050811' : '#0f172a');
      bgGrad.addColorStop(0.5, isHeavy ? '#0b1120' : '#172438');
      bgGrad.addColorStop(1, isHeavy ? '#111c30' : '#1e324c');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      drawHeavyCloudMass(width * 0.25, 8, 95, 0.28);
      drawHeavyCloudMass(width * 0.75, 12, 115, 0.32);

      // Draw raindrops
      ctx.strokeStyle = isHeavy ? 'rgba(186, 230, 253, 0.5)' : 'rgba(186, 230, 253, 0.38)';
      ctx.lineWidth = isHeavy ? 1.6 : 1.1;
      ctx.lineCap = 'round';

      ctx.beginPath();
      for (let i = 0; i < rainDrops.length; i++) {
        const drop = rainDrops[i];
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x + drop.slant * (drop.length / 5), drop.y + drop.length);

        drop.y += drop.speed;
        drop.x += drop.slant * 0.6;

        if (drop.y > height) {
          if (splashes.length < 30 && Math.random() < 0.45) {
            splashes.push({
              x: drop.x,
              y: height - Math.random() * 8,
              radius: 1,
              maxRadius: Math.random() * 3.5 + 2,
              alpha: 0.55,
            });
          }
          drop.y = -drop.length;
          drop.x = Math.random() * (width + 80) - 40;
        }
      }
      ctx.stroke();

      // Splashes
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, s.radius * 1.7, s.radius * 0.6, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(186, 230, 253, ${s.alpha})`;
        ctx.lineWidth = 0.9;
        ctx.stroke();

        s.radius += 0.32;
        s.alpha -= 0.038;
        if (s.alpha <= 0) splashes.splice(i, 1);
      }
    }

    // 7. THUNDERSTORM: Dark stormy sky, heavy rain, dramatic multi-stage electric lightning
    function drawThunderstorm() {
      lightningCooldown -= 1;
      if (lightningCooldown <= 0) {
        lightningFlash = 0.9;
        lightningCooldown = Math.floor(Math.random() * 240 + 150);
      }

      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      if (lightningFlash > 0.05) {
        bgGrad.addColorStop(0, `rgba(67, 56, 202, ${0.4 + lightningFlash * 0.5})`);
        bgGrad.addColorStop(1, `rgba(30, 27, 75, ${0.6 + lightningFlash * 0.3})`);
      } else {
        bgGrad.addColorStop(0, '#030712');
        bgGrad.addColorStop(0.5, '#0b0f19');
        bgGrad.addColorStop(1, '#111827');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      drawHeavyCloudMass(width * 0.3, 10, 115, 0.48);
      drawHeavyCloudMass(width * 0.8, 15, 125, 0.52);

      // Electric branching lightning bolt
      if (lightningFlash > 0.35) {
        ctx.save();
        ctx.strokeStyle = `rgba(238, 242, 255, ${lightningFlash})`;
        ctx.lineWidth = 2.2;
        ctx.shadowColor = 'rgba(165, 180, 252, 0.95)';
        ctx.shadowBlur = 14;

        ctx.beginPath();
        let lx = width * 0.62;
        let ly = 8;
        ctx.moveTo(lx, ly);
        const segments = 7;
        for (let s = 0; s < segments; s++) {
          lx += (Math.random() - 0.5) * 32;
          ly += (height * 0.58) / segments;
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();
        ctx.restore();
      }

      if (lightningFlash > 0) {
        lightningFlash *= 0.86;
        if (lightningFlash < 0.02) lightningFlash = 0;
      }

      // Heavy rain
      ctx.strokeStyle = 'rgba(199, 210, 254, 0.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < rainDrops.length; i++) {
        const drop = rainDrops[i];
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x + drop.slant * 2.6, drop.y + drop.length);
        drop.y += drop.speed * 1.25;
        drop.x += drop.slant * 0.8;
        if (drop.y > height) {
          drop.y = -drop.length;
          drop.x = Math.random() * (width + 80) - 40;
        }
      }
      ctx.stroke();
    }

    // 8. FOG: Undulating horizontal mist banks & waving fog ribbons
    function drawFog() {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#15202b');
      bgGrad.addColorStop(0.5, '#1e293b');
      bgGrad.addColorStop(1, '#334155');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      fogLayers.forEach((layer) => {
        layer.offset += layer.speed;
        const mistGrad = ctx.createLinearGradient(0, layer.y - layer.height * 0.5, 0, layer.y + layer.height * 0.5);
        mistGrad.addColorStop(0, 'transparent');
        mistGrad.addColorStop(0.5, `rgba(226, 232, 240, ${layer.opacity})`);
        mistGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = mistGrad;

        ctx.beginPath();
        ctx.moveTo(0, layer.y);
        for (let x = 0; x <= width + 20; x += 25) {
          const waveY = layer.y + Math.sin((x + layer.offset) * 0.015) * 11;
          ctx.lineTo(x, waveY);
        }
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fill();
      });
    }

    // 9. SNOW: Swirling snowflakes with sinusoidal sway, soft snow accumulation glow
    function drawSnow() {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#0b132b');
      bgGrad.addColorStop(0.6, '#1c2541');
      bgGrad.addColorStop(1, '#253255');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < snowflakes.length; i++) {
        const flake = snowflakes[i];
        flake.y += flake.speed;
        flake.x += Math.sin(flake.swayOffset + time * flake.swaySpeed) * 0.7;

        if (flake.y > height + 5) {
          flake.y = -5;
          flake.x = Math.random() * width;
        }

        const flakeGrad = ctx.createRadialGradient(flake.x, flake.y, 0, flake.x, flake.y, flake.radius);
        flakeGrad.addColorStop(0, `rgba(255, 255, 255, ${flake.opacity})`);
        flakeGrad.addColorStop(0.7, `rgba(224, 242, 254, ${flake.opacity * 0.6})`);
        flakeGrad.addColorStop(1, 'transparent');

        ctx.fillStyle = flakeGrad;
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const floorGlow = ctx.createLinearGradient(0, height - 22, 0, height);
      floorGlow.addColorStop(0, 'transparent');
      floorGlow.addColorStop(1, 'rgba(224, 242, 254, 0.15)');
      ctx.fillStyle = floorGlow;
      ctx.fillRect(0, height - 22, width, 22);
    }

    // 10. CLEAR NIGHT: Deep midnight sky, glowing crescent moon, 65 twinkling stars, shooting star
    function drawClearNight() {
      const bgGrad = ctx.createLinearGradient(0, 0, width * 0.3, height);
      bgGrad.addColorStop(0, '#020617');
      bgGrad.addColorStop(0.5, '#070f20');
      bgGrad.addColorStop(1, '#0e1b36');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Cosmic nebula glow
      const nebGrad = ctx.createRadialGradient(width * 0.7, height * 0.3, 10, width * 0.7, height * 0.3, 120);
      nebGrad.addColorStop(0, 'rgba(99, 102, 241, 0.14)');
      nebGrad.addColorStop(0.6, 'rgba(168, 85, 247, 0.06)');
      nebGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = nebGrad;
      ctx.beginPath();
      ctx.arc(width * 0.7, height * 0.3, 120, 0, Math.PI * 2);
      ctx.fill();

      // Crescent moon
      const moonX = width * 0.82;
      const moonY = height * 0.22;
      const moonRadius = 15;

      const moonGlow = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.8, moonX, moonY, moonRadius * 3.8);
      moonGlow.addColorStop(0, 'rgba(224, 231, 255, 0.28)');
      moonGlow.addColorStop(0.6, 'rgba(199, 210, 254, 0.09)');
      moonGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = moonGlow;
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonRadius * 3.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2, false);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();

      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(moonX + 6, moonY - 3, moonRadius * 0.95, 0, Math.PI * 2, false);
      ctx.fill();
      ctx.restore();

      // Twinkling stars
      stars.forEach((star) => {
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset);
        const alpha = Math.max(0.12, star.baseAlpha + twinkle * 0.32);
        ctx.fillStyle = `rgba(241, 245, 249, ${alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius * (1 + twinkle * 0.2), 0, Math.PI * 2);
        ctx.fill();
      });

      // Shooting star
      nextShootingStarTime -= 1;
      if (nextShootingStarTime <= 0 && !shootingStar) {
        shootingStar = {
          x: Math.random() * (width * 0.7),
          y: Math.random() * (height * 0.4),
          vx: 7 + Math.random() * 4,
          vy: 3 + Math.random() * 2,
          alpha: 1,
        };
        nextShootingStarTime = Math.floor(Math.random() * 260 + 160);
      }

      if (shootingStar) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${shootingStar.alpha})`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(shootingStar.x, shootingStar.y);
        ctx.lineTo(shootingStar.x - shootingStar.vx * 2.5, shootingStar.y - shootingStar.vy * 2.5);
        ctx.stroke();

        shootingStar.x += shootingStar.vx;
        shootingStar.y += shootingStar.vy;
        shootingStar.alpha -= 0.04;

        if (shootingStar.alpha <= 0 || shootingStar.x > width || shootingStar.y > height) {
          shootingStar = null;
        }
      }
    }

    // 11. SUNRISE: Dawn colors (violet, coral, amber), rising sun rays, morning ground mist
    function drawSunrise() {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(0.32, '#312e81');
      bgGrad.addColorStop(0.62, '#b91c1c');
      bgGrad.addColorStop(0.82, '#ea580c');
      bgGrad.addColorStop(1, '#f59e0b');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const sunX = width * 0.5;
      const sunY = height * 0.88;
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 140);
      sunGlow.addColorStop(0, 'rgba(254, 240, 138, 0.65)');
      sunGlow.addColorStop(0.4, 'rgba(251, 146, 60, 0.35)');
      sunGlow.addColorStop(0.8, 'rgba(234, 88, 12, 0.12)');
      sunGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 140, 0, Math.PI * 2);
      ctx.fill();

      drawWispyCloud((time * 0.2) % (width + 120) - 60, height * 0.72, 0.22);
      drawWispyCloud(((time * 0.15) + 80) % (width + 120) - 60, height * 0.55, 0.16);
    }

    // 12. SUNSET: Rich dusk (purple, magenta, burning orange), sinking sun, silhouette clouds
    function drawSunset() {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(0.28, '#3b0764');
      bgGrad.addColorStop(0.58, '#831843');
      bgGrad.addColorStop(0.8, '#c2410c');
      bgGrad.addColorStop(1, '#d97706');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const sunX = width * 0.65;
      const sunY = height * 0.85;
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 130);
      sunGlow.addColorStop(0, 'rgba(254, 215, 170, 0.6)');
      sunGlow.addColorStop(0.4, 'rgba(249, 115, 22, 0.3)');
      sunGlow.addColorStop(0.8, 'rgba(194, 65, 12, 0.1)');
      sunGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 130, 0, Math.PI * 2);
      ctx.fill();

      drawWispyCloud((time * 0.16) % (width + 120) - 60, height * 0.68, 0.28, '#451a03');
      drawWispyCloud(((time * 0.22) + 100) % (width + 120) - 60, height * 0.48, 0.2, '#31103f');
    }

    // --- REUSABLE CLOUD SHAPES ---

    function drawWispyCloud(x, y, opacity, color = '#cbd5e1') {
      ctx.save();
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.ellipse(x, y, 48, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 24, y - 4, 32, 12, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 22, y + 2, 30, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawPuffyCloud(x, y, radius, opacity, color = '#e2e8f0') {
      ctx.save();
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2);
      ctx.arc(x + radius * 0.5, y - radius * 0.2, radius * 0.7, 0, Math.PI * 2);
      ctx.arc(x + radius * 1.05, y, radius * 0.55, 0, Math.PI * 2);
      ctx.arc(x + radius * 0.5, y + radius * 0.2, radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawLayeredCloud(x, y, radius, opacity, isDarker) {
      ctx.save();
      ctx.fillStyle = isDarker ? '#94a3b8' : '#cbd5e1';
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
      ctx.arc(x + radius * 0.6, y - radius * 0.15, radius * 0.8, 0, Math.PI * 2);
      ctx.arc(x + radius * 1.2, y + radius * 0.05, radius * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawHeavyCloudMass(x, y, radius, opacity) {
      ctx.save();
      ctx.fillStyle = '#64748b';
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
      ctx.arc(x + radius * 0.7, y - 5, radius * 0.85, 0, Math.PI * 2);
      ctx.arc(x + radius * 1.35, y + 8, radius * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
      resizeObserver.disconnect();
    };
  }, [animType, isNight]);

  return (
    <canvas
      ref={canvasRef}
      className="weather-anim-canvas"
      data-animation-type={animType}
      aria-hidden="true"
    />
  );
}
