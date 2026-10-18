/**
 * Blog post slugs, read from BLOG_POSTS in src/pages/BlogPage.js so the
 * pre-render routes, the sitemap and its <lastmod> sources always list every
 * post. A post added there is pre-rendered and checked on the next build.
 */
const fs = require('fs');
const path = require('path');

const BLOG_PAGE = path.resolve(__dirname, '..', 'src', 'pages', 'BlogPage.js');

const blogSlugs = () => {
  const source = fs.readFileSync(BLOG_PAGE, 'utf8');
  const slugs = [...source.matchAll(/^\s*slug:\s*'([a-z0-9-]+)'/gm)].map(m => m[1]);
  if (!slugs.length) throw new Error(`No blog post slugs found in ${BLOG_PAGE}`);
  return slugs;
};

/** '/blog/<slug>' for every post */
const blogPostRoutes = () => blogSlugs().map(slug => `/blog/${slug}`);

module.exports = { blogSlugs, blogPostRoutes };
