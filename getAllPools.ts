import { PAIR_NAME_CACHE, BOOSTED_POOLS, TOKEN_INFO } from ".";
import { getTokenMetadata } from "./getTokenMetadata";
import { getDefiplazaPools, getVolumeAndTokenMetadata } from "./src/defiplaza";
import { ociswapPools as getOciswapPools } from "./src/ociswap";

export interface Pool {
  type: string;
  component: string;
  tvl: number;
  bonus_24h: number;
  bonus_7d: number;
  base: string;
  quote: string;
  volume_7d: number;
  volume_24h: number;
  bonus_name: string;
  left_alt: string;
  right_alt: string;
  left_icon: string;
  right_icon: string;
  name: string;
  left_name: string;
  right_name: string;
  deposit_link: string;
  boosted: boolean;
  incentivised_lp_docs: string;
}

export async function getAllPools(): Promise<Pool[]> {
    const ociPools = await getOciswapPools();
    const dfpPools = await getDefiplazaPools();

    if (!ociPools || !dfpPools) return [];

    const remappedOciswapPools = ociPools.data.map(o => {
        PAIR_NAME_CACHE[o.lp_token_address] = {
            provider: 'Ociswap',
            name: `${o.x.token.symbol}/${o.y.token.symbol}`,
            left_alt: o.x.token.symbol,
            left_icon: o.x.token.icon_url,
            right_alt: o.y.token.symbol,
            right_icon: o.y.token.icon_url,
        };
        return ({
            type: 'ociswap',
            pool_type: 'double',
            component: o.address,
            tvl: +o.total_value_locked.usd.now,
            bonus_24h: +o.apr["24h"] * 100,
            bonus_7d: +o.apr["7d"] * 100,
            base: o.x.token.address,
            quote: o.y.token.address,
            volume_7d: +o.volume.usd["7d"],
            volume_24h: +o.volume.usd["24h"],
            bonus_name: 'APR',
            left_alt: o.x.token.symbol,
            right_alt: o.y.token.symbol,
            left_icon: o.x.token.icon_url,
            right_icon: o.y.token.icon_url,
            name: `${o.x.token.symbol}/${o.y.token.symbol}`,
            left_name: o.x.token.name,
            right_name: o.y.token.name,
            deposit_link: `https://ociswap.com/pools/${o.address}`,
            boosted: !!BOOSTED_POOLS[o.address],
            ...(BOOSTED_POOLS[o.address] && {
                incentivised_lp_docs: BOOSTED_POOLS[o.address].docs
            })
        });
    });

    const remappedDefiplazaPools = (await Promise.all(dfpPools.data.map(async (d) => {
        return Promise.all([getVolumeAndTokenMetadata(d.baseToken), getVolumeAndTokenMetadata(d.quoteToken)]).then(async ([base, quote]) => {
            if (!quote && TOKEN_INFO[d.quoteToken]) {
                quote = {} as any;

                if (quote) {
                    quote.right_alt = TOKEN_INFO[d.quoteToken].symbol;
                    quote.right_icon = TOKEN_INFO[d.quoteToken].icon_url;
                }
            } else {
                TOKEN_INFO[d.quoteToken] = await getTokenMetadata(d.quoteToken);
                quote = {} as any;
                if (quote) {
                    quote.right_alt = TOKEN_INFO[d.quoteToken].symbol;
                    quote.right_icon = TOKEN_INFO[d.quoteToken].icon_url;
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
                };
            }

            if (base && !PAIR_NAME_CACHE[base.quoteLPToken]) {
                PAIR_NAME_CACHE[base.quoteLPToken] = {
                    provider: 'Defiplaza',
                    name: `${base?.left_alt}/${quote?.right_alt}`,
                    left_alt: base?.left_alt || '',
                    left_icon: base?.left_icon || '',
                    right_alt: quote?.right_alt || '',
                    right_icon: quote?.right_icon || '',
                };
            }

            if (quote && !PAIR_NAME_CACHE[quote.baseLPToken]) {
                PAIR_NAME_CACHE[quote.quoteLPToken] = {
                    provider: 'Defiplaza',
                    name: `${base?.left_alt}/${quote?.right_alt}`,
                    left_alt: base?.left_alt || '',
                    left_icon: base?.left_icon || '',
                    right_alt: quote?.right_alt || '',
                    right_icon: quote?.right_icon || '',
                };
            }

            if (quote && !PAIR_NAME_CACHE[quote.quoteLPToken]) {
                PAIR_NAME_CACHE[quote.quoteLPToken] = {
                    provider: 'Defiplaza',
                    name: `${base?.left_alt}/${quote?.right_alt}`,
                    left_alt: base?.left_alt || '',
                    left_icon: base?.left_icon || '',
                    right_alt: quote?.right_alt || '',
                    right_icon: quote?.right_icon || '',
                };
            }

            return ([
                {
                    type: 'defiplaza',
                    pool_type: 'double',
                    component: d.address,
                    tvl: d.tvlUSD,
                    bonus_24h: (base?.alr_24h || 0) * 10,
                    bonus_7d: (base?.alr_7d || 0) * 10,
                    base: d.baseToken,
                    quote: d.quoteToken,
                    volume_7d: base?.volume_7d || 0,
                    volume_24h: base?.volume_24h || 0,
                    bonus_name: 'ALR',
                    left_alt: base?.left_alt || '',
                    left_icon: base?.left_icon || '',
                    right_alt: quote?.right_alt || '',
                    right_icon: quote?.right_icon || '',
                    name: `${base?.left_alt}/${quote?.right_alt}`,
                    left_name: base?.left_name || '',
                    right_name: quote?.right_name || '',
                    deposit_link: `https://radix.defiplaza.net/liquidity/add/${d.baseToken}?direction=${base?.single.side === 'base' ? 'quote' : 'base'}`,
                    boosted: !!BOOSTED_POOLS[d.address],
                    ...(BOOSTED_POOLS[d.address] && {
                        incentivised_lp_docs: BOOSTED_POOLS[d.address].docs
                    }),
                },
                {
                    type: 'defiplaza',
                    pool_type: 'single',
                    component: d.address,
                    tvl: d.tvlUSD,
                    bonus_24h: (base?.single.alr_24h || 0) * 10,
                    bonus_7d: (base?.single.alr_7d || 0) * 10,
                    base: d.baseToken,
                    quote: d.quoteToken,
                    volume_7d: base?.volume_7d || 0,
                    volume_24h: base?.volume_24h || 0,
                    bonus_name: 'ALR',
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
                    deposit_link: `https://radix.defiplaza.net/liquidity/add/${d.baseToken}?direction=${base?.single.side === 'base' ? 'quote' : 'base'}`,
                    boosted: !!BOOSTED_POOLS[d.address],
                    ...(BOOSTED_POOLS[d.address] && {
                        incentivised_lp_docs: BOOSTED_POOLS[d.address].docs
                    }),
                } as Pool,
            ]);
        });
    }).flatMap(arr => arr))).flatMap(arr => arr);

    return [...remappedOciswapPools, ...remappedDefiplazaPools].sort((a, b) => {
        return b.volume_7d - a.volume_7d || b.bonus_7d - a.bonus_7d || b.tvl - a.tvl;
    });
}

