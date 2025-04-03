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
}

export interface VolumeAndTokenMetadata {
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
