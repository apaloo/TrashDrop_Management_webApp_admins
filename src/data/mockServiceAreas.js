// Mock service area boundaries for the LiveMap
const mockServiceAreas = [
  {
    id: 'area-north',
    name: 'North District',
    color: '#2196F3',
    fillOpacity: 0.1,
    strokeWidth: 2,
    activeCollectors: 2,
    requestsInProgress: 4,
    coordinates: [
      [37.8044, -122.4155],
      [37.8044, -122.4055],
      [37.8144, -122.4055],
      [37.8144, -122.4155],
      [37.8044, -122.4155]
    ]
  },
  {
    id: 'area-south',
    name: 'South District',
    color: '#FF9800',
    fillOpacity: 0.1,
    strokeWidth: 2,
    activeCollectors: 0,
    requestsInProgress: 1,
    coordinates: [
      [37.7649, -122.4194],
      [37.7649, -122.4094],
      [37.7549, -122.4094],
      [37.7549, -122.4194],
      [37.7649, -122.4194]
    ]
  },
  {
    id: 'area-east',
    name: 'East District',
    color: '#4CAF50',
    fillOpacity: 0.1,
    strokeWidth: 2,
    activeCollectors: 1,
    requestsInProgress: 2,
    coordinates: [
      [37.7579, -122.3980],
      [37.7579, -122.3880],
      [37.7679, -122.3880],
      [37.7679, -122.3980],
      [37.7579, -122.3980]
    ]
  },
  {
    id: 'area-west',
    name: 'West District',
    color: '#9C27B0',
    fillOpacity: 0.1,
    strokeWidth: 2,
    activeCollectors: 1,
    requestsInProgress: 3,
    coordinates: [
      [37.7694, -122.4760],
      [37.7694, -122.4860],
      [37.7594, -122.4860],
      [37.7594, -122.4760],
      [37.7694, -122.4760]
    ]
  },
  {
    id: 'area-central',
    name: 'Central District',
    color: '#E91E63',
    fillOpacity: 0.1,
    strokeWidth: 2,
    activeCollectors: 0,
    requestsInProgress: 0,
    coordinates: [
      [37.7880, -122.4324],
      [37.7880, -122.4224],
      [37.7780, -122.4224],
      [37.7780, -122.4324],
      [37.7880, -122.4324]
    ]
  }
];

export default mockServiceAreas;
