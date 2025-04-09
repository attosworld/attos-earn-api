import {
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
        .catch((err) => console.error(err))
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
    baseTvl: number
    quoteTvl: number
    ask_price: number
    bid_price: number
    alr_24h: number
    alr_7d: number
    tvl_usd: number
    volume_24h: number
    volume_7d: number
    left_alt: string
    right_alt: string
    left_icon: string
    right_icon: string
    left_name: string
    right_name: string
    baseLPToken: string
    quoteLPToken: string
    pairState: PairState
    basePoolState: PoolState
    quotePoolState: PoolState
    single: {
        side: 'base' | 'quote'
        alr_24h: number
        alr_7d: number
        tvl_usd: number
        volume_24h: number
        volume_7d: number
    }
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
                alr_24h: (data.pair.baseAPY + data.pair.quoteAPY) * 100,
                alr_7d: (data.pair.baseAPY7D + data.pair.quoteAPY7D) * 100,
                tvl_usd: data.pair.tvlUSD,
                volume_24h: data.stats[0].volumeUSD,
                volume_7d: data.stats
                    .slice(0, 6)
                    .reduce((acc, curr) => acc + curr.volumeUSD, 0),
                left_alt: data.baseToken.symbol,
                right_alt: data.baseToken.symbol,
                left_icon: data.baseToken.iconUrl,
                right_icon: data.baseToken.iconUrl,
                left_name: data.baseToken.name,
                right_name: data.baseToken.name,
                baseLPToken: data.pair.baseLPToken,
                quoteLPToken: data.pair.quoteLPToken,
                pairState: data.pairState,
                basePoolState: data.basePoolState,
                quotePoolState: data.quotePoolState,
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

export function createAddDefiplazaCalmLiquidityManifest(
    poolComponentAddress: string,
    shortageSide: 'QuoteShortage' | 'BaseShortage'
): string {
    console.log(shortageSide)
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

export function xrdToDfp2AmountManifest(dexAddress: string) {
    return `
CALL_METHOD
Address("component_rdx1cpd6et0fy7jua470t0mn0vswgc8wzx52nwxzg6dd6rel0g0e08l0lu")
"charge_royalty"
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
