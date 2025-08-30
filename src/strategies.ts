import { POOLS_CACHE } from '..'
import type { Pool } from '../src/getAllPools'
import { previewTx } from './previewTx'
import {
    DFP2_RESOURCE_ADDRESS,
    XRD_RESOURCE_ADDRESS,
    XUSDC_RESOURCE_ADDRESS,
} from './resourceAddresses'
import { getRootMarketStats, type RootMarketStats } from './rootFinance'
import { STRATEGY_MANIFEST } from './strategyManifest'
import { getSurgeStats } from './surge'

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
    poolInfo?: Pool
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
async function getRootFinanceLendXrdBorrowUsdProvideSurgeLP(
    stats: RootMarketStats
): Promise<Strategy | null> {
    try {
        const surgeStats = await getSurgeStats()

        if (!surgeStats) return null

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

async function getLPIncentiveAndHighBonusStrategies(
    stats: RootMarketStats,
    prices: RootMarketPrices
): Promise<Strategy[]> {
    try {
        const pools = [
            ...(POOLS_CACHE?.filter(
                (p) =>
                    p.boosted &&
                    p.left_alt &&
                    p.right_alt &&
                    p.sub_type !== 'precision'
            ) || []),
            ...(POOLS_CACHE?.filter((p) => p.left_alt && p.right_alt)
                .slice(0, 30)
                .filter(
                    (p) =>
                        !p.boosted &&
                        p.type !== 'defiplaza' &&
                        p.right_token !== DFP2_RESOURCE_ADDRESS &&
                        p.sub_type !== 'precision'
                )
                .sort((a, b) => a.bonus_7d - b.bonus_7d) || []),
            // ...(POOLS_CACHE?.filter(
            //     (p) => p.sub_type === 'single'
            //     // p.bonus_7d >= 5 &&
            //     // p.volume_7d >= 1000
            // ).sort((a, b) => a.bonus_7d - b.bonus_7d) || []),
        ]

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
                name: `Root Points, Yield ${pool.left_alt ? pool.left_alt : pool.right_alt} in ${provider}`,
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
                    pool.type === 'defiplaza' &&
                        pool.sub_type === 'single' &&
                        pool.left_alt !== 'XRD' &&
                        pool.right_alt !== 'XRD' && {
                            icon: 'https://radix.defiplaza.net/assets/img/babylon/defiplaza-icon.png',
                            label: 'Swap for DFP2',
                        },
                    pool.sub_type !== 'single' && {
                        icon:
                            pool.left_alt === 'XRD'
                                ? pool.right_icon
                                : pool.left_icon,
                        label: `Swap for ${pool.left_alt === 'XRD' ? pool.right_alt : pool.left_alt}`,
                    },
                    pool.sub_type === 'single' &&
                        pool.left_alt &&
                        !pool.right_alt &&
                        (pool.left_alt !== 'XRD' ||
                            pool.right_alt !== 'XRD') && {
                            icon: pool.right_icon || pool.left_icon,
                            label: `Swap for ${pool.right_alt || pool.left_alt}`,
                        },
                    {
                        icon:
                            pool.left_alt === 'XRD'
                                ? pool.right_icon
                                : pool.left_icon || pool.right_icon,
                        label: `Add LP to ${pool.name}`,
                    },
                ].filter(Boolean),
                requiredAssets: [
                    {
                        resource_address: XUSDC_RESOURCE_ADDRESS,
                        symbol: 'xUSDC',
                    },
                ],
                rewardTokens: pool.boosted ? [pool.left_alt] : [],
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
                poolInfo: pool,
                lendingPriceUsd: prices.prices.find(
                    (p) => p.assetName === XRD_RESOURCE_ADDRESS
                )?.assetPrice,
            } as Strategy
        })
    } catch (error) {
        console.error(
            'Error in getRootFinanceLendXrdBorrowUsdProvideSurgeLP:',
            error
        )
        return []
    }
}

export async function getStrategies() {
    const [stats, prices] = await Promise.all([
        getRootMarketStats(),
        getRootMarketPrices(),
    ])

    if (!stats || !prices) {
        return []
    }

    return [
        await getRootFinanceLendXrdBorrowUsdProvideSurgeLP(stats),
        ...(await getLPIncentiveAndHighBonusStrategies(stats, prices)),
    ]
        .filter((p) => !!p && p.totalRewards.value > 0)
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
    rightPercentage: number | null,
    xTokenAmount: string | null,
    yTokenAmount: string | null
) {
    const strategy =
        STRATEGY_MANIFEST[strategyId as keyof typeof STRATEGY_MANIFEST]

    const manifestResponse = await strategy.generateManifest(
        strategyId,
        strategy.manifest,
        accountAddress,
        xrd.toString(),
        ltv,
        buyToken,
        component,
        leftPercentage,
        rightPercentage,
        xTokenAmount,
        yTokenAmount
    )

    console.log('manifest ', manifestResponse)

    const previewTxResponse = await previewTx(manifestResponse).catch((e) => {
        console.log('Error preview ', e)
        return null
    })

    if (
        !previewTxResponse ||
        (previewTxResponse.receipt as { error_message?: string }).error_message
    ) {
        console.log(previewTxResponse)
        return {
            manifest: '',
        }
    }

    return {
        manifest: manifestResponse,
    }
}
