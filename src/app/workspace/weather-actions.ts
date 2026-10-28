'use server';

import { parseForecast, type WeatherDay } from '@/lib/weather';

// Kenosha, WI. Open-Meteo is free and needs no key; the forecast is public data, so this needs no sign-in.
const URL_ = 'https://api.open-meteo.com/v1/forecast?latitude=42.5847&longitude=-87.8212&daily=weather_code,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FChicago&forecast_days=7';

/** The seven-day forecast for the work area, cached for 30 minutes. An empty list means it could not be fetched; the screen says so rather than guessing. */
export async function loadWeather(): Promise<WeatherDay[]> {
  try {
    const res = await fetch(URL_, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    return parseForecast(await res.json());
  } catch { return []; }
}
