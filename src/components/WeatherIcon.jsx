import React from 'react';
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning,
  Snowflake,
  CloudFog,
  CloudDrizzle,
  Moon,
  Sunrise,
  Sunset,
  Thermometer,
  Droplets,
  Wind,
  Eye,
  Compass,
  AlertTriangle,
  Flame,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Calendar,
  Wheat,
  Globe,
  Zap,
  Cpu,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

const EMOJI_MAP = {
  '☀️': Sun,
  '🌤️': CloudSun,
  '⛅': CloudSun,
  '☁️': Cloud,
  '🌫️': CloudFog,
  '🌦️': CloudDrizzle,
  '🌧️': CloudRain,
  '🌨️': Snowflake,
  '❄️': Snowflake,
  '⛈️': CloudLightning,
  '🌡️': Thermometer,
  '💧': Droplets,
  '💨': Wind,
  '🌅': Sunrise,
  '🌇': Sunset,
  '🌙': Moon,
  '⚠️': AlertTriangle,
  '🔴': AlertTriangle,
  '🟠': AlertTriangle,
  '🟢': ShieldCheck,
  '🔵': Activity,
  '✅': CheckCircle2,
  '🥵': Flame,
  '🧣': Thermometer,
  '🍃': Wind,
  '🚨': ShieldAlert,
  '📅': Calendar,
  '🌾': Wheat,
  '🌍': Globe,
  '⚡': Zap,
  '🧠': Cpu,
  '🛡️': ShieldAlert,
  '👁️': Eye,
  '🧭': Compass
};

const CODE_MAP = {
  0: Sun,
  1: CloudSun,
  2: CloudSun,
  3: Cloud,
  45: CloudFog,
  48: CloudFog,
  51: CloudDrizzle,
  53: CloudDrizzle,
  55: CloudRain,
  61: CloudRain,
  63: CloudRain,
  65: CloudRain,
  71: Snowflake,
  73: Snowflake,
  75: Snowflake,
  80: CloudDrizzle,
  81: CloudRain,
  82: CloudLightning,
  85: Snowflake,
  86: Snowflake,
  95: CloudLightning,
  96: CloudLightning,
  99: CloudLightning
};

const TYPE_MAP = {
  'sunny': Sun,
  'partly-cloudy': CloudSun,
  'cloudy': Cloud,
  'overcast': Cloud,
  'light-rain': CloudDrizzle,
  'heavy-rain': CloudRain,
  'thunderstorm': CloudLightning,
  'fog': CloudFog,
  'snow': Snowflake,
  'clear-night': Moon,
  'sunrise': Sunrise,
  'sunset': Sunset
};

// Rich, curated color palette for each icon component
const ICON_COLORS = new Map([
  [Sun, '#fbbf24'],            // Radiant warm gold
  [CloudSun, '#38bdf8'],       // Sky cyan blue with sunlight
  [Cloud, '#94a3b8'],          // Soft silver slate cloud
  [CloudFog, '#a1a1aa'],       // Ethereal mist lavender/gray
  [CloudDrizzle, '#38bdf8'],   // Bright light blue rain
  [CloudRain, '#3b82f6'],      // Intense royal rain blue
  [CloudLightning, '#eab308'], // Electric lightning yellow
  [Snowflake, '#06b6d4'],      // Crisp crystalline cyan
  [Moon, '#facc15'],           // Warm luminous yellow
  [Sunrise, '#f97316'],        // Coral morning orange
  [Sunset, '#fb7185'],         // Dusk rose red
  [Thermometer, '#ef4444'],    // Fiery red
  [Droplets, '#0ea5e9'],       // Refreshing water blue
  [Wind, '#10b981'],           // Mint breeze green
  [Eye, '#8b5cf6'],            // Electric violet
  [Compass, '#06b6d4'],        // Bright teal cyan
  [AlertTriangle, '#f59e0b'],  // Warning amber
  [Flame, '#f97316'],          // Hot flame orange
  [ShieldCheck, '#10b981'],    // Success emerald green
  [ShieldAlert, '#ef4444'],    // Danger crimson red
  [Activity, '#3b82f6'],       // Sensor blue
  [Calendar, '#6366f1'],       // Calendar indigo
  [Wheat, '#eab308'],          // Harvest gold
  [Globe, '#0284c7'],          // Deep azure planet
  [Zap, '#eab308'],            // Thunder yellow
  [Cpu, '#a855f7'],            // Cyber violet
  [CheckCircle2, '#10b981'],   // Emerald success
  [Sparkles, '#fbbf24']        // Golden starlight
]);

export default function WeatherIcon({ icon, code, type, size = 20, className = '', color, style = {} }) {
  let IconComponent = null;

  if (code !== undefined && code !== null && CODE_MAP[code]) {
    IconComponent = CODE_MAP[code];
  } else if (type && TYPE_MAP[type]) {
    IconComponent = TYPE_MAP[type];
  } else if (icon && typeof icon === 'string') {
    const trimmed = icon.trim();
    if (EMOJI_MAP[trimmed]) {
      IconComponent = EMOJI_MAP[trimmed];
    } else if (TYPE_MAP[trimmed]) {
      IconComponent = TYPE_MAP[trimmed];
    }
  }

  if (!IconComponent) {
    IconComponent = CloudSun;
  }

  const iconColor = color || ICON_COLORS.get(IconComponent) || '#38bdf8';

  return (
    <IconComponent
      size={size}
      className={`weather-lucide-icon ${className}`}
      color={iconColor}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))',
        ...style
      }}
    />
  );
}
