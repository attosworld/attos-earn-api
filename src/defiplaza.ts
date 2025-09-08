import {
    DFP2_RESOURCE_ADDRESS,
    XRD_RESOURCE_ADDRESS,
    XUSDC_RESOURCE_ADDRESS,
} from './resourceAddresses'

export interface DefiplazaPool {
    address: string
    dexAddress: string
    baseToken: string
    quoteToken: string
    basePool: string
    quotePool: string
    baseAPY: number
    quoteAPY: number
    baseTVL: number
    quoteTVL: number
    tvlUSD: number
    volume: number
}

export async function getDefiplazaPools() {
    const options = { method: 'GET', headers: { accept: 'application/json' } }

    return fetch('https://radix.defiplaza.net/api/pairs', options)
        .then((res) => res.json() as Promise<{ data: DefiplazaPool[] }>)
        .catch(() => ({ data: [] as DefiplazaPool[] }))
}

export interface DefiPlazaLPInfo {
    isBase: boolean
    baseAmount: number
    quoteAmount: number
    baseToken: string
    quoteToken: string
}

export async function defiplazaLpInfo(lpResource: string, amount: string) {
    const lpInfo = await fetch(
        `https://radix.defiplaza.net/api/lp/${lpResource}?amount=${amount}`
    )
        .then((response) => response.json() as Promise<DefiPlazaLPInfo>)
        .catch(() => null)

    return lpInfo
}

export interface PairState {
    p0: string
    shortage: 'QuoteShortage' | 'BaseShortage' // Assuming these are the only possible values
    target_ratio: string
    last_outgoing: string
    last_out_spot: string
}

export interface PoolState {
    address: string
    vaults: [
        {
            address: string
            amount: number
        },
        {
            address: string
            amount: number
        },
    ]
}

export interface DefiplazaPairAnalytics {
    pair: {
        address: string
        dexAddress: string
        baseToken: string
        quoteToken: string
        basePool: string
        quotePool: string
        baseLPToken: string
        quoteLPToken: string
        baseAPY: number
        quoteAPY: number
        baseAPY7D: number
        quoteAPY7D: number
        config: {
            k_in: string
            k_out: string
            fee: string
            decay_factor: string
        }
        baseVolume24H: number
        quoteVolume24H: number
        bidPrice: number
        askPrice: number
        lastPrice: number
        baseTVL: number
        quoteTVL: number
        tvlUSD: number
        createdAt: string
        updatedAt: string
        updatedAPYAt: string
        stateVersion: number
    }
    baseToken: {
        address: string
        symbol: string
        name: string
        description: string
        iconUrl: string
        infoUrl: string
        divisibility: number
        bidPrice: number
        askPrice: number
        lastPrice: number
        tvlUSD: number
    }
    stats: Array<{
        date: number
        stateVersion: number
        totalValueLockedUSD: number
        volumeUSD: number
        feesUSD: number
        lpBaseUSD: number
        lpQuoteUSD: number
    }>
    pairState: PairState
    basePoolState: PoolState
    quotePoolState: PoolState
}

export interface VolumeAndTokenMetadata {
    component: string
    dexComponent: string
    basePool: string
    quotePool: string
    fee: string
    baseTvl: number
    quoteTvl: number
    ask_price: number
    bid_price: number
    last_price: number
    alr_24h: number
    alr_7d: number
    tvl_usd: number
    volume_24h: number
    volume_7d: number
    left_alt: string
    right_alt: string
    right_token: string
    left_icon: string
    right_icon: string
    left_name: string
    right_name: string
    baseLPToken: string
    quoteLPToken: string
    pairState: PairState
    basePoolState: PoolState
    quotePoolState: PoolState
    divisibility: number
    single: {
        side: 'base' | 'quote'
        alr_24h: number
        alr_7d: number
        tvl_usd: number
        volume_24h: number
        volume_7d: number
    }
    volume_per_day: Record<string, number>
}

function getLastSevenDaysVolume(
    stats: Array<{ date: number; volumeUSD: number }>
): Record<string, number> {
    const now = new Date()
    now.setHours(0, 0, 0, 0) // Set to start of today
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(now.getDate() - 6) // 7 days including today

    const volumeMap: Record<string, number> = {}

    // Initialize all 7 days with 0 volume
    for (let i = 0; i < 7; i++) {
        const date = new Date(sevenDaysAgo)
        date.setDate(sevenDaysAgo.getDate() + i)
        const dateString = date.toISOString().split('T')[0] // Format as YYYY-MM-DD
        volumeMap[dateString] = 0
    }

    // Fill in actual volumes where we have data
    stats.forEach((stat) => {
        const statDate = new Date(stat.date * 1000) // Convert seconds to milliseconds
        statDate.setHours(0, 0, 0, 0)
        const dateString = statDate.toISOString().split('T')[0]
        if (dateString in volumeMap) {
            volumeMap[dateString] = stat.volumeUSD
        }
    })

    return volumeMap
}

export async function getVolumeAndTokenMetadata(
    basePair: string
): Promise<VolumeAndTokenMetadata | null> {
    return fetch(`https://radix.defiplaza.net/api/analytics/pair/${basePair}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
    })
        .then((res) => res.json() as Promise<DefiplazaPairAnalytics>)
        .then((data) => {
            const singleSide =
                data.pairState.shortage === 'QuoteShortage' ? 'base' : 'quote'

            return {
                component: data.pair.address,
                dexComponent: data.pair.dexAddress,
                basePool: data.pair.basePool,
                quotePool: data.pair.quotePool,
                baseTvl: data.pair.baseTVL,
                quoteTvl: data.pair.quoteTVL,
                ask_price: data.pair.askPrice,
                bid_price: data.pair.bidPrice,
                last_price: data.pair.lastPrice,
                alr_24h: (data.pair.baseAPY + data.pair.quoteAPY) * 100,
                alr_7d: (data.pair.baseAPY7D + data.pair.quoteAPY7D) * 100,
                tvl_usd: data.pair.tvlUSD,
                volume_24h: data.stats[0].volumeUSD,
                volume_7d: data.stats
                    .slice(0, 6)
                    .reduce((acc, curr) => acc + curr.volumeUSD, 0),
                fee: data.pair.config.fee,
                left_alt: data.baseToken.symbol,
                right_alt: data.baseToken.symbol,
                left_icon: data.baseToken.iconUrl,
                right_icon: data.baseToken.iconUrl,
                left_name: data.baseToken.name,
                right_name: data.baseToken.name,
                right_token: data.pair.quoteToken,
                baseLPToken: data.pair.baseLPToken,
                quoteLPToken: data.pair.quoteLPToken,
                pairState: data.pairState,
                basePoolState: data.basePoolState,
                quotePoolState: data.quotePoolState,
                volume_per_day: getLastSevenDaysVolume(data.stats),
                divisibility: data.baseToken.divisibility,
                single: {
                    side: singleSide,
                    alr_24h:
                        singleSide === 'base'
                            ? data.pair.baseAPY
                            : data.pair.quoteAPY,
                    alr_7d:
                        singleSide === 'base'
                            ? data.pair.baseAPY7D
                            : data.pair.quoteAPY7D,
                    tvl_usd:
                        singleSide === 'base'
                            ? data.pair.baseTVL
                            : data.pair.quoteTVL,
                    volume_24h:
                        singleSide === 'base'
                            ? data.stats[0].lpBaseUSD
                            : data.stats[0].lpQuoteUSD,
                    volume_7d:
                        singleSide === 'base'
                            ? data.stats
                                  .slice(0, 6)
                                  .reduce(
                                      (acc, curr) => acc + curr.lpBaseUSD,
                                      0
                                  )
                            : data.stats
                                  .slice(0, 6)
                                  .reduce(
                                      (acc, curr) => acc + curr.lpQuoteUSD,
                                      0
                                  ),
                },
            } as VolumeAndTokenMetadata
        })
        .catch(() => null)
}

export interface DefiplazaStakingPool {
    address: string
    token: string
    sToken: string
    pool: string
    description: string
    infoUrl: string
    intervalAmount: string
    interval: string
    totalStake: number
    totalStakeUSD: number
}

export async function getDefiplazaStakingTokens() {
    return fetch('https://radix.defiplaza.net/api/staking', {
        mode: 'cors',
    })
        .then((res) => res.json() as Promise<DefiplazaStakingPool[]>)
        .catch(() => [] as DefiplazaStakingPool[])
}

export function createAddDefiplazaCalmLiquidityManifest(
    poolComponentAddress: string,
    shortageSide: 'QuoteShortage' | 'BaseShortage'
): string {
    return shortageSide === 'BaseShortage'
        ? `
CALL_METHOD
Address("${poolComponentAddress}")
"add_liquidity"
Bucket("buyToken")
Enum<1u8>(
Bucket("xrdSide")
)
;
`
        : `
CALL_METHOD
Address("${poolComponentAddress}")
"add_liquidity"
Bucket("xrdSide")
Enum<1u8>(
Bucket("buyToken")
)
;
`
}

export function buyFromDfpToken(dexAdddress: string): string {
    return `
TAKE_ALL_FROM_WORKTOP
    Address("${XRD_RESOURCE_ADDRESS}")
    Bucket("xrd")
;
CALL_METHOD
  Address("${dexAdddress}")
  "swap"
  Bucket("xrd")
  Address("resource_rdx1t5ywq4c6nd2lxkemkv4uzt8v7x7smjcguzq5sgafwtasa6luq7fclq")
;
TAKE_FROM_WORKTOP
  Address("resource_rdx1t5ywq4c6nd2lxkemkv4uzt8v7x7smjcguzq5sgafwtasa6luq7fclq")
  Decimal("{buyTokenAmount}")
  Bucket("dfp2")
;
CALL_METHOD
  Address("${dexAdddress}")
  "swap"
  Bucket("dfp2")
  Address("{buyToken}")
;
`
}

export function buyFromDfp(dexAdddress: string, tokenBuy: string): string {
    return `
TAKE_ALL_FROM_WORKTOP
    Address("${XRD_RESOURCE_ADDRESS}")
    Bucket("xrd")
;
CALL_METHOD
  Address("${dexAdddress}")
  "swap"
  Bucket("xrd")
  Address("${tokenBuy}")
;
TAKE_FROM_WORKTOP
  Address("${tokenBuy}")
  Decimal("{buyTokenAmount}")
  Bucket("dfp2")
;
CALL_METHOD
  Address("${dexAdddress}")
  "swap"
  Bucket("dfp2")
  Address("${tokenBuy}")
;
`
}

export function xrdToDfp2AmountManifest(dexAddress: string) {
    return `
CALL_METHOD
Address("component_rdx1cqjzzku4rrkz3zhm8hldn55evpgmxx9rpq9t98qtnj0asdg88f9yj6")
"charge_strategy_royalty"
;
CALL_METHOD
  Address("{account}")
  "withdraw"
  Address("${XUSDC_RESOURCE_ADDRESS}")
  Decimal("{xusdcAmount}")
;
TAKE_ALL_FROM_WORKTOP
  Address("${XUSDC_RESOURCE_ADDRESS}")
  Bucket("bucket_0")
;
CALL_METHOD
  Address("component_rdx1crwusgp2uy9qkzje9cqj6pdpx84y94ss8pe7vehge3dg54evu29wtq")
  "contribute"
  Bucket("bucket_0")
;
TAKE_ALL_FROM_WORKTOP
  Address("resource_rdx1tk024ja6xnstalrqk7lrzhq3pgztxn9gqavsuxuua0up7lqntxdq2a")
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
      Address("${XRD_RESOURCE_ADDRESS}"),
      Decimal("{borrowXrdAmount}")
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
  Address("${XRD_RESOURCE_ADDRESS}")
  Bucket("xrd")
;
CALL_METHOD
  Address("${dexAddress}")
  "swap"
  Bucket("xrd")
  Address("resource_rdx1t5ywq4c6nd2lxkemkv4uzt8v7x7smjcguzq5sgafwtasa6luq7fclq")
;
CALL_METHOD
  Address("{account}")
  "deposit_batch"
  Expression("ENTIRE_WORKTOP")
;`
}

export function singleSidedXrdToDfp2AmountManifest({
    dexAddress,
    poolComponentAddress,
    tokenSwap,
    account,
    usdAmount,
    borrowAmount,
}: {
    dexAddress: string
    poolComponentAddress: string
    tokenSwap?: string
    account: string
    usdAmount: string
    borrowAmount: string
}) {
    return `
CALL_METHOD
Address("component_rdx1cqjzzku4rrkz3zhm8hldn55evpgmxx9rpq9t98qtnj0asdg88f9yj6")
"charge_strategy_royalty"
;
CALL_METHOD
  Address("${account}")
  "withdraw"
  Address("${XUSDC_RESOURCE_ADDRESS}")
  Decimal("${usdAmount}")
;
TAKE_ALL_FROM_WORKTOP
  Address("${XUSDC_RESOURCE_ADDRESS}")
  Bucket("bucket_0")
;
CALL_METHOD
  Address("component_rdx1crwusgp2uy9qkzje9cqj6pdpx84y94ss8pe7vehge3dg54evu29wtq")
  "contribute"
  Bucket("bucket_0")
;
TAKE_ALL_FROM_WORKTOP
  Address("resource_rdx1tk024ja6xnstalrqk7lrzhq3pgztxn9gqavsuxuua0up7lqntxdq2a")
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
      Address("${XRD_RESOURCE_ADDRESS}"),
      Decimal("${borrowAmount}")
    )
  )
;
CALL_METHOD
  Address("${account}")
  "deposit_batch"
  Array<Bucket>(
    Bucket("nft")
  )
;
TAKE_ALL_FROM_WORKTOP
  Address("${XRD_RESOURCE_ADDRESS}")
  Bucket("xrd")
;
CALL_METHOD
  Address("${dexAddress}")
  "swap"
  Bucket("xrd")
  Address("resource_rdx1t5ywq4c6nd2lxkemkv4uzt8v7x7smjcguzq5sgafwtasa6luq7fclq")
;
TAKE_ALL_FROM_WORKTOP
  Address("resource_rdx1t5ywq4c6nd2lxkemkv4uzt8v7x7smjcguzq5sgafwtasa6luq7fclq")
  Bucket("dfp2")
;
${
    !tokenSwap
        ? ''
        : `CALL_METHOD
Address("${dexAddress}")
"swap"
Bucket("dfp2")
Address("${tokenSwap}")
;
TAKE_ALL_FROM_WORKTOP
  Address("${tokenSwap}")
  Bucket("boughtToken")
;
    `
}
CALL_METHOD
Address("${poolComponentAddress}")
"add_liquidity"
${tokenSwap ? 'Bucket("boughtToken")' : 'Bucket("dfp2")'}
Enum<0u8>()
;
CALL_METHOD
  Address("${account}")
  "deposit_batch"
  Expression("ENTIRE_WORKTOP")
;`
}

export function closeDefiplazaLpPosition({
    baseToken,
    isQuote,
    lpAddress,
    lpAmount,
    lpComponent,
    account,
    rootNftId,
    swapComponent,
    lendAmount,
    withdrawLossAmount,
}: {
    isQuote: boolean
    baseToken: string
    lpAddress: string
    lpAmount: string
    lpComponent: string
    account: string
    rootNftId: string
    swapComponent: string
    lendAmount: string
    withdrawLossAmount?: string
}) {
    return `CALL_METHOD
  Address("${account}")
  "withdraw"
  Address("${lpAddress}")
  Decimal("${lpAmount}")
;
TAKE_ALL_FROM_WORKTOP
  Address("${lpAddress}")
  Bucket("surge_lp")
;
CALL_METHOD
  Address("${lpComponent}")
  "remove_liquidity"
  Bucket("surge_lp")
  ${isQuote}
;
TAKE_ALL_FROM_WORKTOP
  Address("${baseToken}")
  Bucket("left_token")
;
CALL_METHOD
    Address("${swapComponent}")
    "swap"
    Bucket("left_token")
    Address("${DFP2_RESOURCE_ADDRESS}")
;
TAKE_ALL_FROM_WORKTOP
  Address("${DFP2_RESOURCE_ADDRESS}")
  Bucket("right_token")
;
CALL_METHOD
    Address("${swapComponent}")
    "swap"
    Bucket("right_token")
    Address("${XRD_RESOURCE_ADDRESS}")
;
${
    withdrawLossAmount
        ? `CALL_METHOD
Address("${account}")
"withdraw"
Address("${XRD_RESOURCE_ADDRESS}")
Decimal("${withdrawLossAmount}")
;
    `
        : ''
}
TAKE_ALL_FROM_WORKTOP
    Address("${XRD_RESOURCE_ADDRESS}")
    Bucket("xrd")
;
CALL_METHOD
  Address("${account}")
  "create_proof_of_non_fungibles"
  Address("resource_rdx1ngekvyag42r0xkhy2ds08fcl7f2ncgc0g74yg6wpeeyc4vtj03sa9f")
  Array<NonFungibleLocalId>(
    NonFungibleLocalId("${rootNftId}")
  )
;
POP_FROM_AUTH_ZONE
  Proof("root_nft")
;
CLONE_PROOF
  Proof("root_nft")
  Proof("root_nft_2")
;
CALL_METHOD
  Address("component_rdx1crwusgp2uy9qkzje9cqj6pdpx84y94ss8pe7vehge3dg54evu29wtq")
  "repay"
  Proof("root_nft")
  Enum<0u8>()
  Array<Bucket>(
    Bucket("xrd")
  )
;
CALL_METHOD
  Address("component_rdx1crwusgp2uy9qkzje9cqj6pdpx84y94ss8pe7vehge3dg54evu29wtq")
  "remove_collateral"
  Proof("root_nft_2")
  Array<Tuple>(
    Tuple(
      Address("${XUSDC_RESOURCE_ADDRESS}"),
      Decimal("${lendAmount}"),
      false
    )
  )
;
CALL_METHOD
  Address("${account}")
  "deposit_batch"
  Expression("ENTIRE_WORKTOP")
;`
}

export function closeDefiplazaLpValue({
    baseToken,
    isQuote,
    lpAddress,
    lpAmount,
    lpComponent,
    account,
    swapComponent,
}: {
    isQuote: boolean
    baseToken: string
    lpAddress: string
    lpAmount: string
    lpComponent: string
    account: string
    swapComponent: string
}) {
    return `CALL_METHOD
  Address("${account}")
  "withdraw"
  Address("${lpAddress}")
  Decimal("${lpAmount}")
;
TAKE_ALL_FROM_WORKTOP
  Address("${lpAddress}")
  Bucket("surge_lp")
;
CALL_METHOD
  Address("${lpComponent}")
  "remove_liquidity"
  Bucket("surge_lp")
  ${isQuote}
;
TAKE_ALL_FROM_WORKTOP
  Address("${baseToken}")
  Bucket("left_token")
;
CALL_METHOD
    Address("${swapComponent}")
    "swap"
    Bucket("left_token")
    Address("${DFP2_RESOURCE_ADDRESS}")
;
TAKE_ALL_FROM_WORKTOP
  Address("${DFP2_RESOURCE_ADDRESS}")
  Bucket("right_token")
;
CALL_METHOD
    Address("${swapComponent}")
    "swap"
    Bucket("right_token")
    Address("${XRD_RESOURCE_ADDRESS}")
;
CALL_METHOD
  Address("${account}")
  "deposit_batch"
  Expression("ENTIRE_WORKTOP")
;`
}

export function removeDefiplazaLiquidity({
    isQuote,
    lpAddress,
    lpAmount,
    lpComponent,
    account,
}: {
    isQuote: boolean
    lpAddress: string
    lpAmount: string
    lpComponent: string
    account: string
}) {
    return `CALL_METHOD
  Address("${account}")
  "withdraw"
  Address("${lpAddress}")
  Decimal("${lpAmount}")
;
TAKE_ALL_FROM_WORKTOP
  Address("${lpAddress}")
  Bucket("surge_lp")
;
CALL_METHOD
  Address("${lpComponent}")
  "remove_liquidity"
  Bucket("surge_lp")
  ${isQuote}
;
CALL_METHOD
  Address("${account}")
  "deposit_batch"
  Expression("ENTIRE_WORKTOP")
;`
}
