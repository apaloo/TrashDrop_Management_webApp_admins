import { nearestBookingCity, BOOKING_CITIES } from '../homepage';
import { CITY_PAGES } from '../../utils/seo';

describe('booking cities', () => {
  it('matches the four city pages', () => {
    expect(BOOKING_CITIES.map(c => c.name)).toEqual(CITY_PAGES.map(c => c.name));
  });

  it('picks the nearest city, or none when far from all of them', () => {
    expect(nearestBookingCity(5.6730, -0.1660)).toBe('Accra');      // Madina
    expect(nearestBookingCity(6.7190, -1.4730)).toBe('Kumasi');     // Ejisu
    expect(nearestBookingCity(4.9430, -1.7040)).toBe('Takoradi');   // Sekondi
    expect(nearestBookingCity(9.43, -0.85)).toBe('Tamale');
    expect(nearestBookingCity(7.3349, -2.3123)).toBeNull();         // Sunyani
  });
});
