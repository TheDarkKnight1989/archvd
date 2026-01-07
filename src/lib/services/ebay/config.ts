export const ebayConfig = {
  env: process.env.EBAY_ENV === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
  environment: process.env.EBAY_ENV === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX', // Alias for env
  clientId: process.env.EBAY_CLIENT_ID ?? process.env.EBAY_APP_ID ?? '',
  clientSecret: process.env.EBAY_CLIENT_SECRET ?? '',
  marketDataEnabled: process.env.EBAY_MARKET_DATA_ENABLED === 'true',
}
