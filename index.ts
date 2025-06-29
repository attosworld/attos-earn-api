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
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import type { MetadataGlobalAddressArrayValue } from '@radixdlt/babylon-gateway-api-sdk'
import {
    astrolescentRequest,
    type AstrolescentSwapRequest,
} from './src/astrolescent'
import { getLpPerformance } from './pools-simulate'
import cron from 'node-cron'
import { getV2Strategies, type Strategy } from './src/strategiesV2'

export const gatewayApiEzMode = new GatewayEzMode()

export const gatewayApi = gatewayApiEzMode.gateway

export const TOKEN_INFO_CACHE: Record<string, TokenMetadata> = {
    resource_rdx1t5ywq4c6nd2lxkemkv4uzt8v7x7smjcguzq5sgafwtasa6luq7fclq:
        await getTokenMetadata(
            'resource_rdx1t5ywq4c6nd2lxkemkv4uzt8v7x7smjcguzq5sgafwtasa6luq7fclq'
        ),
}

const CACHE_DIR = process.env.CACHE_DIR || './cache'

if (!existsSync(CACHE_DIR)) {
    // If it doesn't exist, create the directory
    mkdirSync(CACHE_DIR)

    console.log(`Directory '${CACHE_DIR}' created.`)
} else {
    console.log(`Directory '${CACHE_DIR}' already exists.`)
}

function readCacheFromFile(
    poolComponent: string
): { data: number[]; lastUpdated: number } | null {
    if (existsSync(`${CACHE_DIR}/${poolComponent}.json`)) {
        try {
            const fileContent = readFileSync(
                `${CACHE_DIR}/${poolComponent}.json`,
                'utf-8'
            )
            const cache = JSON.parse(fileContent)
            return cache || null
        } catch (error) {
            console.error('Error reading cache from file:', error)
            return null
        }
    }
    return null
}

function writeCacheToFile(
    poolComponent: string,
    data: Record<string, number>,
    lastUpdated: number
) {
    try {
        const cache = existsSync(`${CACHE_DIR}/${poolComponent}.json`)
            ? JSON.parse(
                  readFileSync(`${CACHE_DIR}/${poolComponent}.json`, 'utf-8')
              )
            : { data: {}, lastUpdated: 0 }

        const newCacheData = { ...cache.data, ...data }
        const lastSevenDayVolume = Object.keys(newCacheData)
            .slice(-7)
            .reduce((acc, item) => ({ ...acc, [item]: newCacheData[item] }), {})

        writeFileSync(
            `${CACHE_DIR}/${poolComponent}.json`,
            JSON.stringify({ data: lastSevenDayVolume, lastUpdated }),
            'utf-8'
        )
        console.log(`Cache updated for pool ${poolComponent}`)
    } catch (error) {
        console.error('Error writing cache to file:', error)
    }
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

export const BOOSTED_POOLS_CACHE: Record<string, { docs: string }> = {
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
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

// Cache for pools
export let POOLS_CACHE: Pool[] | null = null

const CACHE_DURATION = 60000

// Function to update the cache
async function updatePoolsCache(bridgedTokens: Set<string>) {
    try {
        POOLS_CACHE = await getAllPools(bridgedTokens)
        console.log('CACHE LENGTH ', POOLS_CACHE.length)
        console.log('Pools cache updated at', new Date().toISOString())
    } catch (error) {
        console.error('Error updating pools cache:', error)
    }
}

async function getBridgedTokens() {
    return new Set(
        (
            (
                await gatewayApi.state.getEntityMetadata(
                    'account_rdx1cxamqz2f03s8g6smfz32q2gr3prhwh3gqdkdk93d8q8srp8d38cs7e'
                )
            ).items.find((k) => k.key === 'claimed_entities')?.value
                .typed as MetadataGlobalAddressArrayValue
        ).values
    )
}

// Function to update the cache
async function updatePoolsVolumeCache() {
    if (!POOLS_CACHE) return

    const now = Date.now()

    const pools = POOLS_CACHE.filter((p) => p.type === 'ociswap').sort(
        (a, b) => {
            return (
                b.volume_7d - a.volume_7d ||
                b.bonus_7d - a.bonus_7d ||
                b.tvl - a.tvl
            )
        }
    )

    const poolsToUpdate = pools.slice(0, 50)

    for (const pool of poolsToUpdate) {
        try {
            const lastUpdated = existsSync(
                `${CACHE_DIR}/${pool.component}.json`
            )
                ? new Date(
                      JSON.parse(
                          readFileSync(
                              `${CACHE_DIR}/${pool.component}.json`,
                              'utf-8'
                          )
                      ).lastUpdated
                  )
                : undefined

            lastUpdated?.setHours(1, 0, 0, 0)
            const volumeData = lastUpdated
                ? await getOciswapPoolVolumePerDay(pool.component, lastUpdated)
                : await getOciswapPoolVolumePerDay(pool.component)

            writeCacheToFile(pool.component, volumeData.volume, now)
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
}

let STRATEGIES_V2_CACHE: Strategy[] = []

async function updateStrategiesV2Cache() {
    STRATEGIES_V2_CACHE = await getV2Strategies()
    console.log('Strategies V2 cache updated at', new Date().toISOString())
}

const BRIDGED_TOKENS = await getBridgedTokens()

const port = process.env.PORT || 3000

Bun.serve({
    port,
    idleTimeout: 30,
    async fetch(req) {
        const url = new URL(req.url)
        if (url.pathname === '/pools' && req.method === 'GET') {
            // const mode = url.searchParams.get('mode')

            // if (mode === 'categorized') {
            //     const poolsByTags = POOLS_CACHE?.reduce(
            //         (acc, pool) => {
            //             if (pool.tags.length) {
            //                 pool.tags.forEach((tag) => {
            //                     if (!acc[tag]) {
            //                         acc[tag] = []
            //                     }
            //                     acc[tag].push(pool)
            //                 })
            //             } else {
            //                 if (!acc.uncategorized) {
            //                     acc.uncategorized = []
            //                 }
            //                 acc.uncategorized.push(pool)
            //             }
            //             return acc
            //         },
            //         {} as Record<string, Pool[]>
            //     )

            //     return new Response(JSON.stringify(poolsByTags), {
            //         headers: {
            //             'Content-Type': 'application/json',
            //             ...corsHeaders,
            //         },
            //     })
            // }
            // Always return the cached data, which is updated in the background
            return new Response(JSON.stringify(POOLS_CACHE), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
        }

        if (url.pathname.startsWith('/pools/volume') && req.method === 'GET') {
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
                    const cache = readCacheFromFile(poolComponent)
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
                    const volumeData =
                        await getOciswapPoolVolumePerDay(poolComponent)
                    writeCacheToFile(
                        poolComponent,
                        volumeData.volume,
                        Date.now()
                    )

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

        if (url.pathname === '/portfolio' && req.method === 'GET') {
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

        if (url.pathname === '/strategies' && req.method === 'GET') {
            return new Response(JSON.stringify(await getStrategies()), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
        }

        if (url.pathname === '/strategies/execute' && req.method === 'GET') {
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

        if (url.pathname === '/stats' && req.method === 'GET') {
            return new Response(
                JSON.stringify({
                    pools: POOLS_CACHE?.length || 0,
                    strategies:
                        (Object.keys(STRATEGY_MANIFEST).length || 0) +
                        STRATEGIES_V2_CACHE.length,
                }),
                {
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders,
                    },
                }
            )
        }

        // Handle OPTIONS requests for CORS preflight
        if (req.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders,
            })
        }

        if (url.pathname === '/swap' && req.method === 'POST') {
            const body = (await req.json()) as AstrolescentSwapRequest

            return new Response(
                JSON.stringify(
                    await astrolescentRequest(body).then((res) => res.json())
                ),
                {
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders,
                    },
                }
            )
        }

        if (url.pathname === '/pools/performance' && req.method === 'GET') {
            const baseToken = url.searchParams.get('base_token')
            const type = url.searchParams.get('type') as 'base' | 'quote' | null

            if (!baseToken || !type) {
                return new Response(
                    JSON.stringify({
                        error_codes: ['base_token_and_type_required'],
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
                    await getLpPerformance(baseToken, type, '45653')
                ),
                {
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders,
                    },
                }
            )
        }

        if (url.pathname === '/v2/strategies' && req.method === 'GET') {
            return new Response(JSON.stringify(STRATEGIES_V2_CACHE), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders,
                },
            })
        }

        return new Response(null, {
            status: 404,
            headers: corsHeaders,
        })
    },
})

console.log(`Server running on http://localhost:${port}/`)

// Initial cache update
await Promise.all([updatePoolsCache(BRIDGED_TOKENS), updateStrategiesV2Cache()])

// Update pools cache every 5 minutes using cron
// "*/5 * * * *" means "every 5 minutes"
cron.schedule('*/5 * * * *', async () => {
    console.log('Running pools cache update (scheduled task)')
    await updatePoolsCache(BRIDGED_TOKENS)
})

cron.schedule('*/5 * * * *', async () => {
    console.log('Running strategies cache update (scheduled task)')
    await updateStrategiesV2Cache()
})

// Update volume cache every 15 minutes using cron
// "*/15 * * * *" means "every 15 minutes"
cron.schedule('*/15 * * * *', async () => {
    console.log('Running volume cache update (scheduled task)')
    if (process.env.CACHE_DIR) {
        await updatePoolsVolumeCache()
    }
})
