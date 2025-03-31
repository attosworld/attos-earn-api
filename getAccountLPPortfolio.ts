import type { NftInfo } from "@calamari-radix/gateway-ez-mode/dist/types";
import type { TransactionBalanceChanges } from "@radixdlt/babylon-gateway-api-sdk";
import Decimal from "decimal.js";
import { gatewayApiEzMode, PAIR_NAME_CACHE } from ".";
import { getAllAddLiquidityTxs } from "./getAllAddLiquidityTxs";
import { tokensRequest } from "./src/astrolescent";
import { defiplazaLpInfo, type DefiPlazaLPInfo } from "./src/defiplaza";
import { getOciswapLpInfo, type OciswapLPInfo } from "./src/ociswap";
import { s } from "@calamari-radix/gateway-ez-mode";


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

export function isDefiplazaLPInfo(info: any): info is DefiPlazaLPInfo {
  return 'baseToken' in info && 'quoteToken' in info;
}

export function isOciswapLPInfo(info: any): info is OciswapLPInfo {
  return 'x_address' in info && 'y_address' in info;
}

export function isOciswapV2LPInfo(info: any): info is (OciswapLPInfo & { left_token: string; right_token: string; })[] {
  return info.length && info.every((lp: any) => 'x_amount' in lp && 'y_amount' in lp);
}

export const OciswapV2Nft = s.struct({
    liquidity: s.decimal(),
    left_bound: s.number(),
    right_bound: s.number(),
});


export async function getAccountLPPortfolio(address: string) {
    const fungibleLps = await gatewayApiEzMode.state.getComponentFungibleBalances(address);
    const nftLps = await gatewayApiEzMode.state.getComponentNonFungibleBalances(address);

    const lps: Record<string, { type: 'defiplaza' | 'ociswap' | 'ociswap_v2'; balance?: string; nftInfo?: { nfts: NftInfo[]; component: string; left_token: string; right_token: string; }; }> = {};

    fungibleLps.forEach(token => {
        if (token.resourceInfo.metadata.name?.match(/Defiplaza (.+) Quote/) || token.resourceInfo.metadata.name?.match(/Defiplaza (.+) Base/)) {
            lps[token.resourceInfo.resourceAddress] = { type: 'defiplaza', balance: token.balance };
        } else if (token.resourceInfo.metadata.name?.startsWith('Ociswap LP')) {
            lps[token.resourceInfo.resourceAddress] = { type: 'ociswap', balance: token.balance };
        }
    });

    nftLps.forEach(async (token) => {
        if (token.resourceInfo.metadata.name?.startsWith('Ociswap LP')) {
            const split = token.resourceInfo.metadata.infoUrl?.split('/') as string[];
            const pair = await gatewayApiEzMode.state.getComponentInfo(split[split.length - 1]);
            const { x_address, y_address } = pair.metadata.metadataExtractor.getMetadataValuesBatch({
                x_address: 'GlobalAddress',
                y_address: 'GlobalAddress',
            }) as { x_address: string; y_address: string; };

            lps[token.resourceInfo.resourceAddress] = { type: 'ociswap_v2', nftInfo: { nfts: token.nftBalance, component: split[split.length - 1], left_token: x_address, right_token: y_address } };
        }
    });

    const [tokenPrices, liquidityPoolTxs] = await Promise.all([tokensRequest(), getAllAddLiquidityTxs(address)]);

    // Combine and sort all transactions chronologically
    const allPoolTxs = liquidityPoolTxs;

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
            const nftLp = await Promise.all(lpInfo.nftInfo.nfts.map(async (nfi) => {
                const nft = nfi.nftData.getWithSchema(OciswapV2Nft)._unsafeUnwrap();
                return getOciswapLpInfo((lpInfo.nftInfo as { component: string; }).component, nft.liquidity, nft.left_bound, nft.right_bound)
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

        // Calculate invested amount based on all transactions in chronological order
        allPoolTxs.forEach(tx => {
            const fungibleChange = tx.balance_changes?.fungible_balance_changes.find(fb => fb.resource_address === lpAddress);
            const nonFungibleChange = tx.balance_changes?.non_fungible_balance_changes.find(fb => fb.resource_address === lpAddress);

            if (fungibleChange || nonFungibleChange) {
                const relevantTokenChanges = tx.balance_changes?.fungible_balance_changes.filter(bc => 
                    bc.entity_address.startsWith('account_rdx') && bc.resource_address !== lpAddress
                );

                relevantTokenChanges?.forEach(it => {
                    if (+it.balance_change < 0) {
                        // Adding liquidity
                        investedAmount = investedAmount.plus(new Decimal(Math.abs(+it.balance_change)).times(tokenPrices[it.resource_address].tokenPriceUSD));
                    } else {
                        // Removing liquidity
                        investedAmount = investedAmount.minus(new Decimal(+it.balance_change).times(tokenPrices[it.resource_address].tokenPriceUSD));
                    }
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
            pnlPercentage: pnlPercent,
        };
    }))).filter((pool) => pool && (+pool.invested || 0) > 1) as PoolPortfolioItem[];
    return portfolioPnL;
}

