import Decimal from 'decimal.js'
import {
    getVolumeAndTokenMetadata,
    xrdToDfp2AmountManifest,
    buyFromDfpToken,
    createAddDefiplazaCalmLiquidityManifest,
    singleSidedXrdToDfp2AmountManifest,
} from './defiplaza'
import {
    getOciswapPoolDetails,
    getOciswapSwapPreview,
    buyFromOciToken,
} from './ociswap'
import { createAddBasicOrFlexLiquidityManifest } from './ociswapBasicFlexPool'
import { createAddLiquidityManifest } from './ociswapPrecisionPool'
import { getRootMarketPrices } from './strategies'
import {
    XRD_RESOURCE_ADDRESS,
    XUSDC_RESOURCE_ADDRESS,
    SUSD_RESOURCE_ADDRESS,
    DFP2_RESOURCE_ADDRESS,
} from './resourceAddresses'
import { getRootMarketStats } from './rootFinance'
import { previewTx } from './previewTx'
import type { ResourceChange } from './positionProcessor'

export async function handleOciswapStrategy(
    manifest: string,
    account: string,
    component: string,
    borrowXrdAmount: string,
    usdAmount: string,
    minPercentage: number | null,
    maxPercentage: number | null,
    xTokenAmount: string | null,
    yTokenAmount: string | null
) {
    const poolDetails = await getOciswapPoolDetails(component)

    if (!poolDetails) {
        return ''
    }

    if (
        poolDetails.pool_type === 'precision' ||
        poolDetails.pool_type === 'basic' ||
        poolDetails.pool_type === 'flex'
    ) {
        const totalBorrowedXrd = new Decimal(borrowXrdAmount)

        const shouldFlip = poolDetails.x.token.address === XRD_RESOURCE_ADDRESS

        const ratio = shouldFlip
            ? new Decimal(poolDetails.y.liquidity.xrd.now).div(
                  new Decimal(poolDetails.y.liquidity.xrd.now).plus(
                      poolDetails.x.liquidity.xrd.now
                  )
              )
            : new Decimal(poolDetails.x.liquidity.xrd.now).div(
                  new Decimal(poolDetails.y.liquidity.xrd.now).plus(
                      poolDetails.x.liquidity.xrd.now
                  )
              )

        const xrdForX = totalBorrowedXrd.mul(ratio)

        let addLiquidityManifest

        if (poolDetails.pool_type === 'precision') {
            if (!minPercentage || !maxPercentage) {
                return ''
            }

            addLiquidityManifest = createAddLiquidityManifest(
                poolDetails.address,
                poolDetails.x.price.token.now,
                minPercentage,
                maxPercentage,
                60
            )
        } else {
            addLiquidityManifest = createAddBasicOrFlexLiquidityManifest(
                poolDetails.address
            )
        }

        if (poolDetails.pool_type === 'precision' && !xTokenAmount) {
            return ''
        }

        const swapPreview = await getOciswapSwapPreview(
            shouldFlip
                ? poolDetails.x.token.address
                : poolDetails.y.token.address,
            '',
            shouldFlip
                ? poolDetails.y.token.address
                : poolDetails.x.token.address,
            poolDetails.pool_type === 'precision'
                ? xTokenAmount || '0'
                : shouldFlip
                  ? xrdForX.mul(poolDetails.y.price.token.now).toFixed(18)
                  : xrdForX.mul(poolDetails.x.price.token.now).toFixed(18)
        )

        if (!swapPreview) {
            return ''
        }

        const yTakeManifest = `TAKE_ALL_FROM_WORKTOP
Address("${XRD_RESOURCE_ADDRESS}")
Bucket("xrdSide");`

        const finalManifest = manifest
            .replaceAll('{account}', account)
            .replaceAll('{component}', component)
            .replaceAll('{yTakeManifest}', yTakeManifest)
            .replaceAll(
                '{buyManifest}',
                buyFromOciToken(swapPreview.swaps[0].pool_address)
            )
            .replaceAll('{dexComponent}', component)
            .replaceAll('{xusdcAmount}', usdAmount)
            .replaceAll('{borrowXrdAmount}', borrowXrdAmount)
            .replaceAll(
                '{buyToken}',
                shouldFlip
                    ? poolDetails.y.token.address
                    : poolDetails.x.token.address
            )
            .replaceAll('{buyTokenAmount}', swapPreview.input_amount.xrd)
            .replaceAll(
                '{addLiquidityManifest}',
                typeof addLiquidityManifest === 'string'
                    ? addLiquidityManifest
                    : addLiquidityManifest.manifest
            )
            .replaceAll(
                '{repayRemainingManifest}',
                `CALL_METHOD Address("${account}") "deposit_batch" Array<Bucket>(Bucket("nft"));`
            )
            .replaceAll('\n', ' ')

        const remaining = await getRemainingXrd(finalManifest)

        return manifest
            .replaceAll('{account}', account)
            .replaceAll('{component}', component)
            .replaceAll('{yTakeManifest}', yTakeManifest)
            .replaceAll(
                '{buyManifest}',
                buyFromOciToken(swapPreview.swaps[0].pool_address)
            )
            .replaceAll('{dexComponent}', component)
            .replaceAll('{xusdcAmount}', usdAmount)
            .replaceAll('{borrowXrdAmount}', borrowXrdAmount)
            .replaceAll(
                '{buyToken}',
                shouldFlip
                    ? poolDetails.y.token.address
                    : poolDetails.x.token.address
            )
            .replaceAll('{buyTokenAmount}', xrdForX.toFixed(18))
            .replaceAll(
                '{addLiquidityManifest}',
                typeof addLiquidityManifest === 'string'
                    ? addLiquidityManifest
                    : addLiquidityManifest.manifest
            )
            .replaceAll(
                '{repayRemainingManifest}',
                +remaining > 0
                    ? getRepayLoanManifest(account)
                    : `CALL_METHOD Address("${account}") "deposit_batch" Array<Bucket>(Bucket("nft"));`
            )
            .replaceAll('\n', ' ')
            .replaceAll('  ', ' ')
    }
    return ''
}

export async function handleDefiplazaStrategy(
    manifest: string,
    account: string,
    component: string,
    usdAmount: string,
    borrowXrdAmount: string,
    buyToken: string,
    isSingleSided?: boolean
) {
    const poolDetails = await getVolumeAndTokenMetadata(buyToken)

    if (!poolDetails) {
        return ''
    }

    if (isSingleSided) {
        const dfp2AmountManifest = xrdToDfp2AmountManifest(
            'component_rdx1cqy7sq3mxj2whhlqlryy05hzs96m0ajnv23e7j7vanmdwwlccnmz68'
        )
            .replaceAll('{account}', account)
            .replaceAll('{component}', component)
            .replaceAll(
                '{buyManifest}',
                buyFromDfpToken(poolDetails.dexComponent)
            )
            .replaceAll('{xusdcAmount}', usdAmount)
            .replaceAll('{borrowXrdAmount}', borrowXrdAmount)
            .replaceAll('{buyToken}', buyToken)
            .replaceAll('\n', ' ')

        const dfp2Borrowed = await getDfp2Borrowable(dfp2AmountManifest)

        if (poolDetails?.single.side === 'base') {
            return singleSidedXrdToDfp2AmountManifest({
                account,
                dexAddress: poolDetails.dexComponent,
                poolComponentAddress: poolDetails.component,
                tokenSwap: buyToken,
                borrowAmount: dfp2Borrowed,
                usdAmount,
            })
        } else {
            return singleSidedXrdToDfp2AmountManifest({
                account,
                dexAddress: poolDetails.dexComponent,
                poolComponentAddress: poolDetails.component,
                borrowAmount: dfp2Borrowed,
                usdAmount,
            })
        }
    }

    if (poolDetails.right_token === DFP2_RESOURCE_ADDRESS) {
        const dfp2AmountManifest = xrdToDfp2AmountManifest(
            'component_rdx1cqy7sq3mxj2whhlqlryy05hzs96m0ajnv23e7j7vanmdwwlccnmz68'
        )
            .replaceAll('{account}', account)
            .replaceAll('{component}', component)
            .replaceAll(
                '{buyManifest}',
                buyFromDfpToken(poolDetails.dexComponent)
            )
            .replaceAll('{xusdcAmount}', usdAmount)
            .replaceAll('{borrowXrdAmount}', borrowXrdAmount)
            .replaceAll('{buyToken}', buyToken)
            .replaceAll('\n', ' ')

        const dfp2Borrowed = await getDfp2Borrowable(dfp2AmountManifest)

        const { basePoolState, quotePoolState } = poolDetails

        const basePrice = new Decimal(poolDetails.last_price)

        const xAmount =
            basePoolState.vaults[0].amount > 0 &&
            basePoolState.vaults[1].amount > 0
                ? new Decimal(basePoolState.vaults[0].amount).mul(basePrice)
                : new Decimal(quotePoolState.vaults[1].amount).mul(basePrice)

        const yAmount =
            basePoolState.vaults[0].amount > 0 &&
            basePoolState.vaults[1].amount > 0
                ? new Decimal(basePoolState.vaults[1].amount).lessThanOrEqualTo(
                      quotePoolState.vaults[0].amount
                  )
                    ? new Decimal(basePoolState.vaults[1].amount).plus(
                          quotePoolState.vaults[0].amount
                      )
                    : new Decimal(basePoolState.vaults[1].amount)
                : new Decimal(quotePoolState.vaults[0].amount)

        const xRatio = xAmount.div(xAmount.plus(yAmount))

        const totalBorrowedDfp2 = new Decimal(dfp2Borrowed)

        const dfp2ForBase = totalBorrowedDfp2
            .mul(xRatio)
            .minus(totalBorrowedDfp2.mul(xRatio).mul(0.02))

        const addLiquidityManifest = createAddDefiplazaCalmLiquidityManifest(
            poolDetails.component,
            poolDetails.pairState.shortage
        )

        const yTakeManifest = `TAKE_ALL_FROM_WORKTOP
                            Address("${poolDetails.right_token}")
                            Bucket("xrdSide");`

        console.log('xAmount ', xAmount)
        console.log('xRatio ', xRatio)
        console.log('dfp2forbase ', dfp2ForBase)
        console.log('remaining ', totalBorrowedDfp2.minus(dfp2ForBase))

        const m = manifest
            .replaceAll('{account}', account)
            .replaceAll('{component}', component)
            .replaceAll(
                '{buyManifest}',
                poolDetails.right_token !== DFP2_RESOURCE_ADDRESS
                    ? ''
                    : buyFromDfpToken(poolDetails.dexComponent)
            )
            .replaceAll('{xusdcAmount}', usdAmount)
            .replaceAll('{borrowXrdAmount}', borrowXrdAmount)
            .replaceAll('{buyTokenAmount}', dfp2ForBase.toFixed(18))
            .replaceAll('{yTakeManifest}', yTakeManifest)
            .replaceAll('{addLiquidityManifest}', addLiquidityManifest)
            .replaceAll('{buyToken}', buyToken)
            .replaceAll(
                '{repayRemainingManifest}',
                `CALL_METHOD
                                Address("${account}")
                                "deposit_batch"
                                Array<Bucket>(
                                    Bucket("nft")
                                );`
            )
            .replaceAll('\n', ' ')

        return m
    }
    return ''
}

export const STRATEGY_MANIFEST: Record<
    string,
    {
        manifest: string
        poolProvider?: string
        generateManifest: (
            id: string,
            manifest: string,
            account: string,
            usdAmount: string,
            ltv: number | undefined,
            buyToken: string | null,
            component: string | null,
            leftPercentage: number | null,
            rightPercentage: number | null,
            xTokenAmount: string | null,
            yTokenAmount: string | null
        ) => Promise<string>
    }
> = {
    'root-surge': {
        manifest: `CALL_METHOD
Address("component_rdx1cqjzzku4rrkz3zhm8hldn55evpgmxx9rpq9t98qtnj0asdg88f9yj6")
"charge_strategy_royalty"
;
CALL_METHOD
  Address("{account}")
  "withdraw"
  Address("${XRD_RESOURCE_ADDRESS}")
  Decimal("{xrdAmount}")
;
TAKE_ALL_FROM_WORKTOP
  Address("${XRD_RESOURCE_ADDRESS}")
  Bucket("bucket_0")
;
CALL_METHOD
  Address("component_rdx1crwusgp2uy9qkzje9cqj6pdpx84y94ss8pe7vehge3dg54evu29wtq")
  "contribute"
  Bucket("bucket_0")
;
TAKE_ALL_FROM_WORKTOP
  Address("resource_rdx1t5ey8s5nq99p5ae7jxp4ez5xljn7gtjgesr0dartq9aeys2tfwqg9w")
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
      Address("${XUSDC_RESOURCE_ADDRESS}"),
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
  Address("resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf")
  Bucket("usdc")
;
CALL_METHOD
  Address("component_rdx1czqcwcqyv69y9s6xfk443250ruragewa0vj06u5ke04elcu9kae92n")
  "wrap"
  Bucket("usdc")
;
TAKE_ALL_FROM_WORKTOP
  Address("${SUSD_RESOURCE_ADDRESS}")
  Bucket("susdc")
;
CALL_METHOD
  Address("component_rdx1cp92uemllvxuewz93s5h8f36plsmrysssjjl02vve3zvsdlyxhmne7")
  "add_liquidity"
  Bucket("susdc")
;
CALL_METHOD
  Address("{account}")
  "deposit_batch"
  Expression("ENTIRE_WORKTOP")
;`,
        generateManifest: async (
            _id: string,
            manifest: string,
            account: string,
            xrdAmount: string,
            ltv: number | undefined
        ) => {
            const [marketPrices, stats] = await Promise.all([
                getRootMarketPrices().then((data) =>
                    data.prices.find(
                        (price) => price.assetName === XRD_RESOURCE_ADDRESS
                    )
                ),
                getRootMarketStats(),
            ])

            if (!stats) {
                return ''
            }

            const borrowUsdcLimit = ltv || +stats.assets.radix.optimalUsage

            const xrdToUsd = (marketPrices?.assetPrice || 0) * +xrdAmount

            const borrowXrdAmount = (
                xrdToUsd -
                borrowUsdcLimit * xrdToUsd
            ).toFixed(6)

            return manifest
                .replaceAll('{account}', account)
                .replaceAll('{xrdAmount}', xrdAmount)
                .replaceAll('{borrowXrdAmount}', borrowXrdAmount)
                .replaceAll('\n', ' ')
        },
    },
    'xusdc-lp': {
        manifest: `CALL_METHOD
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
{buyManifest}
TAKE_ALL_FROM_WORKTOP
  Address("{buyToken}")
  Bucket("buyToken")
;
{yTakeManifest}
{addLiquidityManifest}
{repayRemainingManifest}
CALL_METHOD
  Address("{account}")
  "deposit_batch"
  Expression("ENTIRE_WORKTOP")
;`,

        generateManifest: async (
            id: string,
            manifest: string,
            account: string,
            usdAmount: string,
            ltv: number | undefined,
            buyToken: string | null,
            component: string | null,
            minPercentage: number | null,
            maxPercentage: number | null,
            xTokenAmount: string | null,
            yTokenAmount: string | null
        ) => {
            if (!buyToken || !component) {
                return ''
            }

            const [marketPrices, stats] = await Promise.all([
                getRootMarketPrices().then((data) =>
                    data.prices.find(
                        (price) => price.assetName === XRD_RESOURCE_ADDRESS
                    )
                ),
                getRootMarketStats(),
            ])

            if (!stats) {
                return ''
            }

            const borrowUsdcLimit =
                ltv || +stats.assets['usd-coin'].optimalUsage

            const xrdPrice = marketPrices?.assetPrice || 0
            const usdcAmount = new Decimal(usdAmount)
            const ltvDecimal = new Decimal(borrowUsdcLimit)

            // Calculate the XRD equivalent of the USDC amount
            const xrdEquivalent = usdcAmount.div(xrdPrice)

            // Calculate the amount of XRD to borrow based on the LTV
            const borrowXrdAmount = xrdEquivalent.mul(ltvDecimal).toFixed(18)

            if (STRATEGY_MANIFEST[id].poolProvider === 'Ociswap') {
                return await handleOciswapStrategy(
                    manifest,
                    account,
                    component,
                    borrowXrdAmount,
                    usdAmount,
                    minPercentage,
                    maxPercentage,
                    xTokenAmount,
                    yTokenAmount
                )
            } else if (STRATEGY_MANIFEST[id].poolProvider === 'Defiplaza') {
                return await handleDefiplazaStrategy(
                    manifest,
                    account,
                    component,
                    usdAmount,
                    borrowXrdAmount,
                    buyToken,
                    /\(.+\)$/.test(id)
                )
            }
            return ''
        },
    },
}
async function getDfp2Borrowable(dfp2AmountManifest: string) {
    const preview = await previewTx(dfp2AmountManifest)

    const value = preview.resource_changes?.filter((rc) =>
        (
            rc as {
                index: number
                resource_changes: ResourceChange[]
            }
        ).resource_changes?.find(
            (rc) =>
                rc.resource_address ===
                'resource_rdx1t5ywq4c6nd2lxkemkv4uzt8v7x7smjcguzq5sgafwtasa6luq7fclq'
        )
    ) as { resource_changes: ResourceChange[] }[]

    const dfp2Borrowed = value
        .filter((rc) =>
            rc.resource_changes.find((rcc) =>
                rcc.component_entity?.entity_address?.startsWith('account_rdx')
            )
        )
        .map((rc) => rc.resource_changes)[0][0].amount
    return dfp2Borrowed
}

async function getRemainingXrd(manifest: string) {
    const preview = await previewTx(manifest)

    const value = preview.resource_changes?.filter((rc) =>
        (
            rc as {
                index: number
                resource_changes: ResourceChange[]
            }
        ).resource_changes?.find(
            (rc) => rc.resource_address === XRD_RESOURCE_ADDRESS
        )
    ) as { resource_changes: ResourceChange[] }[]

    const xrdRemaining = value
        ?.filter((rc) =>
            rc.resource_changes.find((rcc) =>
                rcc.component_entity?.entity_address?.startsWith('account_rdx')
            )
        )
        .map((rc) => rc.resource_changes)

    if (
        !xrdRemaining.length ||
        !xrdRemaining[0].length ||
        !xrdRemaining[0][0]?.amount
    ) {
        return '0'
    }

    return xrdRemaining[0][0].amount ?? '0'
}

function getRepayLoanManifest(account: string) {
    return `TAKE_ALL_FROM_WORKTOP
Address("${XRD_RESOURCE_ADDRESS}")
Bucket("remaining_xrd")
;
CREATE_PROOF_FROM_BUCKET_OF_ALL
Bucket("nft")
Proof("root_nft")
;
CALL_METHOD
Address("component_rdx1cz8daq5nwmtdju4hj5rxud0ta26wf90sdk5r4nj9fqjcde5eht8p0f")
"swap"
Bucket("remaining_xrd")
;
TAKE_ALL_FROM_WORKTOP
Address("${XUSDC_RESOURCE_ADDRESS}")
Bucket("remaining_xusdc")
;
CALL_METHOD
Address("component_rdx1crwusgp2uy9qkzje9cqj6pdpx84y94ss8pe7vehge3dg54evu29wtq")
"repay"
Proof("root_nft")
Enum<0u8>( )
Array<Bucket>(
Bucket("remaining_xusdc")
)
;
CALL_METHOD
Address("${account}")
"deposit_batch"
Array<Bucket>(
Bucket("nft")
);
CALL_METHOD
Address("${account}")
"deposit_batch"
Expression("ENTIRE_WORKTOP")
;
`
}
