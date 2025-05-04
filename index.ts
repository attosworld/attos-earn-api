import { GatewayEzMode } from '@calamari-radix/gateway-ez-mode'
import { getAllPools, type Pool } from './getAllPools'
import {
    getAccountLPPortfolio,
    type PoolPortfolioItem,
} from './getAccountLPPortfolio'
import { getTokenMetadata, type TokenMetadata } from './getTokenMetadata'
import { getExecuteStrategyManifest, getStrategies } from './src/strategies'
import { getOciswapPoolVolumePerDay } from './src/ociswap'
import { STRATEGY_MANIFEST } from './src/strategyManifest'

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
        left_token: string
        right_token: string
        provider: string
        component: string
        type?: string
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
export let POOLS_CACHE: Pool[] | null = null

const CACHE_DURATION = 60000

export const POOLS_VOLUME_CACHE: Record<
    string,
    { data: number[]; lastUpdated: number }
> = {}

// Function to update the cache
async function updatePoolsCache() {
    try {
        POOLS_CACHE = await getAllPools()
        console.log('CACHE LENGTH ', POOLS_CACHE.length)
        console.log('Pools cache updated at', new Date().toISOString())
    } catch (error) {
        console.error('Error updating pools cache:', error)
    }
}

// Function to update the cache
async function updatePoolsVolumeCache() {
    if (!POOLS_CACHE) return

    const now = Date.now()

    const pools = POOLS_CACHE.filter(
        (p) => p.type === 'ociswap' && shouldUpdatePool(p.component, now)
    ).sort((a, b) => {
        return (
            b.volume_7d - a.volume_7d ||
            b.bonus_7d - a.bonus_7d ||
            b.tvl - a.tvl
        )
    })

    const poolsToUpdate = pools.slice(0, 10)

    for (const pool of poolsToUpdate) {
        try {
            const volumeData = await getOciswapPoolVolumePerDay(
                pool.component,
                7
            )
            POOLS_VOLUME_CACHE[pool.component] = {
                data: volumeData.volume,
                lastUpdated: now,
            }
            console.log(
                `Updated volume cache for pool ${pool.component} at ${new Date(now).toISOString()}`
            )

            // Add a small delay between requests to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 1000))
        } catch (error) {
            console.error(
                `Error updating volume cache for pool ${pool.component}:`,
                error
            )
        }
    }
    console.log('Volume cache length ', Object.keys(POOLS_VOLUME_CACHE).length)
}

function shouldUpdatePool(poolComponent: string, now: number): boolean {
    const cache = POOLS_VOLUME_CACHE[poolComponent]
    if (!cache) return true

    const hoursSinceLastUpdate = (now - cache.lastUpdated) / (1000 * 60 * 60)
    const pool = POOLS_CACHE?.find((p) => p.component === poolComponent)

    if (!pool) return true

    // Update more frequently for high-volume pools
    if (pool.volume_7d > 1000000) return hoursSinceLastUpdate >= 1
    if (pool.volume_7d > 100000) return hoursSinceLastUpdate >= 3
    if (pool.volume_7d > 10000) return hoursSinceLastUpdate >= 6

    // For low-volume pools, update once a day
    return hoursSinceLastUpdate >= 24
}

// Initial cache update
await updatePoolsCache()

// await updatePoolsVolumeCache()

await getStrategies()

// Set up background job to update cache every 5 minutes
setInterval(updatePoolsCache, CACHE_DURATION)

// Update volume cache once per days
setInterval(updatePoolsVolumeCache, 15 * 60 * 1000)

const port = process.env.PORT || 3000

Bun.serve({
    port,
    async fetch(req) {
        const url = new URL(req.url)
        if (url.pathname === '/pools') {
            // Always return the cached data, which is updated in the background
            return new Response(JSON.stringify(POOLS_CACHE), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
        }

        if (url.pathname.startsWith('/pools/volume')) {
            const poolComponent = url.pathname.split('/')[3]
            const provider = url.searchParams.get('provider')

            if (!poolComponent) {
                return new Response(
                    JSON.stringify({ error_codes: ['pool_invalid'] }),
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                    }
                )
            }

            if (!provider) {
                return new Response(
                    JSON.stringify({ error_codes: ['provider_invalid'] }),
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                    }
                )
            }

            switch (provider) {
                case 'defiplaza': {
                    const poolInfo = POOLS_CACHE?.find(
                        (pool) => pool.component === poolComponent
                    )

                    if (!poolInfo) {
                        return new Response(
                            JSON.stringify({ error_codes: ['pool_not_found'] }),
                            {
                                status: 404,
                                headers: {
                                    'Content-Type': 'application/json',
                                    ...corsHeaders,
                                },
                            }
                        )
                    }

                    const volume_per_day = poolInfo.volume_per_day || []

                    return new Response(JSON.stringify({ volume_per_day }), {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                        status: 200,
                    })
                }
                case 'ociswap': {
                    const cache = POOLS_VOLUME_CACHE[poolComponent]
                    if (cache) {
                        return new Response(
                            JSON.stringify({ volume_per_day: cache.data }),
                            {
                                headers: {
                                    'Content-Type': 'application/json',
                                    ...corsHeaders,
                                },
                                status: 200,
                            }
                        )
                    }

                    // If not in cache, fetch and cache the data
                    const volumeData = await getOciswapPoolVolumePerDay(
                        poolComponent,
                        7
                    )
                    POOLS_VOLUME_CACHE[poolComponent] = {
                        data: volumeData.volume,
                        lastUpdated: Date.now(),
                    }

                    return new Response(
                        JSON.stringify({ volume_per_day: volumeData.volume }),
                        {
                            headers: {
                                'Content-Type': 'application/json',
                                ...corsHeaders,
                            },
                            status: 200,
                        }
                    )
                }
            }
            // Always return the cached data, which is updated in the background
            return new Response(JSON.stringify(POOLS_CACHE), {
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
            const tokenAmount = url.searchParams.get('token_amount')
            const ltv = url.searchParams.get('ltv')
            const buyToken = url.searchParams.get('buy_token')
            const component = url.searchParams.get('component')
            const leftPercentage = url.searchParams.get('min_percentage')
            const rightPercentage = url.searchParams.get('max_percentage')
            const xTokenAmount = url.searchParams.get('x_token_amount')
            const yTokenAmount = url.searchParams.get('y_token_amount')

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

            if (!tokenAmount || isNaN(Number(tokenAmount))) {
                return new Response(
                    JSON.stringify({
                        error_codes: ['token_amount_invalid_or_required'],
                    }),
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                    }
                )
            }

            if (ltv && isNaN(Number(ltv)) && +ltv > 60) {
                return new Response(
                    JSON.stringify({
                        error_codes: ['ltv_invalid_or_required'],
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
                        tokenAmount,
                        accountAddress,
                        ltv ? +ltv / 100 : undefined,
                        buyToken,
                        component,
                        leftPercentage ? +leftPercentage : null,
                        rightPercentage ? +rightPercentage : null,
                        xTokenAmount,
                        yTokenAmount
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

        if (url.pathname === '/stats') {
            return new Response(
                JSON.stringify({
                    pools: POOLS_CACHE?.length || 0,
                    strategies: Object.keys(STRATEGY_MANIFEST).length || 0,
                }),
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
