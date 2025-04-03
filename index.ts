import { GatewayEzMode } from '@calamari-radix/gateway-ez-mode'
import { getAllPools, type Pool } from './getAllPools'
import {
    getAccountLPPortfolio,
    type PoolPortfolioItem,
} from './getAccountLPPortfolio'
import { getTokenMetadata, type TokenMetadata } from './getTokenMetadata'
import { getExecuteStrategyManifest, getStrategies } from './src/strategies'

export const gatewayApiEzMode = new GatewayEzMode()

export const gatewayApi = gatewayApiEzMode.gateway

export const TOKEN_INFO: Record<string, TokenMetadata> = {
    resource_rdx1t5ywq4c6nd2lxkemkv4uzt8v7x7smjcguzq5sgafwtasa6luq7fclq:
        await getTokenMetadata(
            'resource_rdx1t5ywq4c6nd2lxkemkv4uzt8v7x7smjcguzq5sgafwtasa6luq7fclq'
        ),
}

export const PAIR_NAME_CACHE: Record<
    string,
    {
        name: string
        left_alt: string
        left_icon: string
        right_alt: string
        right_icon: string
        provider: string
    }
> = {}

export const BOOSTED_POOLS: Record<string, { docs: string }> = {
    component_rdx1cqvxkaazmpnvg3f9ufc5n2msv6x7ztjdusdm06lhtf5n7wr8guggg5: {
        docs: 'https://docs.astrolescent.com/astrolescent-docs/tokens/rewards/providing-liquidity',
    },
    component_rdx1cz9akawaf6d2qefds33c5py9w3fjpgp2qnaddtlcxm06m060wl2j68: {
        docs: 'https://docs.ilikeitstable.com/ilis-dao/using-ilis-dao/incentives',
    },
    component_rdx1cr9tj8xd5cjs9mzkqdnamrzq0xgy4eylk75vhqqzka5uxsxatv4wxd: {
        docs: 'https://docs.ilikeitstable.com/ilis-dao/using-ilis-dao/incentives',
    },
    component_rdx1cp4t3jju9rv7dpeeqr3nh3wle0cezjc0k34k6hxd8rtzqzanhmsv5f: {
        docs: 'https://wowoproject.com/wowo-bank/',
    },
    component_rdx1cpzydtpn2pvq5xp584mk5hz0nakq4dr5e6xv8mwhpuzd4flu6t2jv5: {
        docs: 'https://wowoproject.com/wowo-bank/',
    },
    component_rdx1cp6fus3tmgfddxvfksn9ng8nh7rd0zqyarl3pgvatzfcwdzuq4nvst: {
        docs: 'https://wowoproject.com/wowo-bank/',
    },
    component_rdx1cz5jtknztc26heh2w0kmrx25h0k7zlhrthrnxum5yq6jvlgal46n2g: {
        docs: 'https://wowoproject.com/wowo-bank/',
    },
    component_rdx1cr9kzxefdnadsrmajswvenf803fgw8j4h8jlcse4z3m2t3q384xdup: {
        docs: 'https://howto.hug.meme/proof-of-hug/intro-to-poh/liquidity-provisioning',
    },
    component_rdx1cr8hdtxhz7k6se6pgyrqa66sdlc06kjchfzjcl6pl2er8ratyfyre8: {
        docs: 'https://howto.hug.meme/proof-of-hug/intro-to-poh/liquidity-provisioning',
    },
    component_rdx1cz5fuzruncczpsz6kksz7zjvg3u4a94ll97ua868357vhzme490ymt: {
        docs: 'https://howto.hug.meme/proof-of-hug/intro-to-poh/liquidity-provisioning',
    },
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

// Cache for pools
let poolsCache: Pool[] | null = null
const CACHE_DURATION = 30000

// Function to update the cache
async function updatePoolsCache() {
    try {
        poolsCache = await getAllPools()
        console.log('Pools cache updated at', new Date().toISOString())
    } catch (error) {
        console.error('Error updating pools cache:', error)
    }
}

// Initial cache update
await updatePoolsCache()

// Set up background job to update cache every 5 minutes
setInterval(updatePoolsCache, CACHE_DURATION)

const port = process.env.PORT || 3000

Bun.serve({
    port,
    async fetch(req) {
        const url = new URL(req.url)
        if (url.pathname === '/pools') {
            // Always return the cached data, which is updated in the background
            return new Response(JSON.stringify(poolsCache), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
        }

        if (url.pathname === '/portfolio') {
            const address = url.searchParams.get('address')

            if (!address || !address.startsWith('account_rdx')) {
                return new Response(
                    JSON.stringify({ error_codes: ['address_invalid'] }),
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                    }
                )
            }

            const portfolioPnL: PoolPortfolioItem[] =
                await getAccountLPPortfolio(address)

            return new Response(JSON.stringify(portfolioPnL), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
        }

        if (url.pathname === '/strategies') {
            return new Response(JSON.stringify(await getStrategies()), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
        }

        if (url.pathname === '/strategies/execute') {
            const strategyId = url.searchParams.get('id')
            const accountAddress = url.searchParams.get('account')
            const xrdAmount = url.searchParams.get('xrd_amount')

            if (!strategyId) {
                return new Response(
                    JSON.stringify({
                        error_codes: ['strategy_name_invalid_or_required'],
                    }),
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                    }
                )
            }

            if (!accountAddress || !accountAddress.startsWith('account_rdx')) {
                return new Response(
                    JSON.stringify({
                        error_codes: ['address_invalid_or_required'],
                    }),
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                    }
                )
            }

            if (!xrdAmount || isNaN(Number(xrdAmount))) {
                return new Response(
                    JSON.stringify({
                        error_codes: ['xrd_amount_invalid_or_required'],
                    }),
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                    }
                )
            }

            return new Response(
                JSON.stringify(
                    await getExecuteStrategyManifest(
                        strategyId,
                        xrdAmount,
                        accountAddress
                    )
                ),
                {
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders,
                    },
                }
            )
        }

        return new Response(null, {
            status: 404,
            headers: corsHeaders,
        })
    },
})

console.log(`Server running on http://localhost:${port}/`)
