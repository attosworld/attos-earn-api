import { POOLS_CACHE } from '..'
import {
    XRD_RESOURCE_ADDRESS,
    XUSDC_RESOURCE_ADDRESS,
} from './resourceAddresses'
import { STRATEGY_MANIFEST } from './strategyManifest'

export interface Strategy {
    id: string
    component: string | null
    buyToken: string | null
    name: string
    description: string
    steps: {
        icon: string
        label: string
    }[]
    requiredAssets: { resource_address: string; symbol: string }[]
    rewardTokens: string[]
    totalRewards: {
        value: number
        type: 'APY' | 'APR'
    }
    rewardsBreakdown: {
        token: string
        apy: number
    }[]
    dappsUtilized: {
        icon: string
        label: string
    }[]
    fieldsRequired: { fieldName: string; type: string }[]
    ltvLimit: string
    ltvLiquidation: string
    optimalLtv: string
    poolType?: string
}

export interface AssetPrice {
    assetName: string
    assetPrice: number
}

export interface RootMarketPrices {
    prices: AssetPrice[]
}

export async function getRootMarketPrices(): Promise<RootMarketPrices> {
    return fetch('https://backend-prod.rootfinance.xyz/api/markets/prices', {
        headers: {
            accept: 'application/json, text/plain, */*',
            'accept-language': 'en-GB,en;q=0.7',
        },
        body: null,
        method: 'GET',
    })
        .then((res) => res.json())
        .catch((err) => console.error(err))
}

export interface RootMarketStats {
    totalValueLocked: number
    totalProtocolBorrowed: number
    totalProtocolSupplied: number
    assets: {
        [key: string]: {
            resource: string
            availableLiquidity: string
            totalLiquidity: { amount: string; value: number }
            totalSupply: { amount: string; value: number }
            totalBorrow: { amount: string; value: number }
            lendingAPY: number
            borrowAPY: number
            optimalUsage: string
            LTVLimit: string
        }
    }
}

export async function getRootMarketStats(): Promise<RootMarketStats> {
    try {
        const response = await fetch(
            'https://backend-prod.rootfinance.xyz/api/markets/stats',
            {
                headers: {
                    accept: 'application/json, text/plain, */*',
                },
                method: 'GET',
            }
        )

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        return await response.json()
    } catch (error) {
        console.error('Error fetching Root market stats:', error)
        throw error
    }
}

export interface SurgeStats {
    apy: {
        start_datetime: string
        tooltip: {
            'Approx LP Rewards': number
            'Trade Fees': number
        }
        value: number
    }
    data: {
        pool_now: {
            datetime: string
            price: number
            total_amount: number
            total_supply: number
        }
        pool_past: {
            datetime: string
            price: number
            total_amount: number
            total_supply: number
        }
    }
    fees_pool: {
        '24hours': string
        '30days': string
        '7days': string
        all_time: string
    }
    fees_protocol: {
        '24hours': string
        '30days': string
        '7days': string
        all_time: string
    }
    last_updated: string
    tvl: number
    volume: {
        '24hours': string
        '30days': string
        '7days': string
        all_time: string
    }
}

export async function getSurgeStats(): Promise<SurgeStats> {
    try {
        const response = await fetch('https://api.surge.trade/stats', {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data: SurgeStats = await response.json()
        return data
    } catch (error) {
        console.error('Error fetching Surge stats:', error)
        throw error
    }
}

async function getRootFinanceLendXrdBorrowUsdProvideSurgeLP(
    stats: RootMarketStats
): Promise<Strategy | null> {
    try {
        const surgeStats = await getSurgeStats()

        const surgeLpApy = surgeStats.apy.value * 100 // Convert to percentage
        const xrdLendingApy = stats.assets.radix.lendingAPY

        const estimatedTotalApy = xrdLendingApy + surgeLpApy

        return {
            id: 'root-surge',
            name: 'Root Points, Yield Surge LP',
            component: null,
            buyToken: null,
            description:
                'Lend XRD, borrow xUSDC, and provide xUSDC to Surge for optimal returns.',
            steps: [
                {
                    icon: 'https://assets.radixdlt.com/icons/icon-xrd.png',
                    label: 'Lend XRD',
                },
                {
                    icon: 'https://assets.instabridge.io/tokens/icons/xUSDC.png',
                    label: 'Borrow xUSDC',
                },
                {
                    icon: 'https://image-service.radixdlt.com/?imageSize=256x256&imageOrigin=https%3A%2F%2Fsurge.trade%2Fimages%2Fsurge_lp_token.png',
                    label: 'Surge LP',
                },
            ],
            requiredAssets: [
                {
                    resource_address: XRD_RESOURCE_ADDRESS,
                    symbol: 'XRD',
                },
            ],
            rewardTokens: [],
            totalRewards: {
                value: estimatedTotalApy,
                type: 'APY',
            },
            rewardsBreakdown: [
                { token: 'XRD', apy: xrdLendingApy },
                { token: 'xUSDC', apy: surgeLpApy },
            ],
            dappsUtilized: [
                {
                    icon: 'https://app.rootfinance.xyz/favicon.ico',
                    label: 'RootFinance',
                },
                {
                    icon: 'https://surge.trade/images/icon_dapp.png',
                    label: 'Surge',
                },
            ],
            fieldsRequired: [{ fieldName: 'ltv', type: 'slider' }],
            ltvLimit: `${+stats.assets.radix.LTVLimit * 100}`,
            ltvLiquidation: '65',
            optimalLtv: `${+stats.assets.radix.optimalUsage * 100}`,
        }
    } catch (error) {
        console.error(
            'Error in getRootFinanceLendXrdBorrowUsdProvideSurgeLP:',
            error
        )
        return null
    }
}

async function getLPIncentiveStrategies(
    stats: RootMarketStats
): Promise<Strategy[]> {
    try {
        const pools =
            POOLS_CACHE?.filter(
                (p) => p.boosted && p.left_alt && p.right_alt
            ) || []

        return pools.map((pool) => {
            const usdLendingApy = stats.assets['usd-coin'].lendingAPY

            const estimatedTotalApy = usdLendingApy + +pool.bonus_7d

            const provider = pool.bonus_name === 'ALR' ? 'Defiplaza' : 'Ociswap'

            const id = `root-${provider.toLowerCase()}-${pool.name.toLowerCase()}`

            STRATEGY_MANIFEST[id] = {
                manifest: STRATEGY_MANIFEST['xusdc-lp'].manifest,
                poolProvider: provider,
                generateManifest:
                    STRATEGY_MANIFEST['xusdc-lp'].generateManifest,
            }

            return {
                id,
                name: `Root Points, Yield ${pool.left_alt} in ${provider}`,
                description: `Lend xUSDC, borrow XRD, swap for ${pool.left_alt}, provide LP to ${provider}`,
                steps: [
                    {
                        icon: 'https://assets.instabridge.io/tokens/icons/xUSDC.png',
                        label: 'Lend xUSDC',
                    },
                    {
                        icon: 'https://assets.radixdlt.com/icons/icon-xrd.png',
                        label: 'Borrow XRD',
                    },
                    {
                        icon: pool.left_icon,
                        label: `Swap for ${pool.left_alt}`,
                    },
                    {
                        icon: pool.left_icon,
                        label: `Add LP to ${pool.name}`,
                    },
                ],
                requiredAssets: [
                    {
                        resource_address: XUSDC_RESOURCE_ADDRESS,
                        symbol: 'xUSDC',
                    },
                ],
                rewardTokens: [pool.left_alt],
                totalRewards: {
                    value: estimatedTotalApy,
                    type: 'APY',
                },
                rewardsBreakdown: [
                    { token: 'xUSDC', apy: usdLendingApy },
                    { token: pool.name, apy: pool.bonus_7d },
                ],
                dappsUtilized: [
                    {
                        icon: 'https://app.rootfinance.xyz/favicon.ico',
                        label: 'RootFinance',
                    },
                    {
                        icon:
                            provider === 'Ociswap'
                                ? 'https://ociswap.com/icons/oci.png'
                                : 'https://static.defiplaza.net/website/uploads/2023/09/25115716/defiplaza-dex-icon-stokenet.png',
                        label: provider,
                    },
                ],
                fieldsRequired: [{ fieldName: 'ltv', type: 'slider' }],
                component: pool.component,
                buyToken: pool.left_token,
                ltvLimit: `${+stats.assets['usd-coin'].LTVLimit * 100}`,
                ltvLiquidation: '80',
                optimalLtv: `${+stats.assets['usd-coin'].optimalUsage * 100}`,
                poolType: pool.sub_type,
                currentPrice: pool.current_price,
                buyingSymbol: pool.left_alt,
                askPrice: pool.ask_price,
            } as Strategy
        })
    } catch (error) {
        console.error(
            'Error in getRootFinanceLendXrdBorrowUsdProvideSurgeLP:',
            error
        )
        throw new Error('Failed to fetch LP incentive strategies')
    }
}

export async function getStrategies() {
    const stats = await getRootMarketStats()

    return [
        await getRootFinanceLendXrdBorrowUsdProvideSurgeLP(stats),
        ...(await getLPIncentiveStrategies(stats)),
    ]
        .filter(Boolean)
        .sort((a, b) => {
            return +(b?.totalRewards.value || 0) - (a?.totalRewards.value || 0)
        })
}

export async function getExecuteStrategyManifest(
    strategyId: string,
    xrd: string,
    accountAddress: string,
    ltv: number | undefined,
    buyToken: string | null,
    component: string | null,
    leftPercentage: number | null,
    rightPercentage: number | null
) {
    const strategy =
        STRATEGY_MANIFEST[strategyId as keyof typeof STRATEGY_MANIFEST]

    return {
        manifest: await strategy.generateManifest(
            strategyId,
            strategy.manifest,
            accountAddress,
            xrd.toString(),
            ltv,
            buyToken,
            component,
            leftPercentage,
            rightPercentage
        ),
    }
}
