import type { NftInfo } from '@calamari-radix/gateway-ez-mode/dist/types'
import Decimal from 'decimal.js'
import { gatewayApi, gatewayApiEzMode, PAIR_NAME_CACHE } from '.'
import {
    CLOSE_POSITION_SURGE_LP_STRATEGY_MANIFEST,
    getAllAddLiquidityTxs,
    OPEN_POSITION_SURGE_LP_STRATEGY_MANIFEST,
    type EnhancedTransactionInfo,
} from './getAllAddLiquidityTxs'
import { tokensRequest, type TokenInfo } from './src/astrolescent'
import { defiplazaLpInfo, type DefiPlazaLPInfo } from './src/defiplaza'
import {
    getOciswapLpInfo,
    getOciswapTokenInfo,
    type OciswapLPInfo,
} from './src/ociswap'
import { s } from '@calamari-radix/gateway-ez-mode'
import type {
    CommittedTransactionInfo,
    TransactionFungibleBalanceChanges,
} from '@radixdlt/babylon-gateway-api-sdk'
import {
    getRootFinancePoolState,
    type RootFinancePoolStateResponse,
} from './src/rootFinance'

export interface PoolPortfolioItem {
    poolName: string
    leftAlt: string
    rightAlt: string
    leftIcon: string
    rightIcon: string
    invested: string
    currentValue: string
    pnl: string
    pnlPercentage: string
    strategy?: boolean
}

export function isDefiplazaLPInfo(
    info: UnderlyingTokens
): info is DefiPlazaLPInfo {
    return info !== null && 'baseToken' in info && 'quoteToken' in info
}

export function isOciswapLPInfo(info: UnderlyingTokens): info is OciswapLPInfo {
    return info !== null && 'x_address' in info && 'y_address' in info
}

export function isOciswapV2LPInfo(
    info: UnderlyingTokens
): info is (OciswapLPInfo & { left_token: string; right_token: string })[] {
    return (
        info instanceof Array &&
        info.every((lp) => 'x_amount' in lp && 'y_amount' in lp)
    )
}

export const OciswapV2Nft = s.struct({
    liquidity: s.decimal(),
    left_bound: s.number(),
    right_bound: s.number(),
})

const SLP_MANIFEST_REMOVE_LIQUIDITY = `CALL_METHOD
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

const CLOSE_STRATEGY_MANIFEST = `CALL_METHOD
  Address("{account}")
  "withdraw"
  Address("resource_rdx1t48x0z68dm6z422wxyctj5wvnt2nh95lvmly65vxzywdkd24zypl5d")
  Decimal("{surgeLpAmount}")
;
TAKE_ALL_FROM_WORKTOP
  Address("resource_rdx1t48x0z68dm6z422wxyctj5wvnt2nh95lvmly65vxzywdkd24zypl5d")
  Bucket("surge_lp")
;
CALL_METHOD
  Address("component_rdx1cp92uemllvxuewz93s5h8f36plsmrysssjjl02vve3zvsdlyxhmne7")
  "remove_liquidity"
  Bucket("surge_lp")
;
TAKE_ALL_FROM_WORKTOP
  Address("resource_rdx1th3uhn6905l2vh49z2d83xgr45a08dkxn8ajxmt824ctpdu69msp89")
  Bucket("susd")
;
CALL_METHOD
  Address("component_rdx1czqcwcqyv69y9s6xfk443250ruragewa0vj06u5ke04elcu9kae92n")
  "unwrap"
  Bucket("susd")
  Address("resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf")
;
TAKE_ALL_FROM_WORKTOP
  Address("resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf")
  Bucket("xusdc")
;
CALL_METHOD
  Address("{account}")
  "create_proof_of_non_fungibles"
  Address("resource_rdx1ngekvyag42r0xkhy2ds08fcl7f2ncgc0g74yg6wpeeyc4vtj03sa9f")
  Array<NonFungibleLocalId>(
    NonFungibleLocalId("{rootNftId}")
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
    Bucket("xusdc")
  )
;
CALL_METHOD
  Address("component_rdx1crwusgp2uy9qkzje9cqj6pdpx84y94ss8pe7vehge3dg54evu29wtq")
  "remove_collateral"
  Proof("root_nft_2")
  Array<Tuple>(
    Tuple(
      Address("resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd"),
      Decimal("{lendAmount}"),
      false
    )
  )
;
TAKE_ALL_FROM_WORKTOP
  Address("resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf")
  Bucket("xusdc_2")
;
CALL_METHOD
  Address("component_rdx1cz8daq5nwmtdju4hj5rxud0ta26wf90sdk5r4nj9fqjcde5eht8p0f")
  "swap"
  Bucket("xusdc_2")
;
CALL_METHOD
  Address("{account}")
  "deposit_batch"
  Expression("ENTIRE_WORKTOP")
;`

interface EntityInfo {
    entity_address: string
}

export interface ResourceChange {
    resource_address: string
    component_entity: EntityInfo
    vault_entity: EntityInfo
    amount: string
}

async function getAssetOutStrategyValue(
    outAsset: TransactionFungibleBalanceChanges,
    account: string
) {
    if (
        outAsset.resource_address ===
        'resource_rdx1t48x0z68dm6z422wxyctj5wvnt2nh95lvmly65vxzywdkd24zypl5d'
    ) {
        const manifest = SLP_MANIFEST_REMOVE_LIQUIDITY.replaceAll(
            '{amount}',
            outAsset.balance_change
        ).replaceAll('{account}', account)
        const preview = await previewTx(manifest)

        const value = (
            preview.resource_changes?.find((rc) =>
                (
                    rc as { index: number; resource_changes: ResourceChange[] }
                ).resource_changes?.find((rc) => +rc.amount > 0)
            ) as { resource_changes: ResourceChange[] } | undefined
        )?.resource_changes[0]
        const resourceOut = value?.resource_address

        if (resourceOut) {
            const price = await getOciswapTokenInfo(resourceOut)
            if (price) {
                return new Decimal(value.amount).times(price.price.xrd.now)
            }
        }
    }

    return new Decimal(0)
}

export async function previewTx(manifest: string) {
    return await gatewayApi.transaction.innerClient.transactionPreview({
        transactionPreviewRequest: {
            manifest,
            signer_public_keys: [],
            nonce: 99,
            start_epoch_inclusive: 0,
            end_epoch_exclusive: 1,
            flags: {
                use_free_credit: true,
                assume_all_signature_proofs: true,
                skip_epoch_check: true,
                disable_auth_checks: true,
            },
        },
    })
}

export function astrolescentRequest(
    leftPair: string,
    rightPair: string,
    amount: string,
    accountAddress: string
) {
    return fetch(`https://api.astrolescent.com/partner/selfisocial/swap`, {
        headers: {
            accept: 'application/json, text/plain, */*',
        },
        mode: 'cors',
        method: 'POST',
        body: JSON.stringify({
            inputToken: leftPair,
            outputToken: rightPair,
            inputAmount: amount,
            fromAddress: accountAddress,
        }),
    })
}

async function getLPInfo(
    lpAddress: string,
    lpInfo: {
        type: 'defiplaza' | 'ociswap' | 'ociswap_v2'
        balance?: string
        nftInfo?: {
            nfts: NftInfo[]
            component: string
            left_token: string
            right_token: string
        }
    }
): Promise<UnderlyingTokens | undefined> {
    if (lpInfo.type === 'defiplaza' && lpInfo.balance) {
        return await defiplazaLpInfo(lpAddress, lpInfo.balance)
    } else if (lpInfo.type === 'ociswap' && lpInfo.balance) {
        return await getOciswapLpInfo(lpAddress, lpInfo.balance)
    } else if (lpInfo.type === 'ociswap_v2' && lpInfo.nftInfo) {
        return (await Promise.all(
            lpInfo.nftInfo.nfts.map(async (nfi: NftInfo) => {
                const nft = nfi.nftData
                    .getWithSchema(OciswapV2Nft)
                    ._unsafeUnwrap()
                return getOciswapLpInfo(
                    lpInfo.nftInfo!.component,
                    nft.liquidity,
                    nft.left_bound,
                    nft.right_bound
                ).then((res) => ({
                    ...res,
                    left_token: lpInfo.nftInfo!.left_token,
                    right_token: lpInfo.nftInfo!.right_token,
                }))
            })
        )) as OciswapLPInfo & { left_token: string; right_token: string }[]
    }
}

export type UnderlyingTokens =
    | OciswapLPInfo
    | null
    | DefiPlazaLPInfo
    | null
    | (OciswapLPInfo & { left_token: string; right_token: string })[]

function calculateCurrentValue(
    underlyingTokens: UnderlyingTokens,
    tokenPrices: Record<string, TokenInfo>
) {
    let currentValue = new Decimal(0)

    if (underlyingTokens) {
        if (isDefiplazaLPInfo(underlyingTokens)) {
            const baseValue = new Decimal(underlyingTokens.baseAmount).times(
                tokenPrices[underlyingTokens.baseToken]?.tokenPriceUSD || 0
            )
            const quoteValue = new Decimal(underlyingTokens.quoteAmount).times(
                tokenPrices[underlyingTokens.quoteToken]?.tokenPriceUSD || 0
            )
            currentValue = baseValue.plus(quoteValue)
        } else if (isOciswapLPInfo(underlyingTokens)) {
            const xValue = new Decimal(underlyingTokens.x_amount.token).times(
                tokenPrices[underlyingTokens.x_address]?.tokenPriceUSD || 0
            )
            const yValue = new Decimal(underlyingTokens.y_amount.token).times(
                tokenPrices[underlyingTokens.y_address]?.tokenPriceUSD || 0
            )
            currentValue = xValue.plus(yValue)
        } else if (isOciswapV2LPInfo(underlyingTokens)) {
            underlyingTokens.forEach((lp) => {
                const xValue = new Decimal(lp.x_amount.token).times(
                    tokenPrices[lp.left_token]?.tokenPriceUSD || 0
                )
                const yValue = new Decimal(lp.y_amount.token).times(
                    tokenPrices[lp.right_token]?.tokenPriceUSD || 0
                )
                currentValue = currentValue.plus(xValue.plus(yValue))
            })
        }
    }
    return currentValue
}

function processLPTransaction(
    lpAddress: string,
    tx: EnhancedTransactionInfo,
    tokenPrices: Record<string, TokenInfo>
) {
    let investedAmount = new Decimal(0)
    const fungibleChange = tx.balance_changes?.fungible_balance_changes.find(
        (fb) => fb.resource_address === lpAddress
    )
    const nonFungibleChange =
        tx.balance_changes?.non_fungible_balance_changes.find(
            (fb) => fb.resource_address === lpAddress
        )

    if (fungibleChange || nonFungibleChange) {
        const relevantTokenChanges =
            tx.balance_changes?.fungible_balance_changes.filter(
                (bc) =>
                    bc.entity_address.startsWith('account_rdx') &&
                    bc.resource_address !== lpAddress
            )

        relevantTokenChanges?.forEach((it) => {
            if (+it.balance_change < 0) {
                investedAmount = investedAmount.plus(
                    new Decimal(it.balance_change)
                        .abs()
                        .times(tokenPrices[it.resource_address].tokenPriceUSD)
                )
            } else {
                investedAmount = investedAmount.minus(
                    new Decimal(it.balance_change).times(
                        tokenPrices[it.resource_address].tokenPriceUSD
                    )
                )
            }
        })
    }
    return investedAmount
}

async function processStrategyTransaction(
    tx: CommittedTransactionInfo,
    tokenPrices: Record<string, TokenInfo>,
    address: string,
    rootFinancePoolState: RootFinancePoolStateResponse,
    txs: EnhancedTransactionInfo[]
) {
    if (
        OPEN_POSITION_SURGE_LP_STRATEGY_MANIFEST.every((method) =>
            tx.manifest_instructions?.includes(method)
        )
    ) {
        let investedAmount = new Decimal(0)
        let currentValue = new Decimal(0)
        let closeManifest: string = ''

        const xrdChange = tx.balance_changes?.fungible_balance_changes.find(
            (bc) =>
                bc.resource_address ===
                    'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd' &&
                bc.entity_address.startsWith('account_rdx')
        )

        const surgeLp = tx.balance_changes?.fungible_balance_changes.find(
            (bc) =>
                bc.resource_address !==
                    'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd' &&
                bc.entity_address.startsWith('account_rdx')
        )

        const rootNft = tx.balance_changes?.non_fungible_balance_changes.find(
            (bc) =>
                bc.resource_address ===
                    'resource_rdx1ngekvyag42r0xkhy2ds08fcl7f2ncgc0g74yg6wpeeyc4vtj03sa9f' &&
                bc.entity_address.startsWith('account_rdx')
        )

        let underlyingXrdAmount = new Decimal(0)
        let underlyingUsdAmount = new Decimal(0)

        if (rootNft && surgeLp) {
            const nft = await gatewayApi.state.getNonFungibleData(
                rootNft?.resource_address,
                rootNft.added
            )
            const data = nft[0].data?.programmatic_json
            if (data?.kind === 'Tuple') {
                const collaterals = data.fields.find(
                    (f) => f.field_name === 'collaterals'
                )
                const loans = data.fields.find((f) => f.field_name === 'loans')
                if (
                    collaterals &&
                    'entries' in collaterals &&
                    collaterals.entries.length &&
                    'value' in collaterals.entries[0].value
                ) {
                    const poolUnitXrdAmount = collaterals.entries[0].value
                        .value as string

                    const ratio = rootFinancePoolState.states.find(
                        (s) =>
                            s.address ===
                            'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
                    )?.unit_to_asset_ratio

                    if (ratio) {
                        underlyingXrdAmount = new Decimal(
                            poolUnitXrdAmount
                        ).div(new Decimal(ratio))
                        currentValue = currentValue.add(underlyingXrdAmount)
                    }
                }
                if (
                    loans &&
                    'entries' in loans &&
                    loans.entries.length &&
                    'value' in loans.entries[0].value
                ) {
                    const usdPoolUnitBorrowed = loans.entries[0].value
                        .value as string

                    const ratio = rootFinancePoolState.states.find(
                        (s) =>
                            s.address ===
                            'resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf'
                    )?.unit_to_asset_ratio

                    if (ratio) {
                        underlyingUsdAmount = new Decimal(
                            usdPoolUnitBorrowed
                        ).div(ratio)
                        currentValue = currentValue.minus(
                            underlyingUsdAmount.times(
                                tokenPrices[
                                    'resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf'
                                ].tokenPriceXRD
                            )
                        )
                    }
                }
            }
            closeManifest = CLOSE_STRATEGY_MANIFEST.replaceAll(
                '{account}',
                address
            )
                .replaceAll('{surgeLpAmount}', surgeLp.balance_change)
                .replaceAll('{rootNftId}', rootNft.added[0])
                .replaceAll(
                    '{lendAmount}',
                    underlyingXrdAmount.toDecimalPlaces(18).toString()
                )
        }

        if (xrdChange) {
            investedAmount = new Decimal(Math.abs(+xrdChange.balance_change))
        }

        const outAsset = tx.balance_changes?.fungible_balance_changes.find(
            (bc) =>
                bc.resource_address !==
                    'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd' &&
                bc.entity_address.startsWith('account_rdx')
        )

        if (outAsset) {
            currentValue = currentValue.add(
                await getAssetOutStrategyValue(outAsset, address)
            )
        }

        if (
            txs.find(
                (tx) =>
                    CLOSE_POSITION_SURGE_LP_STRATEGY_MANIFEST.every(
                        (method) =>
                            tx.manifest_instructions?.includes(method) || ''
                    ) &&
                    tx.manifest_instructions?.includes(rootNft?.added[0] || '')
            )
        ) {
            investedAmount = new Decimal(0)
        }

        return {
            currentValueXrd: currentValue,
            currentValueUsd: currentValue.times(
                new Decimal(
                    tokenPrices[
                        'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
                    ].tokenPriceUSD
                )
            ),
            investedAmountXrd: investedAmount,
            investedAmountUsd: investedAmount.times(
                new Decimal(
                    tokenPrices[
                        'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
                    ].tokenPriceUSD
                )
            ),
            closeManifest,
        }
    }
    return null
}

export async function getAccountLPPortfolio(address: string) {
    const [fungibleLps, nftLps, tokenPrices, liquidityPoolTxs] =
        await Promise.all([
            gatewayApiEzMode.state.getComponentFungibleBalances(address),
            gatewayApiEzMode.state.getComponentNonFungibleBalances(address),
            tokensRequest(),
            getAllAddLiquidityTxs(address),
        ])

    const lps: Record<
        string,
        {
            type: 'defiplaza' | 'ociswap' | 'ociswap_v2'
            balance?: string
            nftInfo?: {
                nfts: NftInfo[]
                component: string
                left_token: string
                right_token: string
            }
        }
    > = {}

    fungibleLps.forEach((token) => {
        if (+token.balance > 0) {
            if (
                token.resourceInfo.metadata.name?.match(
                    /Defiplaza (.+) Quote/
                ) ||
                token.resourceInfo.metadata.name?.match(/Defiplaza (.+) Base/)
            ) {
                lps[token.resourceInfo.resourceAddress] = {
                    type: 'defiplaza',
                    balance: token.balance,
                }
            } else if (
                token.resourceInfo.metadata.name?.startsWith('Ociswap LP')
            ) {
                lps[token.resourceInfo.resourceAddress] = {
                    type: 'ociswap',
                    balance: token.balance,
                }
            }
        }
    })

    for (const token of nftLps) {
        if (token.nftBalance.length) {
            if (token.resourceInfo.metadata.name?.startsWith('Ociswap LP')) {
                const split = token.resourceInfo.metadata.infoUrl?.split(
                    '/'
                ) as string[]
                const pair = await gatewayApiEzMode.state.getComponentInfo(
                    split[split.length - 1]
                )
                const { x_address, y_address } =
                    pair.metadata.metadataExtractor.getMetadataValuesBatch({
                        x_address: 'GlobalAddress',
                        y_address: 'GlobalAddress',
                    }) as { x_address: string; y_address: string }

                lps[token.resourceInfo.resourceAddress] = {
                    type: 'ociswap_v2',
                    nftInfo: {
                        nfts: token.nftBalance,
                        component: split[split.length - 1],
                        left_token: x_address,
                        right_token: y_address,
                    },
                }
            }
        }
    }

    const strategyTxs = liquidityPoolTxs.filter((tx) => tx.strategy)

    const rootFinancePoolState = await getRootFinancePoolState()

    const portfolioPnL: PoolPortfolioItem[] = (
        await Promise.all([
            ...Object.entries(lps).map(async ([lpAddress, lpInfo]) => {
                const underlyingTokens = await getLPInfo(lpAddress, lpInfo)
                if (!underlyingTokens) return null

                const currentValue = calculateCurrentValue(
                    underlyingTokens,
                    tokenPrices
                )
                const investedAmount = liquidityPoolTxs
                    .filter((tx) => tx.liquidity !== undefined)
                    .reduce(
                        (total, tx) =>
                            total.plus(
                                processLPTransaction(lpAddress, tx, tokenPrices)
                            ),
                        new Decimal(0)
                    )

                const pnlAmount = currentValue.minus(investedAmount)
                const pnlPercent = investedAmount.isZero()
                    ? '0'
                    : pnlAmount.div(investedAmount).times(100).toFixed(20)

                console.log(currentValue, investedAmount, lpInfo)

                return {
                    poolName: PAIR_NAME_CACHE[lpAddress]?.name,
                    leftAlt: PAIR_NAME_CACHE[lpAddress]?.left_alt,
                    rightAlt: PAIR_NAME_CACHE[lpAddress]?.right_alt,
                    leftIcon: PAIR_NAME_CACHE[lpAddress]?.left_icon,
                    rightIcon: PAIR_NAME_CACHE[lpAddress]?.right_icon,
                    provider: PAIR_NAME_CACHE[lpAddress]?.provider,
                    invested: investedAmount.toFixed(),
                    currentValue: currentValue.toFixed(),
                    investedXrd: investedAmount.div(
                        new Decimal(
                            tokenPrices[
                                'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
                            ].tokenPriceUSD
                        )
                    ),
                    currentValueXrd: currentValue.div(
                        tokenPrices[
                            'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
                        ].tokenPriceUSD
                    ),
                    pnl: pnlAmount.toFixed(),
                    pnlPercentage: pnlPercent,
                } as PoolPortfolioItem
            }),
            ...strategyTxs.map(async (tx, _, txs) => {
                if (!rootFinancePoolState) {
                    return
                }

                const strategyTx = await processStrategyTransaction(
                    tx,
                    tokenPrices,
                    address,
                    rootFinancePoolState,
                    txs
                )

                if (!strategyTx) return null

                const {
                    investedAmountXrd,
                    investedAmountUsd,
                    currentValueXrd,
                    currentValueUsd,
                    closeManifest,
                } = strategyTx

                const pnlAmount = currentValueUsd.minus(investedAmountUsd)
                const pnlPercent = investedAmountUsd.isZero()
                    ? '0'
                    : pnlAmount.div(investedAmountUsd).times(100).toFixed(20)

                return {
                    poolName: `Root Finance Strategy (Epoch: ${tx.epoch})`,
                    leftAlt: '',
                    rightAlt: '',
                    leftIcon: 'https://assets.radixdlt.com/icons/icon-xrd.png',
                    rightIcon: 'https://app.rootfinance.xyz/favicon.ico',
                    provider: 'Root Finance, Surge',
                    invested: investedAmountUsd.toFixed(),
                    currentValue: currentValueUsd.toFixed(),
                    investedXrd: investedAmountXrd.toFixed(),
                    currentValueXrd: currentValueXrd.toFixed(),
                    pnl: pnlAmount.toFixed(),
                    pnlPercentage: pnlPercent,
                    strategy: true,
                    closeManifest,
                } as PoolPortfolioItem
            }),
        ])
    ).filter(Boolean) as PoolPortfolioItem[]

    return portfolioPnL.filter(
        (pool) =>
            pool &&
            ((+pool.invested || 0) > 1 ||
                (pool.strategy &&
                    +pool.invested != 0 &&
                    +pool.currentValue != 0))
    )
}
