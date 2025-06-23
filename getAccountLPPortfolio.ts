import type {
    NftInfo,
    ResourceInfo,
} from '@calamari-radix/gateway-ez-mode/dist/types'
import Decimal from 'decimal.js'
import {
    BOOSTED_POOLS_CACHE,
    gatewayApi,
    gatewayApiEzMode,
    PAIR_NAME_CACHE,
} from '.'
import {
    CLOSE_POSITION_SURGE_LP_STRATEGY_MANIFEST,
    getAllAddLiquidityTxs,
    OPEN_POSITION_LP_POOL_STRATEGY_MANIFEST,
    OPEN_POSITION_SURGE_LP_STRATEGY_MANIFEST,
    type EnhancedTransactionInfo,
} from './getAllAddLiquidityTxs'
import { tokensRequest, type TokenInfo } from './src/astrolescent'
import {
    closeDefiplazaLpPosition,
    closeDefiplazaLpValue,
    defiplazaLpInfo,
    getVolumeAndTokenMetadata,
    removeDefiplazaLiquidity,
    type DefiPlazaLPInfo,
} from './src/defiplaza'
import {
    closeOciswapLpPosition,
    closeOciswapLpValue,
    getOciswapLpInfo,
    getOciswapSwapPreview,
    getOciswapTokenInfo,
    removeOciswapLiquidity,
    type OciswapLPInfo,
} from './src/ociswap'
import { s } from '@calamari-radix/gateway-ez-mode'
import {
    TransactionStatus,
    type CommittedTransactionInfo,
    type TransactionFungibleBalanceChanges,
} from '@radixdlt/babylon-gateway-api-sdk'
import {
    getRootFinancePoolState,
    type RootFinancePoolStateResponse,
} from './src/rootFinance'
import {
    DFP2_RESOURCE_ADDRESS,
    XRD_RESOURCE_ADDRESS,
    XUSDC_RESOURCE_ADDRESS,
} from './src/resourceAddresses'
import { getRootMarketPrices } from './src/strategies'

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
    airdropToken?: string
}

export function isDefiplazaLPInfo(
    info: UnderlyingTokens
): info is DefiPlazaLPInfo {
    return info !== null && 'baseToken' in info && 'quoteToken' in info
}

export function isOciswapLPInfo(info: UnderlyingTokens): info is OciswapLPInfo {
    return (
        (info !== null && 'x_address' in info && 'y_address' in info) ||
        (info !== null && 'x_amount' in info && 'y_amount' in info)
    )
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
{withdrawLossAmount}
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
            nonce: Math.random() * 100000,
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

export interface LpInfo {
    type: 'defiplaza' | 'ociswap' | 'ociswap_v2'
    balance?: string
    nftInfo?: {
        nfts: NftInfo[]
        component: string
        left_token: string
        right_token: string
    }
}

async function getLPInfo(
    lpAddress: string,
    lpInfo: LpInfo | undefined
): Promise<UnderlyingTokens | undefined> {
    if (!lpInfo) {
        return
    }
    if (lpInfo.type === 'defiplaza' && lpInfo.balance) {
        return await defiplazaLpInfo(lpAddress, lpInfo.balance)
    } else if (
        lpInfo.type === 'ociswap' &&
        lpInfo.balance &&
        PAIR_NAME_CACHE[lpAddress]?.component
    ) {
        return await getOciswapLpInfo(
            PAIR_NAME_CACHE[lpAddress].component,
            lpInfo.balance
        )
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
    | DefiPlazaLPInfo
    | (OciswapLPInfo & { left_token: string; right_token: string })[]
    | null

function calculateCurrentValue(
    underlyingTokens: UnderlyingTokens,
    tokenPrices: Record<string, TokenInfo>,
    lpAddress?: string
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
            const pairDetails = PAIR_NAME_CACHE[lpAddress || '']
            const xAddress =
                pairDetails.left_token ?? underlyingTokens.x_address
            const yAddress =
                pairDetails.right_token ?? underlyingTokens.y_address
            const xValue = new Decimal(underlyingTokens.x_amount.token).times(
                tokenPrices[xAddress]?.tokenPriceUSD || 0
            )
            const yValue = new Decimal(underlyingTokens.y_amount.token).times(
                tokenPrices[yAddress]?.tokenPriceUSD || 0
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

export function mapLpType(lpMetatadata: ResourceInfo, balance: string) {
    if (
        lpMetatadata.metadata.name?.match(/Defiplaza (.+) Quote/) ||
        lpMetatadata.metadata.name?.match(/Defiplaza (.+) Base/)
    ) {
        return {
            type: 'defiplaza',
            balance,
        } as LpInfo
    } else if (lpMetatadata.metadata.name?.startsWith('Ociswap LP')) {
        return {
            type: 'ociswap',
            balance,
        } as LpInfo
    }
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
        let loanAmount = new Decimal(0)
        let loanCurrency = ''
        let borrowAmount = new Decimal(0)
        let borrowCurrency = ''

        const xrdChange = tx.balance_changes?.fungible_balance_changes.find(
            (bc) =>
                bc.resource_address === XRD_RESOURCE_ADDRESS &&
                bc.entity_address.startsWith('account_rdx')
        )

        const surgeLp = tx.balance_changes?.fungible_balance_changes.find(
            (bc) =>
                bc.resource_address !== XRD_RESOURCE_ADDRESS &&
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
                        (s) => s.address === XRD_RESOURCE_ADDRESS
                    )?.unit_to_asset_ratio

                    if (ratio) {
                        underlyingXrdAmount = new Decimal(
                            poolUnitXrdAmount
                        ).div(ratio)

                        loanAmount = underlyingXrdAmount
                        loanCurrency = 'XRD'

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
                        (s) => s.address === XUSDC_RESOURCE_ADDRESS
                    )?.unit_to_asset_ratio

                    if (ratio) {
                        underlyingUsdAmount = new Decimal(
                            usdPoolUnitBorrowed
                        ).div(ratio)

                        borrowAmount = underlyingUsdAmount
                        borrowCurrency = 'XUSDC'

                        currentValue = currentValue.minus(
                            underlyingUsdAmount.times(
                                tokenPrices[XUSDC_RESOURCE_ADDRESS]
                                    .tokenPriceXRD
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
                bc.resource_address !== XRD_RESOURCE_ADDRESS &&
                bc.entity_address.startsWith('account_rdx')
        )

        if (outAsset) {
            currentValue = currentValue.add(
                await getAssetOutStrategyValue(outAsset, address)
            )
        }

        closeManifest = closeManifest.replace(
            '{withdrawLossAmount}',
            currentValue.lessThan(investedAmount)
                ? `CALL_METHOD Address("${address}")
"withdraw"
Address("${XUSDC_RESOURCE_ADDRESS}")
Decimal("${investedAmount.minus(currentValue).div(tokenPrices[XUSDC_RESOURCE_ADDRESS].tokenPriceXRD).mul(1.05).toFixed(6)}")
;`
                : ''
        )

        const preview = await previewTx(closeManifest)

        const value = preview.resource_changes?.find((rc) =>
            (
                rc as {
                    index: number
                    resource_changes: ResourceChange[]
                }
            ).resource_changes?.find(
                (rc) =>
                    rc.component_entity.entity_address.startsWith(
                        'account_rdx'
                    ) && rc.resource_address === XRD_RESOURCE_ADDRESS
            )
        ) as { resource_changes: ResourceChange[] } | undefined

        if (value) {
            currentValue = new Decimal(value.resource_changes[0].amount)
        }

        if (
            txs.find(
                (singleTx) =>
                    CLOSE_POSITION_SURGE_LP_STRATEGY_MANIFEST.every((method) =>
                        singleTx.manifest_instructions?.includes(method)
                    ) &&
                    singleTx.manifest_instructions?.includes(
                        rootNft?.added[0] || ''
                    ) &&
                    singleTx.transaction_status ===
                        TransactionStatus.CommittedSuccess
            )
        ) {
            investedAmount = new Decimal(0)
        }

        return {
            currentValueXrd: currentValue,
            currentValueUsd: currentValue.times(
                new Decimal(tokenPrices[XRD_RESOURCE_ADDRESS].tokenPriceUSD)
            ),
            investedAmountXrd: investedAmount,
            investedAmountUsd: investedAmount.times(
                new Decimal(tokenPrices[XRD_RESOURCE_ADDRESS].tokenPriceUSD)
            ),
            provider: `Root Finance, Surge`,
            tx: tx.intent_hash,
            loanAmount,
            loanCurrency,
            borrowAmount,
            borrowCurrency,
            closeManifest,
            poolName: 'Surge LP',
            leftAlt: 'SLP',
            leftIcon:
                'https://image-service.radixdlt.com/?imageSize=256x256&imageOrigin=https%3A%2F%2Fsurge.trade%2Fimages%2Fsurge_lp_token.png',
        }
    } else if (
        OPEN_POSITION_LP_POOL_STRATEGY_MANIFEST.every((method) =>
            tx.manifest_instructions?.includes(method)
        )
    ) {
        let investedAmount = new Decimal(0)
        let currentValue = new Decimal(0)
        let loanAmount = new Decimal(0)
        let loanCurrency = ''
        let borrowAmount = new Decimal(0)
        let borrowCurrency = ''
        let closeManifest: string = ''

        const xusdChange = tx.balance_changes?.fungible_balance_changes.find(
            (bc) =>
                bc.resource_address === XUSDC_RESOURCE_ADDRESS &&
                bc.entity_address.startsWith('account_rdx')
        )

        const defiplazaOrOciswapLp =
            tx.balance_changes?.fungible_balance_changes.find(
                (bc) =>
                    bc.resource_address !== XUSDC_RESOURCE_ADDRESS &&
                    bc.resource_address !== XRD_RESOURCE_ADDRESS &&
                    bc.resource_address != DFP2_RESOURCE_ADDRESS &&
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

        if (!rootNft || !defiplazaOrOciswapLp) {
            return null
        }
        const nft = await gatewayApi.state.getNonFungibleData(
            rootNft?.resource_address,
            rootNft.added
        )
        const data = nft[0].data?.programmatic_json

        const lpMetatadata = await gatewayApiEzMode.state.getResourceInfo(
            defiplazaOrOciswapLp.resource_address
        )

        const lpInfo = mapLpType(
            lpMetatadata,
            defiplazaOrOciswapLp.balance_change
        )

        const underlyingTokens = await getLPInfo(
            lpInfo?.type === 'ociswap'
                ? lpMetatadata.metadata.infoUrl?.split('/')[4] || ''
                : defiplazaOrOciswapLp.resource_address,
            lpInfo
        )

        if (underlyingTokens && lpMetatadata.metadata.infoUrl?.split('/')[4]) {
            const componentMetadata =
                await gatewayApiEzMode.state.getComponentInfo(
                    lpMetatadata.metadata.infoUrl?.split('/')[4]
                )

            const { x_address, y_address } =
                componentMetadata.metadata.metadataExtractor.getMetadataValuesBatch(
                    {
                        x_address: 'GlobalAddress',
                        y_address: 'GlobalAddress',
                    }
                ) as { x_address: string; y_address: string }

            ;(underlyingTokens as OciswapLPInfo).x_address = x_address
            ;(underlyingTokens as OciswapLPInfo).y_address = y_address
        }

        if (!underlyingTokens) {
            return null
        }

        const lpValue = calculateCurrentValue(underlyingTokens, tokenPrices)

        currentValue = currentValue.plus(
            lpValue.mul(tokenPrices[XUSDC_RESOURCE_ADDRESS].tokenPriceXRD)
        )

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
                const poolUnitUsdAmount = collaterals.entries[0].value
                    .value as string

                const ratio = rootFinancePoolState.states.find(
                    (s) => s.address === XUSDC_RESOURCE_ADDRESS
                )?.unit_to_asset_ratio

                if (ratio) {
                    underlyingXrdAmount = new Decimal(poolUnitUsdAmount).div(
                        ratio
                    )

                    loanAmount = new Decimal(underlyingXrdAmount)
                    loanCurrency = 'XUSDC'

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
                    (s) => s.address === XRD_RESOURCE_ADDRESS
                )?.unit_to_asset_ratio

                if (ratio) {
                    underlyingUsdAmount = new Decimal(usdPoolUnitBorrowed).div(
                        ratio
                    )

                    borrowAmount = new Decimal(underlyingUsdAmount)
                    borrowCurrency = 'XRD'

                    currentValue = currentValue.minus(
                        underlyingUsdAmount.times(
                            tokenPrices[XRD_RESOURCE_ADDRESS].tokenPriceUSD
                        )
                    )
                }
            }
        }

        if (xusdChange) {
            investedAmount = borrowAmount.times(
                tokenPrices[XRD_RESOURCE_ADDRESS].tokenPriceXRD
            )
        }

        const ociswapSellToken =
            'x_address' in underlyingTokens && 'y_address' in underlyingTokens
                ? underlyingTokens.x_address !== XRD_RESOURCE_ADDRESS
                    ? underlyingTokens.x_address
                    : underlyingTokens.y_address
                : undefined

        const tokenAmount =
            'x_address' in underlyingTokens && 'y_address' in underlyingTokens
                ? underlyingTokens.x_address !== XRD_RESOURCE_ADDRESS
                    ? underlyingTokens.x_amount.token
                    : underlyingTokens.y_amount.token
                : undefined

        const defiplazaSellToken =
            'baseToken' in underlyingTokens && 'quoteToken' in underlyingTokens
                ? underlyingTokens.baseToken
                : undefined

        if (ociswapSellToken && tokenAmount) {
            const swapPreview = await getOciswapSwapPreview(
                ociswapSellToken,
                tokenAmount,
                XRD_RESOURCE_ADDRESS,
                ''
            )

            if (swapPreview) {
                const valueManifest = closeOciswapLpValue({
                    nonXrd: ociswapSellToken,
                    lpAddress: defiplazaOrOciswapLp.resource_address,
                    lpAmount: defiplazaOrOciswapLp.balance_change,
                    lpComponent:
                        lpMetatadata.metadata.infoUrl?.split('/')[4] || '',
                    account: address,
                    swapComponent: swapPreview.swaps[0].pool_address,
                })

                const preview = await previewTx(valueManifest)

                const value = preview.resource_changes?.find((rc) =>
                    (
                        rc as {
                            index: number
                            resource_changes: ResourceChange[]
                        }
                    ).resource_changes?.find(
                        (rc) =>
                            +rc.component_entity.entity_address.startsWith(
                                'account_rdx'
                            ) && rc.resource_address === XRD_RESOURCE_ADDRESS
                    )
                ) as { resource_changes: ResourceChange[] } | undefined

                if (value) {
                    currentValue = new Decimal(value.resource_changes[0].amount)
                }

                closeManifest = closeOciswapLpPosition({
                    nonXrd: ociswapSellToken,
                    lpAddress: defiplazaOrOciswapLp.resource_address,
                    lpAmount: defiplazaOrOciswapLp.balance_change,
                    lpComponent:
                        lpMetatadata.metadata.infoUrl?.split('/')[4] || '',
                    account: address,
                    rootNftId: rootNft.added[0],
                    swapComponent: swapPreview.swaps[0].pool_address,
                    lendAmount: loanAmount.toFixed(18) || '0',
                    withdrawLossAmount: currentValue.lessThan(investedAmount)
                        ? investedAmount
                              .minus(currentValue)
                              .mul(1.2)
                              .toFixed(18)
                        : undefined,
                })
            }
        }

        if (defiplazaSellToken) {
            const dfpLpInfo =
                await getVolumeAndTokenMetadata(defiplazaSellToken)

            const isQuote =
                !!lpMetatadata.metadata.name?.match(/Defiplaza (.+) Quote/)

            if (dfpLpInfo) {
                const valueManifest = closeDefiplazaLpValue({
                    baseToken: defiplazaSellToken,
                    isQuote,
                    lpAddress: defiplazaOrOciswapLp.resource_address,
                    lpAmount: defiplazaOrOciswapLp.balance_change,
                    lpComponent: dfpLpInfo.component,
                    account: address,
                    swapComponent:
                        'component_rdx1cqy7sq3mxj2whhlqlryy05hzs96m0ajnv23e7j7vanmdwwlccnmz68',
                })

                const preview = await previewTx(valueManifest)

                const value = preview.resource_changes?.find((rc) =>
                    (
                        rc as {
                            index: number
                            resource_changes: ResourceChange[]
                        }
                    ).resource_changes?.find(
                        (rc) =>
                            +rc.amount > 0 &&
                            rc.resource_address === XRD_RESOURCE_ADDRESS
                    )
                ) as { resource_changes: ResourceChange[] } | undefined

                if (value) {
                    currentValue = new Decimal(value.resource_changes[0].amount)
                }

                closeManifest = closeDefiplazaLpPosition({
                    baseToken: defiplazaSellToken,
                    isQuote,
                    lpAddress: defiplazaOrOciswapLp.resource_address,
                    lpAmount: defiplazaOrOciswapLp.balance_change,
                    lpComponent: dfpLpInfo.component,
                    account: address,
                    rootNftId: rootNft.added[0],
                    swapComponent:
                        'component_rdx1cqy7sq3mxj2whhlqlryy05hzs96m0ajnv23e7j7vanmdwwlccnmz68',
                    lendAmount: underlyingXrdAmount
                        .toDecimalPlaces(18)
                        .toString(),
                    withdrawLossAmount: currentValue.lessThan(investedAmount)
                        ? investedAmount
                              .minus(currentValue)
                              .mul(1.2)
                              .toFixed(18)
                        : undefined,
                })
            }
        }

        if (
            txs.find(
                (tx) =>
                    CLOSE_POSITION_SURGE_LP_STRATEGY_MANIFEST.every(
                        (method) =>
                            tx.manifest_instructions?.includes(method) || ''
                    ) &&
                    tx.manifest_instructions?.includes(
                        rootNft?.added[0] || ''
                    ) &&
                    tx.transaction_status === TransactionStatus.CommittedSuccess
            )
        ) {
            investedAmount = new Decimal(0)
        }

        return {
            currentValueXrd: currentValue,
            currentValueUsd: currentValue.times(
                new Decimal(tokenPrices[XRD_RESOURCE_ADDRESS].tokenPriceUSD)
            ),
            investedAmountXrd: investedAmount,
            investedAmountUsd: investedAmount.times(
                new Decimal(tokenPrices[XRD_RESOURCE_ADDRESS].tokenPriceUSD)
            ),
            provider: `Root Finance, ${lpInfo?.type || ''}`,
            tx: tx.intent_hash,
            poolName:
                PAIR_NAME_CACHE[defiplazaOrOciswapLp.resource_address].name,
            leftAlt:
                PAIR_NAME_CACHE[defiplazaOrOciswapLp.resource_address].left_alt,
            rightAlt:
                PAIR_NAME_CACHE[defiplazaOrOciswapLp.resource_address]
                    .right_alt,
            leftIcon:
                PAIR_NAME_CACHE[defiplazaOrOciswapLp.resource_address]
                    .left_icon,
            rightIcon:
                PAIR_NAME_CACHE[defiplazaOrOciswapLp.resource_address]
                    .right_icon,
            loanAmount,
            loanCurrency,
            borrowCurrency,
            borrowAmount,
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

    const [rootFinancePoolState, rootPrices] = await Promise.all([
        getRootFinancePoolState(),
        getRootMarketPrices(),
    ])

    const portfolioPnL: PoolPortfolioItem[] = (
        await Promise.all([
            ...Object.entries(lps).map(async ([lpAddress, lpInfo]) => {
                const underlyingTokens = await getLPInfo(lpAddress, lpInfo)
                if (!underlyingTokens) return null

                let airdropToken = new Decimal(0)

                if (
                    BOOSTED_POOLS_CACHE[
                        PAIR_NAME_CACHE[lpAddress]?.component
                    ]?.docs?.includes('ilis-dao')
                ) {
                    const txs = liquidityPoolTxs.filter(
                        (l) => l.airdropToken === 'ilis'
                    )

                    const airdrops = txs
                        .map((tx) =>
                            tx.balance_changes?.fungible_balance_changes.find(
                                (fb) => fb.entity_address === address
                            )
                        )
                        .filter(Boolean) as TransactionFungibleBalanceChanges[]

                    airdropToken = airdrops.reduce(
                        (total, airdrop) => total.plus(airdrop.balance_change),
                        new Decimal(0)
                    )
                }

                const currentValue = calculateCurrentValue(
                    underlyingTokens,
                    tokenPrices,
                    lpAddress
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

                return {
                    poolName: PAIR_NAME_CACHE[lpAddress]?.name,
                    component: PAIR_NAME_CACHE[lpAddress]?.component,
                    leftAlt: PAIR_NAME_CACHE[lpAddress]?.left_alt,
                    rightAlt: PAIR_NAME_CACHE[lpAddress]?.right_alt,
                    leftIcon: PAIR_NAME_CACHE[lpAddress]?.left_icon,
                    rightIcon: PAIR_NAME_CACHE[lpAddress]?.right_icon,
                    provider: PAIR_NAME_CACHE[lpAddress]?.provider,
                    invested: investedAmount.toFixed(),
                    currentValue: currentValue.toFixed(),
                    investedXrd: investedAmount.div(
                        new Decimal(
                            tokenPrices[XRD_RESOURCE_ADDRESS].tokenPriceUSD
                        )
                    ),
                    currentValueXrd: currentValue.div(
                        tokenPrices[XRD_RESOURCE_ADDRESS].tokenPriceUSD
                    ),
                    pnl: pnlAmount.toFixed(),
                    pnlPercentage: pnlPercent,
                    bonusAirdrop: airdropToken.toFixed(18),
                    closeManifest:
                        lpInfo.type === 'defiplaza'
                            ? removeDefiplazaLiquidity({
                                  isQuote:
                                      PAIR_NAME_CACHE[lpAddress]?.type ===
                                      'quote',
                                  lpAddress,
                                  lpAmount: lpInfo.balance || '0',
                                  lpComponent:
                                      PAIR_NAME_CACHE[lpAddress].component,
                                  account: address,
                              })
                            : removeOciswapLiquidity({
                                  lpAddress,
                                  lpAmount: lpInfo.balance || '0',
                                  lpComponent:
                                      PAIR_NAME_CACHE[lpAddress].component,
                                  account: address,
                              }),
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
                    provider,
                    closeManifest,
                    tx: txid,
                    loanAmount,
                    loanCurrency,
                    borrowAmount,
                    borrowCurrency,
                    poolName,
                    leftAlt,
                    rightAlt,
                    leftIcon,
                    rightIcon,
                } = strategyTx

                const pnlAmount = currentValueUsd.minus(investedAmountUsd)
                const pnlPercent = investedAmountUsd.isZero()
                    ? '0'
                    : pnlAmount.div(investedAmountUsd).times(100).toFixed(20)

                return {
                    poolName: `${poolName} Root Finance Strategy`,
                    leftIcon,
                    rightIcon:
                        rightIcon || 'https://app.rootfinance.xyz/favicon.ico',
                    provider,
                    invested: investedAmountUsd.toFixed(),
                    currentValue: currentValueUsd.toFixed(),
                    investedXrd: investedAmountXrd.toFixed(),
                    currentValueXrd: currentValueXrd.toFixed(),
                    pnl: pnlAmount.toFixed(),
                    pnlPercentage: pnlPercent,
                    strategy: true,
                    tx: txid,
                    closeManifest,
                    loanAmount,
                    loanCurrency,
                    borrowCurrency,
                    borrowAmount,
                    leftAlt,
                    rightAlt,
                } as PoolPortfolioItem
            }),
        ])
    ).filter(Boolean) as PoolPortfolioItem[]

    return portfolioPnL.filter(
        (pool) =>
            pool &&
            ((+pool.invested || 0) > 0 ||
                (pool.strategy &&
                    +pool.invested != 0 &&
                    +pool.currentValue != 0))
    )
}
