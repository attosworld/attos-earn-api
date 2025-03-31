import { GatewayEzMode, s } from "@calamari-radix/gateway-ez-mode";
import { defiplazaLpInfo, getDefiplazaPools, getVolumeAndTokenMetadata, type DefiPlazaLPInfo } from "./src/defiplaza";
import { getOciswapLpInfo, ociswapPools as getOciswapPools, type OciswapLPInfo } from "./src/ociswap";
import { GatewayApiClient, type CommittedTransactionInfo, type TransactionBalanceChanges } from "@radixdlt/babylon-gateway-api-sdk";
import Decimal from 'decimal.js';
import { tokensRequest } from "./src/astrolescent";
import type { NftInfo } from "@calamari-radix/gateway-ez-mode/dist/types";

const gatewayApi = GatewayApiClient.initialize({
  networkId: 1,
  applicationName: 'Foo'
});

const gatewayApiEzMode = new GatewayEzMode();

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
}

export interface TokenMetadata {
  dapp_definition: string,
  icon_url: string,
  symbol: string,
  description: string,
  name: string,
  info_url: string,
}

const getTokenMetadata = async (tokenAddress: string): Promise<TokenMetadata>  => {
  const response = await gatewayApi.state.getEntityMetadata(tokenAddress);

  return response.items.reduce((acc, m) => {
    if ('value' in m.value.typed) {
      acc[m.key as keyof TokenMetadata] = m.value.typed.value as string;
    }
    return acc;
  }, {} as TokenMetadata)
}

const tokenInfo: Record<string, TokenMetadata> = {
  'resource_rdx1t5ywq4c6nd2lxkemkv4uzt8v7x7smjcguzq5sgafwtasa6luq7fclq': await getTokenMetadata('resource_rdx1t5ywq4c6nd2lxkemkv4uzt8v7x7smjcguzq5sgafwtasa6luq7fclq')
};

export const PAIR_NAME_CACHE: Record<string, { name: string; left_alt: string; left_icon: string; right_alt: string; right_icon: string; provider: string; }> = {};

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
    }
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
    })
  });

  const remappedDefiplazaPools = (await Promise.all(dfpPools.data.map(async d => {
    return Promise.all([getVolumeAndTokenMetadata(d.baseToken), getVolumeAndTokenMetadata(d.quoteToken)]).then(async ([base, quote]) => {
      if (!quote && tokenInfo[d.quoteToken]) {
        quote = {} as any;

        if (quote) {
          quote.right_alt = tokenInfo[d.quoteToken].symbol;
          quote.right_icon = tokenInfo[d.quoteToken].icon_url;
        }
      } else {
        tokenInfo[d.quoteToken] = await getTokenMetadata(d.quoteToken);
        quote = {} as any;
        if (quote) {
          quote.right_alt = tokenInfo[d.quoteToken].symbol;
          quote.right_icon = tokenInfo[d.quoteToken].icon_url;
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
        }
      }

      if (quote &&!PAIR_NAME_CACHE[quote.baseLPToken]) {
        PAIR_NAME_CACHE[quote.quoteLPToken] = {
          provider: 'Defiplaza',
          name: `${base?.left_alt}/${quote?.right_alt}`,
          left_alt: base?.left_alt || '',
          left_icon: base?.left_icon || '',
          right_alt: quote?.right_alt || '',
          right_icon: quote?.right_icon || '',
        }
      }

      if (quote &&!PAIR_NAME_CACHE[quote.quoteLPToken]) {
        PAIR_NAME_CACHE[quote.quoteLPToken] = {
          provider: 'Defiplaza',
          name: `${base?.left_alt}/${quote?.right_alt}`,
          left_alt: base?.left_alt || '',
          left_icon: base?.left_icon || '',
          right_alt: quote?.right_alt || '',
          right_icon: quote?.right_icon || '',
        }
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
          deposit_link: `https://radix.defiplaza.net/liquidity/add/${d.baseToken}?direction=${base?.single.side === 'base'? 'quote' : 'base'}`,
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
          deposit_link: `https://radix.defiplaza.net/liquidity/add/${d.baseToken}?direction=${base?.single.side === 'base'? 'quote' : 'base'}`,
        } as Pool,
      ])
    });
  }).flatMap(arr => arr))).flatMap(arr => arr);

  return [...remappedOciswapPools,...remappedDefiplazaPools].sort((a, b) => {
    return  b.volume_7d - a.volume_7d || b.bonus_7d - a.bonus_7d || b.tvl - a.tvl;
  });
}

const getAllAddLiquidityTxs = async (address: string, items: CommittedTransactionInfo[] = [], cursor?: string) => {
  const response = await gatewayApi.stream.innerClient.streamTransactions({
    streamTransactionsRequest: {
      affected_global_entities_filter: [address],
      opt_ins: {
        balance_changes: true,
        manifest_instructions: true,
      },
      ...(cursor && { cursor })
    }
  });

  if (response.next_cursor) {
    return await getAllAddLiquidityTxs(address, [...items, ...response.items], response.next_cursor);
  }

  const liquidity = [...items,...response.items];

  return {
    added: liquidity.filter((tx) => tx.manifest_instructions?.includes('add_liquidity')),
    removed: liquidity.filter((tx) => tx.manifest_instructions?.includes('remove_liquidity'))
  }
}

export interface PoolPortfolioItem {
  poolName: string,
  leftAlt: string,
  rightAlt: string,
  leftIcon: string,
  rightIcon: string,
  invested: string;
  currentValue: string;
  pnl: string;
  pnlPercentage: string;
}

function isDefiplazaLPInfo(info: any): info is DefiPlazaLPInfo {
  return 'baseToken' in info && 'quoteToken' in info;
}

function isOciswapLPInfo(info: any): info is OciswapLPInfo {
  return 'x_address' in info && 'y_address' in info;
}

function isOciswapV2LPInfo(info: any): info is (OciswapLPInfo & { left_token: string; right_token: string; })[] {
  return info.length && info.every((lp: any) => 'x_amount' in lp && 'y_amount' in lp);
}

const OciswapV2Nft = s.struct({
    liquidity: s.decimal(),
    left_bound: s.number(),
    right_bound: s.number(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

await getAllPools();

const port = process.env.PORT || 3000;

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/pools") {
      return new Response(JSON.stringify(await getAllPools()), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    if (url.pathname === "/portfolio") {
      const address = url.searchParams.get("address");

      if (!address || !address.startsWith('account_rdx')) {
        return new Response(JSON.stringify({ error_codes: ['address_invalid']}), {
          headers: { "Content-Type": "application/json",...corsHeaders },
        })
      }

      const fungibleLps = await gatewayApiEzMode.state.getComponentFungibleBalances(address);
      const nftLps = await gatewayApiEzMode.state.getComponentNonFungibleBalances(address);

      const lps: Record<string, { type: 'defiplaza' | 'ociswap' | 'ociswap_v2', balance?: string, nftInfo?: { nfts: NftInfo[], component: string, left_token: string, right_token: string } }> = {};

      fungibleLps.forEach(token => {
        if (token.resourceInfo.metadata.name?.match(/Defiplaza (.+) Quote/)) {
          lps[token.resourceInfo.resourceAddress] = { type: 'defiplaza', balance: token.balance};
        } else if (token.resourceInfo.metadata.name?.startsWith('Ociswap LP')) {
          lps[token.resourceInfo.resourceAddress] = { type: 'ociswap', balance: token.balance };
        }
      });

      nftLps.forEach(async token => {
        if (token.resourceInfo.metadata.name?.startsWith('Ociswap LP')) {
          const split = token.resourceInfo.metadata.infoUrl?.split('/') as string[];
          const pair = await gatewayApiEzMode.state.getComponentInfo(split[split.length - 1]);
          const { x_address, y_address } = pair.metadata.metadataExtractor.getMetadataValuesBatch({
            x_address: 'GlobalAddress',
            y_address: 'GlobalAddress',
          }) as { x_address: string, y_address: string };

          lps[token.resourceInfo.resourceAddress] = { type: 'ociswap_v2', nftInfo: { nfts: token.nftBalance, component: split[split.length - 1], left_token: x_address, right_token: y_address } };
        }
      });

      const [tokenPrices, liquidityPoolTxs] = await Promise.all([ tokensRequest(), getAllAddLiquidityTxs(address)]);

      const addedPoolTxs = liquidityPoolTxs.added.filter(
        tx => tx.balance_changes?.fungible_balance_changes.find(fb => fb.resource_address in lps)
        || tx.balance_changes?.non_fungible_balance_changes.find(nfb => nfb.resource_address in lps)
      ).map(tx => tx.balance_changes as TransactionBalanceChanges);

      const removedPoolTxs = liquidityPoolTxs.removed.map(tx => tx.balance_changes as TransactionBalanceChanges);

      const portfolioPnL: PoolPortfolioItem[] = (await Promise.all(Object.entries(lps).map(async ([lpAddress, lpInfo]) => {
        let investedAmount = new Decimal(0);
        let currentValue = new Decimal(0);

        // Get underlying tokens
        let underlyingTokens;
        if (lpInfo.type === 'defiplaza' && lpInfo.balance) {
          underlyingTokens = await defiplazaLpInfo(lpAddress, lpInfo.balance);
        } else if (lpInfo.type === 'ociswap' && lpInfo.balance) {
          underlyingTokens = await getOciswapLpInfo(lpAddress, lpInfo.balance);
        } else if (lpInfo.type === 'ociswap_v2' && lpInfo.nftInfo) {
          const nftLp = await Promise.all(lpInfo.nftInfo.nfts.map(async nfi => {
            const nft = nfi.nftData.getWithSchema(OciswapV2Nft)._unsafeUnwrap();
            return getOciswapLpInfo((lpInfo.nftInfo as { component: string }).component, nft.liquidity, nft.left_bound, nft.right_bound)
            .then(res => ({
              ...res,
              left_token: lpInfo.nftInfo?.left_token,
              right_token: lpInfo.nftInfo?.right_token,
            }));
          }));
          underlyingTokens = nftLp as OciswapLPInfo[];
        }

        if (!underlyingTokens) {
          return null;
        }

        // Calculate current value based on underlying tokens
        if (isDefiplazaLPInfo(underlyingTokens)) {
          const baseValue = new Decimal(underlyingTokens.baseAmount).times(tokenPrices[underlyingTokens.baseToken].tokenPriceUSD);
          const quoteValue = new Decimal(underlyingTokens.quoteAmount).times(tokenPrices[underlyingTokens.quoteToken].tokenPriceUSD);
          currentValue = baseValue.plus(quoteValue);
        } else if (isOciswapLPInfo(underlyingTokens)) {
          const xValue = new Decimal(underlyingTokens.x_amount.token).times(tokenPrices[underlyingTokens.x_address].tokenPriceUSD);
          const yValue = new Decimal(underlyingTokens.y_amount.token).times(tokenPrices[underlyingTokens.y_address].tokenPriceUSD);
          currentValue = xValue.plus(yValue);
        } else if (isOciswapV2LPInfo(underlyingTokens)) {
          underlyingTokens.forEach(lp => {
            const xValue = new Decimal(lp.x_amount.token).times(tokenPrices[lp.left_token].tokenPriceUSD);
            const yValue = new Decimal(lp.y_amount.token).times(tokenPrices[lp.right_token].tokenPriceUSD);
            currentValue = currentValue.plus(xValue.plus(yValue));
          });
        } else {
          console.error('Unsupported LP type:', underlyingTokens);
        }

        // Calculate invested amount based on transactions
        addedPoolTxs.forEach(tx => {
          const fungibleChange = tx.fungible_balance_changes.find(fb => fb.resource_address === lpAddress);

          if (fungibleChange) {
            const investedTokens = tx.fungible_balance_changes.filter(bc => bc.entity_address.startsWith('account_rdx') && +bc.balance_change < 0)

            investedTokens.forEach(it => {
              investedAmount = investedAmount.plus(new Decimal(Math.abs(+it.balance_change)).times(tokenPrices[it.resource_address].tokenPriceUSD));
            });
          }

          const nonFungibleChange = tx.non_fungible_balance_changes.find(fb => fb.resource_address === lpAddress);

          if (nonFungibleChange) {
            const investedTokens = tx.fungible_balance_changes.filter(bc => bc.entity_address.startsWith('account_rdx') && +bc.balance_change < 0)

            investedTokens.forEach(it => {
              investedAmount = investedAmount.plus(new Decimal(Math.abs(+it.balance_change)).times(tokenPrices[it.resource_address].tokenPriceUSD));
            });
          }
        });

        // calculate removed liquidity
        removedPoolTxs.forEach(tx => {
          const fungibleChange = tx.fungible_balance_changes.find(fb => fb.resource_address === lpAddress);

          if (fungibleChange) {
            const investedTokens = tx.fungible_balance_changes.filter(bc => bc.entity_address.startsWith('account_rdx') && +bc.balance_change > 0)

            investedTokens.forEach(it => {
              investedAmount = investedAmount.minus(new Decimal(Math.abs(+it.balance_change)).times(tokenPrices[it.resource_address].tokenPriceUSD));
            });
          }

          const nonFungibleChange = tx.non_fungible_balance_changes.find(fb => fb.resource_address === lpAddress);
          if (nonFungibleChange) {
            const investedTokens = tx.fungible_balance_changes.filter(bc => bc.entity_address.startsWith('account_rdx') && +bc.balance_change > 0)

            investedTokens.forEach(it => {
              investedAmount = investedAmount.minus(new Decimal(Math.abs(+it.balance_change)).times(tokenPrices[it.resource_address].tokenPriceUSD));
            });
          }
        });

        const pnlAmount = currentValue.minus(investedAmount);
        const pnlPercent = investedAmount.isZero()
          ? "0"
          : pnlAmount.div(investedAmount).times(100).toFixed(20);

          return {
            poolName: PAIR_NAME_CACHE[lpAddress]?.name,
            leftAlt: PAIR_NAME_CACHE[lpAddress]?.left_alt,
            rightAlt: PAIR_NAME_CACHE[lpAddress]?.right_alt,
            leftIcon: PAIR_NAME_CACHE[lpAddress]?.left_icon,
            rightIcon: PAIR_NAME_CACHE[lpAddress]?.right_icon,
            provider: PAIR_NAME_CACHE[lpAddress]?.provider,
            invested: investedAmount.toFixed(),
            currentValue: currentValue.toFixed(),
            pnl: pnlAmount.toFixed(),
            pnlPercentage: pnlPercent
          };
      }))).filter((pool) => pool && (+pool.invested || 0) > 1) as PoolPortfolioItem[];

      return new Response(JSON.stringify(portfolioPnL), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

      return new Response(null, {
        status: 404,
        headers: corsHeaders,
      });
  },
});

console.log(`Server running on http://localhost:${port}/`);
