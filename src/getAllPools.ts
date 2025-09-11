import Decimal from 'decimal.js'
import { PAIR_NAME_CACHE, BOOSTED_POOLS_CACHE, TOKEN_INFO_CACHE } from '../'
import { getTokenMetadata } from './getTokenMetadata'
import {
    getDefiplazaPools,
    getVolumeAndTokenMetadata,
    type VolumeAndTokenMetadata,
} from './defiplaza'
import { ociswapPools as getOciswapPools } from './ociswap'
import { tokensRequest, type TokenInfo } from './astrolescent'
import {
    DFP2_RESOURCE_ADDRESS,
    XRD_RESOURCE_ADDRESS,
    XUSDC_RESOURCE_ADDRESS,
} from './resourceAddresses'
import { getRadixIncentives } from './radixIncentives'

export interface Pool {
    type: string
    sub_type: 'double' | 'single' | 'precision' | 'flex' | 'basic'
    component: string
    current_price?: string
    lp_token?: string
    tvl: number
    bonus_24h: number
    bonus_7d: number
    side?: string
    base: string
    quote: string
    volume_7d: number
    volume_24h: number
    bonus_name: string
    left_alt: string
    right_alt: string
    left_icon: string
    right_icon: string
    name: string
    left_name: string
    right_name: string
    left_token: string
    right_token: string
    deposit_link: string
    ask_price?: string
    boosted: boolean
    incentivised_lp_docs: string
    volume_per_day?: number[]
    precision_price?: number
}

const STABLECOIN_ADDRESSES = new Set([
    // STAB
    'resource_rdx1t40lchq8k38eu4ztgve5svdpt0uxqmkvpy4a2ghnjcxjtdxttj9uam',
    // XUSDC
    XUSDC_RESOURCE_ADDRESS,
    // XUSDT
    'resource_rdx1thrvr3xfs2tarm2dl9emvs26vjqxu6mqvfgvqjne940jv0lnrrg7rw',
    'resource_rdx1thxj9m87sn5cc9ehgp9qxp6vzeqxtce90xm5cp33373tclyp4et4gv',
    'resource_rdx1th4v03gezwgzkuma6p38lnum8ww8t4ds9nvcrkr2p9ft6kxx3kxvhe',
])

export let TOKEN_PRICE_CACHE: Record<string, TokenInfo>

export async function getAllPools(bridgedTokens: Set<string>): Promise<Pool[]> {
    const [ociPools, dfpPools, tokens, incentives] = await Promise.all([
        getOciswapPools(),
        getDefiplazaPools(),
        tokensRequest(),
        getRadixIncentives('liquidity'),
    ])

    console.log(
        'got info',
        ociPools.length,
        dfpPools.data.length,
        Object.entries(tokens).length,
        incentives.size
    )

    TOKEN_PRICE_CACHE = tokens

    if (!ociPools || !dfpPools) return []

    const remappedOciswapPools = ociPools.map((o) => {
        PAIR_NAME_CACHE[o.lp_token_address] = {
            provider: 'Ociswap',
            name: `${o.x.token.symbol}/${o.y.token.symbol}`,
            left_alt: o.x.token.symbol,
            left_icon: o.x.token.icon_url,
            right_alt: o.y.token.symbol,
            right_icon: o.y.token.icon_url,
            component: o.address,
            left_token: o.x.token.address,
            right_token: o.y.token.address,
        }
        return {
            type: 'ociswap',
            pool_type: 'double',
            current_price:
                o.x.token.address === XRD_RESOURCE_ADDRESS
                    ? o.y.price.xrd.now
                    : o.x.price.xrd.now,
            precision_price:
                o.x.token.address === XRD_RESOURCE_ADDRESS
                    ? +o.x.price.xrd.now / +o.y.price.xrd.now
                    : +o.y.price.xrd.now / +o.x.price.xrd.now,
            lp_token: o.lp_token_address,
            sub_type: o.pool_type,
            xRatio: new Decimal(o.x.liquidity.token.now).div(
                o.y.liquidity.token.now
            ),
            yRatio: new Decimal(o.y.liquidity.token.now).div(
                new Decimal(o.y.liquidity.token.now).plus(
                    o.x.liquidity.token.now
                )
            ),
            component: o.address,
            tvl: +o.total_value_locked.usd.now,
            bonus_24h: +o.apr['24h'] * 100,
            bonus_7d: +o.apr['7d'] * 100,
            base: o.x.token.address,
            quote: o.y.token.address,
            volume_7d: +o.volume.usd['7d'],
            volume_24h: +o.volume.usd['24h'],
            bonus_name: 'APR',
            left_alt: o.x.token.symbol,
            right_alt: o.y.token.symbol,
            left_icon: o.x.token.icon_url,
            right_icon: o.y.token.icon_url,
            left_token: o.x.token.address,
            right_token: o.y.token.address,
            name: `${o.x.token.symbol}/${o.y.token.symbol}`,
            left_name: o.x.token.name,
            right_name: o.y.token.name,
            deposit_link: `https://ociswap.com/pools/${o.address}`,
            fee: o.fee_rate,
            xDivisibility: tokens[o.x.token.address]?.divisibility,
            yDivisibility: tokens[o.y.token.address]?.divisibility,
            boosted:
                !!BOOSTED_POOLS_CACHE[o.address] || incentives.has(o.address),
            ...(BOOSTED_POOLS_CACHE[o.address] && {
                incentivised_lp_docs: BOOSTED_POOLS_CACHE[o.address].docs,
            }),
            tags: [
                ...(STABLECOIN_ADDRESSES.has(o.x.token.address)
                    ? ['stablecoin']
                    : []),
                ...(STABLECOIN_ADDRESSES.has(o.y.token.address)
                    ? ['stablecoin']
                    : []),
                ...(bridgedTokens.has(o.x.token.address) ? ['wrapped'] : []),
                ...(bridgedTokens.has(o.y.token.address) ? ['wrapped'] : []),
                ...((o.x.token.address !== XRD_RESOURCE_ADDRESS &&
                    tokens[o.x.token.address]?.tags) ||
                    []),
                ...((o.y.token.address !== XRD_RESOURCE_ADDRESS &&
                    tokens[o.y.token.address]?.tags) ||
                    []),
                ...(incentives.has(o.address) ? ['incentives'] : []),
            ],
        } as Pool
    })

    console.log('done processing OCI pools')

    const remappedDefiplazaPools = (
        await Promise.all(
            dfpPools.data
                .map(async (d) => {
                    return Promise.all([
                        getVolumeAndTokenMetadata(d.baseToken),
                        getVolumeAndTokenMetadata(d.quoteToken),
                    ]).then(async ([base, quote]) => {
                        if (!quote && TOKEN_INFO_CACHE[d.quoteToken]) {
                            quote = {} as VolumeAndTokenMetadata

                            if (quote) {
                                quote.right_alt =
                                    TOKEN_INFO_CACHE[d.quoteToken].symbol
                                quote.right_icon =
                                    TOKEN_INFO_CACHE[d.quoteToken].icon_url
                            }
                        } else {
                            TOKEN_INFO_CACHE[d.quoteToken] =
                                await getTokenMetadata(d.quoteToken)
                            quote = {} as VolumeAndTokenMetadata

                            if (quote) {
                                quote.right_alt =
                                    TOKEN_INFO_CACHE[d.quoteToken].symbol
                                quote.right_icon =
                                    TOKEN_INFO_CACHE[d.quoteToken].icon_url
                            }
                        }

                        if (base && !PAIR_NAME_CACHE[base.baseLPToken]) {
                            PAIR_NAME_CACHE[base.baseLPToken] = {
                                provider: 'Defiplaza',
                                name: `${base?.left_alt}/${quote?.right_alt}`,
                                left_alt: base?.left_alt || '',
                                left_icon: base?.left_icon || '',
                                right_alt: quote?.right_alt || '',
                                right_icon: quote?.right_icon || '',
                                left_token: d.baseToken,
                                right_token: d.quoteToken,
                                component: base.component,
                                type: 'base',
                            }
                        }

                        if (base && !PAIR_NAME_CACHE[base.quoteLPToken]) {
                            PAIR_NAME_CACHE[base.quoteLPToken] = {
                                provider: 'Defiplaza',
                                name: `${base?.left_alt}/${quote?.right_alt}`,
                                left_alt: base?.left_alt || '',
                                left_icon: base?.left_icon || '',
                                right_alt: quote?.right_alt || '',
                                right_icon: quote?.right_icon || '',
                                component: base.component,
                                left_token: d.baseToken,
                                right_token: d.quoteToken,
                                type: 'quote',
                            }
                        }

                        if (quote && !PAIR_NAME_CACHE[quote.baseLPToken]) {
                            PAIR_NAME_CACHE[quote.quoteLPToken] = {
                                provider: 'Defiplaza',
                                name: `${base?.left_alt}/${quote?.right_alt}`,
                                left_alt: base?.left_alt || '',
                                left_icon: base?.left_icon || '',
                                right_alt: quote?.right_alt || '',
                                right_icon: quote?.right_icon || '',
                                component: quote.component,
                                left_token: d.baseToken,
                                right_token: d.quoteToken,
                                type: 'quote',
                            }
                        }

                        if (quote && !PAIR_NAME_CACHE[quote.quoteLPToken]) {
                            PAIR_NAME_CACHE[quote.quoteLPToken] = {
                                provider: 'Defiplaza',
                                name: `${base?.left_alt}/${quote?.right_alt}`,
                                left_alt: base?.left_alt || '',
                                left_icon: base?.left_icon || '',
                                right_alt: quote?.right_alt || '',
                                right_icon: quote?.right_icon || '',
                                component: quote.component,
                                left_token: d.baseToken,
                                right_token: d.quoteToken,
                                type: 'quote',
                            }
                        }

                        let xRatio: string = '0'
                        let yRatio: string = '0'

                        if (base) {
                            if (base.pairState.shortage == 'BaseShortage') {
                                xRatio = new Decimal(
                                    base.basePoolState.vaults[1].amount
                                )
                                    .div(base.basePoolState.vaults[0].amount)
                                    .toFixed()
                                yRatio = new Decimal(
                                    base.basePoolState.vaults[0].amount
                                )
                                    .div(base.basePoolState.vaults[1].amount)
                                    .toFixed()
                            } else if (
                                base.pairState.shortage == 'QuoteShortage'
                            ) {
                                xRatio = new Decimal(
                                    base.quotePoolState.vaults[1].amount
                                )
                                    .div(base.quotePoolState.vaults[0].amount)
                                    .toFixed()
                                yRatio = new Decimal(
                                    base.quotePoolState.vaults[0].amount
                                )
                                    .div(base.quotePoolState.vaults[1].amount)
                                    .toFixed()
                            }
                        }

                        return [
                            {
                                type: 'defiplaza',
                                pool_type: 'double',
                                sub_type: 'double',
                                component: d.address,
                                current_price: base?.ask_price,
                                xRatio: xRatio,
                                yRatio: yRatio,
                                tvl: d.tvlUSD,
                                bonus_24h: base?.alr_24h || 0,
                                bonus_7d: base?.alr_7d || 0,
                                base: d.baseToken,
                                quote: d.quoteToken,
                                volume_7d: base?.volume_7d || 0,
                                volume_24h: base?.volume_24h || 0,
                                bonus_name: 'ALR',
                                left_alt: base?.left_alt || '',
                                left_icon: base?.left_icon || '',
                                right_alt: quote?.right_alt || '',
                                right_icon: quote?.right_icon || '',
                                left_token: d.baseToken,
                                right_token: d.quoteToken,
                                xDivisibility: base?.divisibility,
                                yDivisibility: quote?.divisibility,
                                shortage: base?.pairState.shortage,
                                name: `${base?.left_alt}/${quote?.right_alt}`,
                                left_name: base?.left_name || '',
                                right_name: quote?.right_name || '',
                                deposit_link: `https://radix.defiplaza.net/liquidity/add/${d.baseToken}?direction=${base?.single.side === 'base' ? 'quote' : 'base'}`,
                                ask_price: base?.ask_price,
                                side: base?.single.side,
                                fee: base?.fee,
                                boosted:
                                    !!BOOSTED_POOLS_CACHE[d.address] ||
                                    incentives.has(d.address),
                                ...(BOOSTED_POOLS_CACHE[d.address] && {
                                    incentivised_lp_docs:
                                        BOOSTED_POOLS_CACHE[d.address].docs,
                                }),
                                volume_per_day: base?.volume_per_day,
                                tags: [
                                    ...(STABLECOIN_ADDRESSES.has(d.baseToken)
                                        ? ['stablecoin']
                                        : []),
                                    ...(STABLECOIN_ADDRESSES.has(d.quoteToken)
                                        ? ['stablecoin']
                                        : []),
                                    ...(bridgedTokens.has(d.baseToken)
                                        ? ['wrapped']
                                        : []),
                                    ...(bridgedTokens.has(d.quoteToken)
                                        ? ['wrapped']
                                        : []),
                                    ...((d.baseToken !==
                                        DFP2_RESOURCE_ADDRESS &&
                                        tokens[d.baseToken]?.tags) ||
                                        []),
                                    ...((d.quoteToken !==
                                        DFP2_RESOURCE_ADDRESS &&
                                        tokens[d.quoteToken]?.tags) ||
                                        []),
                                    ...(incentives.has(d.address)
                                        ? ['incentives']
                                        : []),
                                ],
                            },
                            {
                                type: 'defiplaza',
                                pool_type: 'single',
                                sub_type: 'single',
                                component: d.address,
                                current_price: base?.ask_price,
                                tvl: d.tvlUSD,
                                xRatio: 0,
                                yRatio: 0,
                                bonus_24h: (base?.single.alr_24h || 0) * 10,
                                bonus_7d: (base?.single.alr_7d || 0) * 10,
                                base: d.baseToken,
                                quote: d.quoteToken,
                                volume_7d: base?.volume_7d || 0,
                                volume_24h: base?.volume_24h || 0,
                                left_token: d.baseToken,
                                right_token: d.quoteToken,
                                bonus_name: 'ALR',
                                side: base?.single.side,
                                ...(base?.single.side === 'base' && {
                                    left_alt: base?.left_alt || '',
                                    left_icon: base?.left_icon || '',
                                }),
                                ...(base?.single.side === 'quote' && {
                                    right_alt: quote?.right_alt || '',
                                    right_icon: quote?.right_icon || '',
                                }),
                                name: `${base?.left_alt}/${quote?.right_alt} (${base?.single.side === 'base' ? base?.left_alt || '' : quote?.right_alt || ''})`,
                                left_name: base?.left_name || '',
                                right_name: quote?.right_name || '',
                                deposit_link: `https://radix.defiplaza.net/liquidity/add/${d.baseToken}?direction=${base?.single.side}`,
                                boosted: !!BOOSTED_POOLS_CACHE[d.address],
                                ...(BOOSTED_POOLS_CACHE[d.address] && {
                                    incentivised_lp_docs:
                                        BOOSTED_POOLS_CACHE[d.address].docs,
                                }),
                                fee:
                                    base?.single.side === 'base'
                                        ? base?.fee || '0'
                                        : quote?.fee || '0',
                                volume_per_day: base?.volume_per_day,
                                tags: [
                                    ...(STABLECOIN_ADDRESSES.has(d.baseToken)
                                        ? ['stablecoin']
                                        : []),
                                    ...(STABLECOIN_ADDRESSES.has(d.quoteToken)
                                        ? ['stablecoin']
                                        : []),
                                    ...(bridgedTokens.has(d.baseToken)
                                        ? ['wrapped']
                                        : []),
                                    ...(bridgedTokens.has(d.quoteToken)
                                        ? ['wrapped']
                                        : []),
                                    ...((d.baseToken !==
                                        DFP2_RESOURCE_ADDRESS &&
                                        tokens[d.baseToken]?.tags) ||
                                        []),
                                    ...((d.quoteToken !==
                                        DFP2_RESOURCE_ADDRESS &&
                                        tokens[d.quoteToken]?.tags) ||
                                        []),
                                ],
                            } as Pool,
                        ]
                    })
                })
                .flatMap((arr) => arr)
        )
    ).flatMap((arr) => arr) as Pool[]

    console.log('Pair names cache length:', Object.keys(PAIR_NAME_CACHE).length)

    return [...remappedOciswapPools, ...remappedDefiplazaPools]
        .filter((pool) => pool.tvl > 1)
        .sort((a, b) => {
            return (
                b.volume_7d - a.volume_7d ||
                b.bonus_7d - a.bonus_7d ||
                b.tvl - a.tvl
            )
        })
}
