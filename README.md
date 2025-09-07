# attos-earn-api

A comprehensive API for DeFi pool analytics and token news aggregation, featuring Discord bot integration and Telegram channel monitoring.

## Features

- **DeFi Pool Analytics**: Track and analyze liquidity pools across multiple providers
- **Token News Aggregation**: Automatically fetch and cache news from Telegram channels
- **Discord Bot Integration**: Interactive commands for pool data and analytics
- **Real-time Data Caching**: Efficient caching system using Tigris object storage
- **Multi-provider Support**: Integration with various DeFi protocols

## Installation

This project uses [Bun](https://bun.sh) as the JavaScript runtime.

```bash
bun install
```

## Development

To run locally:

```bash
bun run index.ts
```

## Deployment

This application is deployed using [Fly.io](https://fly.io) for scalable cloud hosting.

## Storage & APIs

- **File Storage**: [Tigris](https://www.tigrisdata.com/) - S3-compatible object storage
- **Discord Integration**: Discord.js for bot functionality and slash commands
- **Telegram Integration**: GramJS for fetching channel messages and news

## Environment Variables

```
ENV=production
DISCORD_APPLICATION_ID=your_discord_app_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_TOKEN=your_discord_bot_token
GUILD_ID=your_discord_guild_id
REDIRECT_URI=your_oauth_redirect_uri
TELEGRAM_API_ID=your_telegram_api_id
TELEGRAM_API_HASH=your_telegram_api_hash
TELEGRAM_SESSION_STRING=your_telegram_session_string
AWS_ACCESS_KEY_ID=your_tigris_access_key
AWS_ENDPOINT_URL_S3=your_tigris_endpoint_url
AWS_REGION=your_tigris_region
AWS_SECRET_ACCESS_KEY=your_tigris_secret_key
BUCKET_NAME=your_tigris_bucket_name
CACHE_DIR=./cache
```

## API Endpoints

### Pool Management
- `GET /pools` - Get all available liquidity pools
- `GET /pools/volume/{component}?provider={provider}` - Get volume data for a specific pool
- `GET /pools/performance?base_token={token}&type={type}&component={component}` - Get LP performance data
- `GET /pools/performance/populate?base_token={token}&type={type}&component={component}&date={date}` - Populate performance data
- `GET /pools/liquidity?component={component}` - Get liquidity distribution for a pool

### Portfolio & Analytics
- `GET /portfolio?address={address}&type={type}` - Get LP portfolio for an account
- `GET /stats` - Get API statistics (pools count, strategies count)

### Strategy Management
- `GET /strategies` - Get all available strategies (v1)
- `GET /strategies/execute?id={id}&account={account}&token_amount={amount}&ltv={ltv}` - Execute a strategy
- `GET /v2/strategies` - Get all available strategies (v2)
- `GET /v2/strategies/execute?account={account}&amount={amount}&strategy_type={type}` - Execute a v2 strategy

### Token & News
- `GET /news?token={token}` - Get news for a specific token
- `POST /swap` - Execute token swaps via Astrolescent

### Authentication & Verification
- `POST /discord/verify-code` - Verify Discord OAuth code
- `GET /rola/create-challenge` - Create ROLA challenge for wallet verification
- `POST /rola/verify` - Verify ROLA challenge response

## Strategy Types (V2)

### Staking Strategies
- **Parameters**: `account`, `amount`, `component`
- **Description**: Automated staking with optimal yield farming

### Liquidation Strategies
- **Parameters**: `account`, `amount`, `resource_address`
- **Description**: Automated liquidation protection and management

### Lending Strategies
- **Parameters**: `account`, `amount`, `resource_address`, `provider`
- **Description**: Optimized lending across multiple protocols

## Discord Bot Commands

The integrated Discord bot supports slash commands for:
- Pool analytics and visualizations
- Token news and updates
- Market data queries
- Interactive charts and reports

## Cron Jobs

The API runs several background tasks:
- **Every 10 minutes**: Update pools cache and strategies cache
- **Every 30 minutes**: Update volume cache for top pools
- **Every 23 hours**: Generate LP performance data
- **Every hour**: Cleanup expired ROLA challenges
- **Daily**: Update token news cache from Telegram channels

## Supported Providers

- **Ociswap**: DEX with precision pools and standard AMM
- **DefiPlaza**: Multi-token liquidity pools
- **Root Finance**: Lending and borrowing protocols
- **Weft Finance**: Staking and yield farming
- **Astrolescent**: Token swaps and routing
