import { FONT, TD } from './brand';

// Chart.js text in the site's face and secondary colour (docs/DESIGN_SYSTEM.md).
// Call once where Chart.js is registered.
export const applyChartTheme = (ChartJS) => {
  ChartJS.defaults.font.family = FONT;
  ChartJS.defaults.font.size = 13;
  ChartJS.defaults.color = TD.sage;
  ChartJS.defaults.borderColor = '#dfe4dc';
};

// A chart's text alternative: "Pending 5, Assigned 6, …"
export const describeValues = (labels = [], values = []) =>
  labels.map((l, i) => `${l} ${values[i] ?? 0}`).join(', ');
