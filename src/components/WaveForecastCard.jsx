import React, { useState, useRef, useEffect, useMemo } from 'react';
import WeatherIcon from './WeatherIcon.jsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function formatDayHeader(dateStr, idx) {
  if (idx === 0) return 'Today';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = String(d.getDate()).padStart(2, '0');
    return `${weekday} ${dayNum}`;
  } catch {
    return dateStr;
  }
}

function formatHourHeader(timeStr, idx) {
  if (idx === 0) return 'Now';
  try {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return timeStr;
    return d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
  } catch {
    return timeStr;
  }
}

export default function WaveForecastCard({ forecast, className = '' }) {
  // Only Daily and Hourly (Today section removed as requested)
  const [tab, setTab] = useState('daily'); // 'daily' | 'hourly'
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Active dataset
  const items = useMemo(() => {
    if (!forecast) return [];

    if (tab === 'daily') {
      const dailyList = forecast.daily || [];
      return dailyList.slice(0, 16).map((day, idx) => ({
        id: `daily-${idx}`,
        title: formatDayHeader(day.date, idx),
        rawDate: day.date,
        maxTemp: Math.round(day.maxTemp ?? day.temp ?? 25),
        minTemp: Math.round(day.minTemp ?? (day.maxTemp ? day.maxTemp - 6 : 18)),
        icon: day.icon,
        rainProbability: day.rainProbability ?? 0,
        label: day.label || 'Fair',
        type: 'daily'
      }));
    }

    // Hourly tab
    const hourlyList = forecast.hourly || [];
    return hourlyList.slice(0, 36).map((hour, idx) => ({
      id: `hourly-${idx}`,
      title: formatHourHeader(hour.time, idx),
      rawTime: hour.time,
      maxTemp: Math.round(hour.temp ?? 25),
      minTemp: Math.round(hour.windSpeed ?? 0),
      icon: hour.icon,
      rainProbability: hour.rainProbability ?? 0,
      label: hour.label || 'Clear',
      windSpeed: hour.windSpeed,
      type: 'hourly'
    }));
  }, [tab, forecast]);

  // Scroll bounds listener
  const updateScrollButtons = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  useEffect(() => {
    updateScrollButtons();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    return () => el.removeEventListener('scroll', updateScrollButtons);
  }, [items]);

  const handleScroll = (direction) => {
    if (!scrollRef.current) return;
    const scrollAmount = 300;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  // Drag-to-scroll
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);

  const onMouseDown = (e) => {
    isDragging.current = true;
    startX.current = e.pageX - (scrollRef.current?.offsetLeft || 0);
    scrollLeftStart.current = scrollRef.current?.scrollLeft || 0;
  };

  const onMouseMove = (e) => {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - (scrollRef.current.offsetLeft || 0);
    const walk = (x - startX.current) * 1.5;
    scrollRef.current.scrollLeft = scrollLeftStart.current - walk;
  };

  const onMouseUp = () => {
    isDragging.current = false;
  };

  // Dimensions
  const colWidth = 86;
  const svgHeight = 76;
  const totalSvgWidth = Math.max(items.length * colWidth, colWidth * 5);

  // Compute spline points with adaptive dynamic range
  const wavePoints = useMemo(() => {
    if (items.length === 0) return [];

    const temps = items.map((it) => it.maxTemp);
    const minT = Math.min(...temps);
    const maxT = Math.max(...temps);
    const actualRange = maxT - minT;
    // Minimum 7° visual span ensures the wave has smooth natural curvature even when actual temp delta is small
    const visualSpan = Math.max(7, actualRange);
    const midT = (maxT + minT) / 2;

    const padTop = 16;
    const padBottom = 60;
    const yCenter = (padTop + padBottom) / 2;
    const yAmplitude = (padBottom - padTop) / 2;

    return items.map((item, i) => {
      const x = i * colWidth + colWidth / 2;
      // Offset from center temperature
      const diff = item.maxTemp - midT;
      // Normalized between -1 and 1
      const normDiff = diff / (visualSpan / 2);
      // Invert: higher temp = higher on graph (lower y)
      const y = Math.max(padTop, Math.min(padBottom, yCenter - normDiff * yAmplitude));
      return { x, y, temp: item.maxTemp };
    });
  }, [items, colWidth]);

  // Generate Catmull-Rom to Cubic Bezier curve for smooth flowing sine-wave appearance
  const { strokePath, areaPath } = useMemo(() => {
    if (wavePoints.length === 0) return { strokePath: '', areaPath: '' };
    if (wavePoints.length === 1) {
      return {
        strokePath: `M 0,${wavePoints[0].y} L ${totalSvgWidth},${wavePoints[0].y}`,
        areaPath: `M 0,${wavePoints[0].y} L ${totalSvgWidth},${wavePoints[0].y} L ${totalSvgWidth},${svgHeight} L 0,${svgHeight} Z`
      };
    }

    let d = `M ${wavePoints[0].x.toFixed(1)},${wavePoints[0].y.toFixed(1)}`;

    for (let i = 0; i < wavePoints.length - 1; i++) {
      const p0 = wavePoints[Math.max(0, i - 1)];
      const p1 = wavePoints[i];
      const p2 = wavePoints[i + 1];
      const p3 = wavePoints[Math.min(wavePoints.length - 1, i + 2)];

      // Standard Catmull-Rom tangent vectors
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }

    const firstX = wavePoints[0].x;
    const lastX = wavePoints[wavePoints.length - 1].x;
    const area = `${d} L ${lastX.toFixed(1)},${svgHeight} L ${firstX.toFixed(1)},${svgHeight} Z`;

    return { strokePath: d, areaPath: area };
  }, [wavePoints, totalSvgWidth, svgHeight]);

  return (
    <div className={`wave-forecast-card ${className}`}>
      {/* Top Segmented Controls: Hourly | Daily */}
      <div className="wave-forecast-header">
        <div className="wave-pill-switch" role="tablist" aria-label="Forecast Range">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'hourly'}
            className={`wave-pill-btn ${tab === 'hourly' ? 'wave-pill-btn--active' : ''}`}
            onClick={() => setTab('hourly')}
          >
            Hourly
          </button>

          <div className="wave-pill-divider" aria-hidden="true" />

          <button
            type="button"
            role="tab"
            aria-selected={tab === 'daily'}
            className={`wave-pill-btn ${tab === 'daily' ? 'wave-pill-btn--active' : ''}`}
            onClick={() => setTab('daily')}
          >
            Daily
          </button>
        </div>

        {/* Scroll Chevrons for desktop navigation */}
        <div className="wave-nav-arrows">
          <button
            type="button"
            className="wave-nav-btn"
            onClick={() => handleScroll('left')}
            disabled={!canScrollLeft}
            aria-label="Scroll left"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="wave-nav-btn"
            onClick={() => handleScroll('right')}
            disabled={!canScrollRight}
            aria-label="Scroll right"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Main Forecast Body with Synchronized Wave & Columns */}
      <div
        className="wave-scroll-container"
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div
          className="wave-track"
          style={{ width: `${totalSvgWidth}px` }}
        >
          {/* Top Row: Date / Time Header */}
          <div className="wave-row wave-row--headers">
            {items.map((item) => (
              <div
                key={item.id}
                className="wave-cell-header"
                style={{ width: `${colWidth}px` }}
              >
                <span>{item.title}</span>
              </div>
            ))}
          </div>

          {/* Max Temperature Row */}
          <div className="wave-row wave-row--max-temp">
            {items.map((item) => (
              <div
                key={item.id}
                className="wave-cell-temp wave-cell-temp--max"
                style={{ width: `${colWidth}px` }}
              >
                <strong>{item.maxTemp}°</strong>
              </div>
            ))}
          </div>

          {/* Min Temperature (or secondary metric) Row */}
          <div className="wave-row wave-row--min-temp">
            {items.map((item) => (
              <div
                key={item.id}
                className="wave-cell-temp wave-cell-temp--min"
                style={{ width: `${colWidth}px` }}
              >
                <span>
                  {item.type === 'daily' ? `${item.minTemp}°` : `${item.minTemp}k`}
                </span>
              </div>
            ))}
          </div>

          {/* Smooth Flowing Wave SVG Curve */}
          <div className="wave-svg-wrapper" style={{ height: `${svgHeight}px`, width: `${totalSvgWidth}px` }}>
            <svg
              className="wave-svg"
              width={totalSvgWidth}
              height={svgHeight}
              viewBox={`0 0 ${totalSvgWidth} ${svgHeight}`}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="waveStrokeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="50%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
                <linearGradient id="waveFillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                </linearGradient>
                <filter id="waveGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#38bdf8" floodOpacity="0.5" />
                </filter>
              </defs>

              {/* Area gradient under curve */}
              {areaPath && (
                <path d={areaPath} fill="url(#waveFillGradient)" />
              )}

              {/* Pure smooth continuous curved blue line */}
              {strokePath && (
                <path
                  d={strokePath}
                  fill="none"
                  stroke="url(#waveStrokeGradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#waveGlow)"
                />
              )}
            </svg>
          </div>

          {/* Bottom Row: Weather Icons & Precipitation % */}
          <div className="wave-row wave-row--icons">
            {items.map((item) => (
              <div
                key={item.id}
                className="wave-cell-action"
                style={{ width: `${colWidth}px` }}
              >
                <div className="wave-box-card">
                  <div className="wave-icon-wrap">
                    <WeatherIcon icon={item.icon} size={28} />
                  </div>
                  <div className="wave-rain-val">
                    <span>{item.rainProbability}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Vertical Faint Dividers */}
          <div className="wave-dividers-overlay">
            {items.map((item, idx) => (
              <div
                key={`div-${idx}`}
                className="wave-col-divider"
                style={{ left: `${(idx + 1) * colWidth}px` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
