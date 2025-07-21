import { GatewayEzMode } from '@calamari-radix/gateway-ez-mode'
import { getAllPools, type Pool } from './src/getAllPools'
import { getAccountLPPortfolio } from './src/getAccountLPPortfolio'
import { getTokenMetadata, type TokenMetadata } from './src/getTokenMetadata'
import { getExecuteStrategyManifest, getStrategies } from './src/strategies'
import { getOciswapPoolVolumePerDay } from './src/ociswap'
import { STRATEGY_MANIFEST } from './src/strategyManifest'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import type { MetadataGlobalAddressArrayValue } from '@radixdlt/babylon-gateway-api-sdk'
import {
    astrolescentRequest,
    type AstrolescentSwapRequest,
} from './src/astrolescent'
import { getLpPerformance } from './src/pools-simulate'
import cron from 'node-cron'
import { getV2Strategies, type Strategy } from './src/strategiesV2'
import { startDiscordBot } from './src/discord-attos-earn-bot'
import {
    challengeStore,
    cleanupExpiredChallenges,
    verifyRola,
} from './src/rola'
import { validateDiscordUserToken } from './src/discord-api'
import { handleStrategiesV2Staking } from './src/stakingStrategyV2'
import { getTokenNews, updateNewsCache } from './src/news'
import { handleLiquidationStrategy } from './src/liquidiationStrategyV2'
import { handleLendingStrategy } from './src/lendingStrategyV2'
import type { PoolPortfolioItem } from './src/positionProcessor'
import { getFromS3, uploadToS3 } from './src/s3-client'
import { getLiquidityDistribution } from './src/ociswapPrecisionPool'

export const gatewayApiEzMode = new GatewayEzMode()

export const gatewayApi = gatewayApiEzMode.gateway

export const TOKEN_INFO_CACHE: Record<string, TokenMetadata> = {
    resource_rdx1t5ywq4c6nd2lxkemkv4uzt8v7x7smjcguzq5sgafwtasa6luq7fclq:
        await getTokenMetadata(
            'resource_rdx1t5ywq4c6nd2lxkemkv4uzt8v7x7smjcguzq5sgafwtasa6luq7fclq'
        ),
}

export const CACHE_DIR = process.env.CACHE_DIR || './cache'

export const NEWS_CACHE_DIR = `${CACHE_DIR}/news`

if (!existsSync(CACHE_DIR)) {
    // If it doesn't exist, create the directory
    mkdirSync(CACHE_DIR)

    console.log(`Directory '${CACHE_DIR}' created.`)
} else {
    console.log(`Directory '${CACHE_DIR}' already exists.`)
}

export function readCacheFromFile(
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Cache for pools
export let POOLS_CACHE: Pool[] | null = null

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

    // Only get the top 50 pools by volume to limit memory usage
    const poolsToUpdate = POOLS_CACHE.filter((p) => p.type === 'ociswap')
        .sort((a, b) => {
            return (
                b.volume_7d - a.volume_7d ||
                b.bonus_7d - a.bonus_7d ||
                b.tvl - a.tvl
            )
        })
        .slice(0, 20)

    // Process pools sequentially to avoid memory spikes
    for (const pool of poolsToUpdate) {
        try {
            // Get the last update time from the cache file
            let lastUpdated: Date | undefined

            if (existsSync(`${CACHE_DIR}/${pool.component}.json`)) {
                try {
                    const fileContent = readFileSync(
                        `${CACHE_DIR}/${pool.component}.json`,
                        'utf-8'
                    )
                    const cache = JSON.parse(fileContent)
                    lastUpdated = new Date(cache.lastUpdated)
                    lastUpdated.setHours(1, 0, 0, 0)
                } catch (error) {
                    console.error(
                        `Error reading cache for ${pool.component}:`,
                        error
                    )
                    lastUpdated = undefined
                }
            }

            // Get volume data since the last update
            const volumeData = lastUpdated
                ? await getOciswapPoolVolumePerDay(pool.component, lastUpdated)
                : await getOciswapPoolVolumePerDay(pool.component)

            // Write the new data to the cache file
            try {
                // Read existing cache if it exists
                let existingData = {}
                if (existsSync(`${CACHE_DIR}/${pool.component}.json`)) {
                    const fileContent = readFileSync(
                        `${CACHE_DIR}/${pool.component}.json`,
                        'utf-8'
                    )
                    const cache = JSON.parse(fileContent)
                    existingData = cache.data || {}
                }

                // Merge existing data with new data
                const newCacheData: Record<string, number> = {
                    ...existingData,
                    ...volumeData.volume,
                }

                // Only keep the last 7 days of data to limit memory usage
                const dates = Object.keys(newCacheData).sort()
                const lastSevenDayVolume =
                    dates.length > 7
                        ? dates.slice(-7).reduce(
                              (acc, date) => {
                                  acc[date] = newCacheData[date]
                                  return acc
                              },
                              {} as Record<string, number>
                          )
                        : newCacheData

                // Write the updated cache to file
                writeFileSync(
                    `${CACHE_DIR}/${pool.component}.json`,
                    JSON.stringify({
                        data: lastSevenDayVolume,
                        lastUpdated: now,
                    }),
                    'utf-8'
                )

                console.log(
                    `Updated volume cache for pool ${pool.component} at ${new Date(now).toISOString()}`
                )
            } catch (error) {
                console.error(
                    `Error writing cache for ${pool.component}:`,
                    error
                )
            }

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

export let STRATEGIES_V2_CACHE: Strategy[] = []

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
        // Handle OPTIONS requests for CORS preflight
        if (req.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders,
            })
        }

        if (url.pathname === '/pools' && req.method === 'GET') {
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
            const component = url.searchParams.get('component')

            if (!baseToken || !type || !component) {
                return new Response(
                    JSON.stringify({
                        error_codes: [
                            'base_token, type_required',
                            'component_required',
                        ],
                    }),
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                    }
                )
            }

            const lpPerformance = await getFromS3(
                `lp-performance/${baseToken}-${type}-${component}.json`
            )

            if (!lpPerformance) {
                return new Response(
                    JSON.stringify({
                        error_codes: ['performance_data_not_found'],
                    }),
                    {
                        status: 404,
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                    }
                )
            }

            return new Response(lpPerformance, {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders,
                },
            })
        }

        if (
            url.pathname === '/pools/performance/populate' &&
            req.method === 'GET'
        ) {
            const baseToken = url.searchParams.get('base_token')
            const type = url.searchParams.get('type') as 'base' | 'quote' | null
            const component = url.searchParams.get('component')

            if (!baseToken || !type || !component) {
                return new Response(
                    JSON.stringify({
                        error_codes: [
                            'base_token, type_required',
                            'component_required',
                        ],
                    }),
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                    }
                )
            }

            const body = await getLpPerformance(baseToken, type, component)

            if (body) {
                await uploadToS3(
                    `lp-performance/${baseToken}-${type}-${component}.json`,
                    JSON.stringify(body)
                )
            }

            return new Response(
                JSON.stringify({
                    message: 'Performance data uploaded successfully',
                }),
                {
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders,
                    },
                }
            )
        }

        if (url.pathname === '/pools/liquidity' && req.method === 'GET') {
            const component = url.searchParams.get('component')

            if (!component) {
                return new Response(
                    JSON.stringify({
                        error_codes: ['component_required'],
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
                    await getLiquidityDistribution(gatewayApiEzMode, component)
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

        if (url.pathname === '/v2/strategies/execute' && req.method === 'GET') {
            const accountAddress = url.searchParams.get('account')
            const amount = url.searchParams.get('amount')
            const strategy = url.searchParams.get('strategy_type') as
                | 'Liquidation'
                | 'Lending'
                | 'Staking'
                | string
                | null

            if (!accountAddress || !amount) {
                return new Response(
                    JSON.stringify({
                        error_codes: [
                            'account_address_required',
                            'amount_required',
                        ],
                    }),
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                    }
                )
            }

            let manifestResponse: { manifest: string } | undefined

            if (strategy === 'Staking') {
                const componentAddress = url.searchParams.get('component')

                if (!componentAddress) {
                    return new Response(
                        JSON.stringify({
                            error_codes: ['component_address_required'],
                        }),
                        {
                            headers: {
                                'Content-Type': 'application/json',
                                ...corsHeaders,
                            },
                        }
                    )
                }

                manifestResponse = await handleStrategiesV2Staking({
                    accountAddress,
                    componentAddress,
                    amount,
                })
            } else if (strategy === 'Liquidation') {
                const resourceAddress = url.searchParams.get('resource_address')

                if (!resourceAddress) {
                    return new Response(
                        JSON.stringify({
                            error_codes: ['resource_address_required'],
                        }),
                        {
                            headers: {
                                'Content-Type': 'application/json',
                                ...corsHeaders,
                            },
                        }
                    )
                }

                manifestResponse = await handleLiquidationStrategy({
                    accountAddress,
                    resourceAddress,
                    amount,
                })
            } else if (strategy === 'Lending') {
                const resourceAddress = url.searchParams.get('resource_address')
                const provider = url.searchParams.get('provider')

                if (!resourceAddress || !provider) {
                    return new Response(
                        JSON.stringify({
                            error_codes: [
                                'resource_address_required',
                                'provider_required',
                            ],
                        }),
                        {
                            headers: {
                                'Content-Type': 'application/json',
                                ...corsHeaders,
                            },
                        }
                    )
                }

                manifestResponse = await handleLendingStrategy({
                    accountAddress,
                    resourceAddress,
                    provider,
                    amount,
                })
            }

            if (!manifestResponse) {
                return new Response(
                    JSON.stringify({
                        error_codes: ['invalid_strategy'],
                    }),
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                    }
                )
            }

            return new Response(JSON.stringify(manifestResponse), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders,
                },
            })
        }

        if (url.pathname === '/news' && req.method === 'GET') {
            const token = url.searchParams.get('token')

            if (!token) {
                return new Response(
                    JSON.stringify({
                        error_codes: ['token_required'],
                    }),
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                    }
                )
            }

            return new Response(JSON.stringify(await getTokenNews(token)), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders,
                },
            })
        }

        if (url.pathname === '/discord/verify-code') {
            const response = await fetch(
                `https://discord.com/api/oauth2/token`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        client_id: process.env.DISCORD_APPLICATION_ID || '',
                        client_secret: process.env.DISCORD_CLIENT_SECRET || '',
                        grant_type: 'authorization_code',
                        code: (await req.json()).code,
                        redirect_uri:
                            process.env.REDIRECT_URI ||
                            'http://localhost:4200/discord-verify',
                    }),
                }
            )

            const { access_token } = await response.json()

            if (!access_token) {
                return new Response(
                    JSON.stringify({
                        error_codes: ['invalid_token_or_no_token'],
                    }),
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                    }
                )
            }

            return new Response(JSON.stringify({ access_token }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders,
                },
            })
        }

        if (url.pathname === '/rola/create-challenge' && req.method === 'GET') {
            return new Response(
                JSON.stringify({ challenge: challengeStore.create() }),
                {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders,
                    },
                }
            )
        }

        if (url.pathname === '/rola/verify' && req.method === 'POST') {
            const isDiscordVerification =
                req.headers.get('Authorization') ||
                req.headers.get('authorization')

            const discordUser = isDiscordVerification
                ? await validateDiscordUserToken(
                      req.headers.get('Authorization') ||
                          req.headers.get('authorization')
                  )
                : null

            if (isDiscordVerification && !discordUser?.valid) {
                return new Response(
                    JSON.stringify({
                        error_codes: ['invalid_token_or_no_token'],
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
                    await verifyRola(await req.json(), discordUser?.user?.id)
                ),
                {
                    status: 200,
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

async function createAndStoreLpPerformance(date?: Date) {
    const dfpPools = (POOLS_CACHE || [])
        .filter((p) => p.type === 'defiplaza')
        .map((p) => [
            {
                base_token: p.left_token,
                type: 'base',
                component: p.component,
            },
            {
                base_token: p.left_token,
                type: 'quote',
                component: p.component,
            },
        ])
        .flat()

    const ociswapPools = (POOLS_CACHE || [])
        .filter((p) => p.type === 'ociswap' && p.sub_type !== 'precision')
        .map((p) => ({
            base_token: p.base,
            type: p.type,
            component: p.component,
        }))

    const pools = [...ociswapPools, ...dfpPools] as {
        base_token: string
        type: 'ociswap' | 'base' | 'quote'
        component: string
    }[]

    console.log('getting performance for all pools', pools.length)
    let index = 0
    for (const pool of pools) {
        const key = `lp-performance/${pool.base_token}-${pool.type}-${pool.component}.json`

        const performance = await getLpPerformance(
            pool.base_token,
            pool.type,
            pool.component,
            date
        )

        if (performance) {
            console.log('got performance ', pool.component)
            await uploadToS3(key, JSON.stringify(performance))
            index += 1
            console.log('uploaded 90 day performance ', index)
        }
    }
    console.log('finished getting performance for all pools')
}

console.log(`Server running on http://localhost:${port}/`)

if (process.env.CACHE_DIR) {
    startDiscordBot()
}

console.log('Finished volume pools cache')

// Initial cache update
await Promise.all([
    updatePoolsCache(BRIDGED_TOKENS),
    updateStrategiesV2Cache(),
    updateNewsCache(),
])

// await Promise.all([
//     createAndStoreLpPerformance(
//         new Date(new Date().getTime() - 24 * 60 * 60 * 1000) // 24 hours ago
//     ),
// ])

// await createAndStoreLpPerformance(
//     new Date(new Date().getTime() - 24 * 60 * 60 * 1000 * 8)
// )

// Update pools cache every 10 minutes using cron
// "*/10 * * * *" means "every 10 minutes"
cron.schedule('*/10 * * * *', () => {
    console.log('Running pools cache update (scheduled task)')
    updatePoolsCache(BRIDGED_TOKENS)
})

cron.schedule('*/10 * * * *', () => {
    console.log('Running strategies cache update (scheduled task)')
    updateStrategiesV2Cache()
})

// Update volume cache every 30 minutes using cron
// "*/15 * * * *" means "every 30 minutes"
cron.schedule('*/30 * * * *', () => {
    console.log('Running volume cache update (scheduled task)')
    updatePoolsVolumeCache().then(() => {
        console.log('finished updating volume cache (sheduled task)')
    })
})

// update news cache every 24 hours
cron.schedule('0 */23 * * *', () => {
    const last24HoursAgo = new Date(
        new Date().getTime() - 24 * 60 * 60 * 1000 * 8
    )
    createAndStoreLpPerformance(last24HoursAgo)
})

// update news cache every 24 hours
cron.schedule('0 */24 * * *', () => {
    updateNewsCache()
})

// Update volume cache every 30 minutes using cron
// "*/15 * * * *" means "every 30 minutes"
cron.schedule('*/30 * * * *', () => {
    console.log('Running volume cache update (scheduled task)')
    updatePoolsVolumeCache().then(() => {
        console.log('finished updating volume cache (sheduled task)')
    })
})

cron.schedule('0 * * * *', () => {
    console.log('Running challenge files cleanup (scheduled task)')
    cleanupExpiredChallenges()
})
