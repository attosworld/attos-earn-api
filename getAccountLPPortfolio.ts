import type { NftInfo } from "@calamari-radix/gateway-ez-mode/dist/types";
import Decimal from "decimal.js";
import { gatewayApi, gatewayApiEzMode, PAIR_NAME_CACHE } from ".";
import { getAllAddLiquidityTxs } from "./getAllAddLiquidityTxs";
import { tokensRequest, type TokenInfo } from "./src/astrolescent";
import { defiplazaLpInfo, type DefiPlazaLPInfo } from "./src/defiplaza";
import { getOciswapLpInfo, type OciswapLPInfo } from "./src/ociswap";
import { s } from "@calamari-radix/gateway-ez-mode";
import type { TransactionFungibleBalanceChanges } from "@radixdlt/babylon-gateway-api-sdk";


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
  strategy?: boolean;
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

const SLP_MANIFEST_REMOVE_LIQUIDITY =
`CALL_METHOD
Address("{account}")
"withdraw"
Address("resource_rdx1t48x0z68dm6z422wxyctj5wvnt2nh95lvmly65vxzywdkd24zypl5d")
Decimal("{amount}")
;
TAKE_ALL_FROM_WORKTOP
Address("resource_rdx1t48x0z68dm6z422wxyctj5wvnt2nh95lvmly65vxzywdkd24zypl5d")
Bucket("tokens")
;
CALL_METHOD
Address("component_rdx1cp92uemllvxuewz93s5h8f36plsmrysssjjl02vve3zvsdlyxhmne7")
"remove_liquidity"
Bucket("tokens");
TAKE_ALL_FROM_WORKTOP
    Address("resource_rdx1th3uhn6905l2vh49z2d83xgr45a08dkxn8ajxmt824ctpdu69msp89")
    Bucket("bucket2")
;
CALL_METHOD
    Address("component_rdx1czqcwcqyv69y9s6xfk443250ruragewa0vj06u5ke04elcu9kae92n")
    "unwrap"
    Bucket("bucket2")
    Address("resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf")
;
CALL_METHOD
Address("{account}")
"deposit_batch"
Expression("ENTIRE_WORKTOP");`


interface EntityInfo {
  // Add properties that are in the component_entity and vault_entity objects
  // For example:
  address: string;
  // ... other properties
}

interface ResourceChange {
  resource_address: string;
  component_entity: EntityInfo;
  vault_entity: EntityInfo;
  amount: string;
}

async function getAssetOutStrategyValue(tokenPrices: Record<string, TokenInfo>, outAsset: TransactionFungibleBalanceChanges, account: string) {
    if (outAsset.resource_address === 'resource_rdx1t48x0z68dm6z422wxyctj5wvnt2nh95lvmly65vxzywdkd24zypl5d') {
        const preview = await gatewayApi.transaction.innerClient.transactionPreview({
            'transactionPreviewRequest': {
                manifest: SLP_MANIFEST_REMOVE_LIQUIDITY
            .replaceAll("{amount}", outAsset.balance_change)
            .replaceAll("{account}", account),
            signer_public_keys: [],
            nonce: 99,
            start_epoch_inclusive: 0,
            end_epoch_exclusive: 1,
                flags: {
                    use_free_credit: true,
                    assume_all_signature_proofs: true,
                    skip_epoch_check: true,
                    disable_auth_checks: true
                }
            }
        });

        const value = (preview.resource_changes
            .find(rc => (rc as { index: number; resource_changes: any[]; })
                .resource_changes.find(rc => +rc.amount > 0)) as { resource_changes: ResourceChange[]; }).resource_changes[0];
        const resourceOut = value.resource_address;

        return new Decimal(value.amount).times(tokenPrices[resourceOut].tokenPriceUSD)
    }

    return new Decimal(0);
}

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

    const strategyTxs = liquidityPoolTxs.filter(tx => tx.strategy);

    console.log(strategyTxs);

    // Combine and sort all transactions chronologically
    const allPoolTxs = liquidityPoolTxs;

    const portfolioPnL: PoolPortfolioItem[] = (await Promise.all([
        ...Object.entries(lps).map(async ([lpAddress, lpInfo]) => {
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
                const baseValue = new Decimal(underlyingTokens.baseAmount).times(tokenPrices[underlyingTokens.baseToken]?.tokenPriceUSD || 0);
                const quoteValue = new Decimal(underlyingTokens.quoteAmount).times(tokenPrices[underlyingTokens.quoteToken]?.tokenPriceUSD || 0);

                currentValue = baseValue.plus(quoteValue);
            } else if (isOciswapLPInfo(underlyingTokens)) {
                const xValue = new Decimal(underlyingTokens.x_amount.token).times(tokenPrices[underlyingTokens.x_address]?.tokenPriceUSD || 0);
                const yValue = new Decimal(underlyingTokens.y_amount.token).times(tokenPrices[underlyingTokens.y_address]?.tokenPriceUSD || 0);
                currentValue = xValue.plus(yValue);
            } else if (isOciswapV2LPInfo(underlyingTokens)) {
                underlyingTokens.forEach(lp => {
                    const xValue = new Decimal(lp.x_amount.token).times(tokenPrices[lp.left_token]?.tokenPriceUSD || 0);
                    const yValue = new Decimal(lp.y_amount.token).times(tokenPrices[lp.right_token]?.tokenPriceUSD || 0);
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
                } as PoolPortfolioItem;
        }),
        ...strategyTxs.map(async (tx) => {
            let investedAmount = new Decimal(0);
            let currentValue = new Decimal(0);

            // Calculate invested amount (XRD)
            const xrdChange = tx.balance_changes?.fungible_balance_changes.find(bc => 
                bc.resource_address === "resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd" &&
                bc.entity_address.startsWith('account_rdx')
            );

            // Calculate invested amount (XRD)
            const rootNft = tx.balance_changes?.non_fungible_balance_changes.find(bc => 
                bc.resource_address === "resource_rdx1ngekvyag42r0xkhy2ds08fcl7f2ncgc0g74yg6wpeeyc4vtj03sa9f" &&
                bc.entity_address.startsWith('account_rdx')
            );

            if (rootNft) {
                const nft = await gatewayApi.state.getNonFungibleData(rootNft?.resource_address, rootNft?.added);

                const data = nft[0].data?.programmatic_json;

                if (data?.kind === 'Tuple') {
                    const collaterals = data.fields.find(f => f.field_name === 'collaterals');

                    if (collaterals && 'entries' in collaterals) {
                        if ('value' in collaterals.entries[0].value) {
                            const xrdAmount = +collaterals.entries[0].value.value;
                            const addedCurrent = new Decimal(xrdAmount).times(tokenPrices["resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd"].tokenPriceUSD);
                            currentValue = currentValue.add(addedCurrent);
                        }
                    }
                }
            }

            if (xrdChange) {
                investedAmount = new Decimal(Math.abs(+xrdChange.balance_change)).times(tokenPrices["resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd"]?.tokenPriceUSD);
            }

            const outAsset = tx.balance_changes?.fungible_balance_changes.find(bc => 
                bc.resource_address !== "resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd" &&
                bc.entity_address.startsWith('account_rdx')
            );

            if (outAsset) {
                currentValue = currentValue.add(await getAssetOutStrategyValue(tokenPrices, outAsset, address));
            }

            const pnlAmount = currentValue.minus(investedAmount);
            const pnlPercent = investedAmount.isZero()
                ? "0"
                : pnlAmount.div(investedAmount).times(100).toFixed(20);

            return {
                poolName: `Root Finance Strategy (Epoch: ${tx.epoch})`,
                leftAlt: "",
                rightAlt: "",
                leftIcon: "https://assets.radixdlt.com/icons/icon-xrd.png",
                rightIcon: "https://app.rootfinance.xyz/favicon.ico",
                provider: "Root Finance, Surge",
                invested: investedAmount.toFixed(),
                currentValue: currentValue.toFixed(),
                pnl: pnlAmount.toFixed(),
                pnlPercentage: pnlPercent,
                strategy: true,
            } as PoolPortfolioItem;
        })
    ])).filter((pool) => pool && ((+pool.invested || 0) > 1 || pool.strategy)) as PoolPortfolioItem[];
    return portfolioPnL;
}
