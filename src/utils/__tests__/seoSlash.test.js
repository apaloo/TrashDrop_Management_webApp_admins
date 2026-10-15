import { withSlash, CITY_PAGES, WASTE_PICKUP_PATH, cityLocalBusinessJsonLd, SITE_URL } from '../seo';

describe('trailing-slash URLs (pages are served from /<page>/index.html)', () => {
  it('adds the slash before any hash or query, and leaves the homepage alone', () => {
    expect(withSlash('/')).toBe('/');
    expect(withSlash('/about')).toBe('/about/');
    expect(withSlash('/about/')).toBe('/about/');
    expect(withSlash('/how-it-works#qr')).toBe('/how-it-works/#qr');
    expect(withSlash('/faq?x=1')).toBe('/faq/?x=1');
    expect(withSlash('/blog/my-post')).toBe('/blog/my-post/');
  });

  it('page constants and JSON-LD use the slash form', () => {
    CITY_PAGES.forEach(c => expect(c.path).toMatch(/\/$/));
    expect(WASTE_PICKUP_PATH).toBe('/waste-pickup/');
    const ld = cityLocalBusinessJsonLd('Accra', '/waste-collection-accra');
    expect(ld.url).toBe(`${SITE_URL}/waste-collection-accra/`);
    expect(ld['@id']).toBe(`${SITE_URL}/waste-collection-accra/#localbusiness`);
  });
});
