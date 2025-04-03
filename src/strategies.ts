export interface Strategy {
    id: number
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

export const STRATEGY_MANIFEST = {
    1: {
        manifest: `CALL_METHOD
Address("component_rdx1cpd6et0fy7jua470t0mn0vswgc8wzx52nwxzg6dd6rel0g0e08l0lu")
"charge_royalty"
;
CALL_METHOD
  Address("{account}")
  "withdraw"
  Address("resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd")
  Decimal("{xrdAmount}")
;
TAKE_ALL_FROM_WORKTOP
  Address("resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd")
  Bucket("bucket_0")
;
CALL_METHOD
  Address("component_rdx1crwusgp2uy9qkzje9cqj6pdpx84y94ss8pe7vehge3dg54evu29wtq")
  "contribute"
  Bucket("bucket_0")
;
TAKE_ALL_FROM_WORKTOP
  Address("resource_rdx1t5ey8s5nq99p5ae7jxp4ez5xljn7gtjgesr0dartq9aeys2tfwqg9w")
  Bucket("bucket_1")
;
CALL_METHOD
  Address("component_rdx1crwusgp2uy9qkzje9cqj6pdpx84y94ss8pe7vehge3dg54evu29wtq")
  "create_cdp"
  Enum<0u8>()
  Enum<0u8>()
  Enum<0u8>()
  Array<Bucket>(
    Bucket("bucket_1")
  )
;
TAKE_ALL_FROM_WORKTOP
  Address("resource_rdx1ngekvyag42r0xkhy2ds08fcl7f2ncgc0g74yg6wpeeyc4vtj03sa9f")
  Bucket("nft")
;
CREATE_PROOF_FROM_BUCKET_OF_ALL
  Bucket("nft")
  Proof("nft_proof")
;
CALL_METHOD
  Address("component_rdx1crwusgp2uy9qkzje9cqj6pdpx84y94ss8pe7vehge3dg54evu29wtq")
  "borrow"
  Proof("nft_proof")
  Array<Tuple>(
    Tuple(
      Address("resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf"),
      Decimal("{borrowUsdAmount}")
    )
  )
;
CALL_METHOD
  Address("{account}")
  "deposit_batch"
  Array<Bucket>(
    Bucket("nft")
  )
;
TAKE_ALL_FROM_WORKTOP
  Address("resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf")
  Bucket("usdc")
;
CALL_METHOD
  Address("component_rdx1czqcwcqyv69y9s6xfk443250ruragewa0vj06u5ke04elcu9kae92n")
  "wrap"
  Bucket("usdc")
;
TAKE_ALL_FROM_WORKTOP
  Address("resource_rdx1th3uhn6905l2vh49z2d83xgr45a08dkxn8ajxmt824ctpdu69msp89")
  Bucket("susdc")
;
CALL_METHOD
  Address("component_rdx1cp92uemllvxuewz93s5h8f36plsmrysssjjl02vve3zvsdlyxhmne7")
  "add_liquidity"
  Bucket("susdc")
;
CALL_METHOD
  Address("{account}")
  "deposit_batch"
  Expression("ENTIRE_WORKTOP")
;`,
        generateManifest: async (
            manifest: string,
            account: string,
            xrdAmount: string
        ) => {
            const [marketPrices, stats] = await Promise.all([
                getRootMarketPrices().then((data) =>
                    data.prices.find(
                        (price) =>
                            price.assetName ===
                            'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
                    )
                ),
                getRootMarketStats(),
            ])

            const borrowUsdcLimit = 1 - +stats.assets.radix.LTVLimit + 0.1

            const xrdToUsd = (marketPrices?.assetPrice || 0) * +xrdAmount

            const borrowUsdAmount = (
                xrdToUsd -
                borrowUsdcLimit * xrdToUsd
            ).toFixed(18)

            return manifest
                .replaceAll('{account}', account)
                .replaceAll('{xrdAmount}', xrdAmount)
                .replaceAll('{borrowUsdAmount}', borrowUsdAmount)
                .replaceAll('\n', ' ')
        },
    },
}

async function getRootFinanceLendXrdBorrowUsdProvideSurgeLP(): Promise<Strategy | null> {
    try {
        const [stats, surgeStats] = await Promise.all([
            getRootMarketStats(),
            getSurgeStats(),
        ])

        const surgeLpApy = surgeStats.apy.value * 100 // Convert to percentage
        const xrdLendingApy = stats.assets.radix.lendingAPY

        const estimatedTotalApy = xrdLendingApy + surgeLpApy

        return {
            id: 1,
            name: 'Root Points, Yield Surge LP',
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
                    resource_address:
                        'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
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
        }
    } catch (error) {
        console.error(
            'Error in getRootFinanceLendXrdBorrowUsdProvideSurgeLP:',
            error
        )
        return null
    }
}

export async function getStrategies() {
    return [await getRootFinanceLendXrdBorrowUsdProvideSurgeLP()].filter(
        Boolean
    )
}

export async function getExecuteStrategyManifest(
    strategyId: string,
    xrd: string,
    accountAddress: string
) {
    const strategy =
        STRATEGY_MANIFEST[+strategyId as keyof typeof STRATEGY_MANIFEST]

    return {
        manifest: await strategy.generateManifest(
            strategy.manifest,
            accountAddress,
            xrd.toString()
        ),
    }
}
