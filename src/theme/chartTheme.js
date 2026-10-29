import { FONT, TD, CHART } from './brand';

// Dark mode chart colours: the same hues, light enough to keep 3:1 against
// the dark cards (#151b15). Keyed by the light value so data rows that carry
// a CHART colour map across.
export const CHART_DARK = {
  green:  '#4caf6a',
  orange: '#f98b38',
  blue:   '#6b8cff',
  purple: '#a78bfa',
  red:    '#f87171',
  grey:   '#8a8f9c',
  dark:   '#b3bcb2',
  light:  '#4a544a',
};
const TO_DARK = Object.fromEntries(Object.keys(CHART).map(k => [CHART[k].toLowerCase(), CHART_DARK[k]]));

// A CHART colour for the current mode
export const chartColor = (color, isDark) => (isDark && color ? TO_DARK[String(color).toLowerCase()] || color : color);

// Chart.js text in the site's face and secondary colour (docs/DESIGN_SYSTEM.md).
// Call where Chart.js is registered, and again when the mode changes (charts
// pick up the defaults when they are drawn, so give them a key per mode).
export const applyChartTheme = (ChartJS, isDark = false) => {
  ChartJS.defaults.font.family = FONT;
  ChartJS.defaults.font.size = 13;
  ChartJS.defaults.color = isDark ? '#b3bcb2' : TD.sage;
  ChartJS.defaults.borderColor = isDark ? '#2b352b' : '#dfe4dc';
  // Gaps between doughnut segments are the card colour
  ChartJS.defaults.elements.arc.borderColor = isDark ? '#151b15' : '#ffffff';
};

// A chart's text alternative: "Pending 5, Assigned 6, …"
export const describeValues = (labels = [], values = []) =>
  labels.map((l, i) => `${l} ${values[i] ?? 0}`).join(', ');
