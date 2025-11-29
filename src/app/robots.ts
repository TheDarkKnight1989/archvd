import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/portfolio/', '/settings/', '/product/'],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/portfolio/', '/settings/', '/product/'],
      },
    ],
    sitemap: 'https://archvd.io/sitemap.xml',
  }
}
