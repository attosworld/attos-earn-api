import Decimal from 'decimal.js'
import { sleep } from 'bun'
import type {
    MetadataGlobalAddressValue,
    ProgrammaticScryptoSborValue,
    StateEntityDetailsResponseComponentDetails,
} from '@radixdlt/babylon-gateway-api-sdk'
import s from '@calamari-radix/sbor-ez-mode'
import type { GatewayEzMode } from '@calamari-radix/gateway-ez-mode'
import { doesKeyExistInS3, getFromS3, uploadToS3 } from './s3-client'
import { XRD_RESOURCE_ADDRESS } from './resourceAddresses'
import { gatewayApiEzMode } from '..'

const MAX_TICK = 887272
const MIN_TICK = -MAX_TICK

/**
 * Converts a price to its corresponding tick index using Decimal.js for precision
 * @param price - The price to convert
 * @returns The tick index (integer)
 */
export function priceToTick(price: number | string | Decimal): number {
    const decimalPrice = new Decimal(price)
    const logBase = new Decimal(1.0001)
    const result = decimalPrice.ln().div(logBase.ln()).floor()
    return result.toNumber()
}

/**
 * Converts a tick index to its corresponding price using Decimal.js for precision
 * @param tick - The tick index
 * @returns The price as a Decimal
 */
export function tickToPrice(tick: Decimal): Decimal {
    const decimalTick = new Decimal(tick)
    const base = new Decimal(1.0001)
    return base.pow(decimalTick)
}

/**
 * Aligns a tick to the nearest tick spacing
 * @param tick - The tick to align
 * @param tickSpacing - The tick spacing (e.g., 60)
 * @returns The aligned tick
 */
export function alignTickToSpacing(tick: number, tickSpacing: number): Decimal {
    return new Decimal(
        new Decimal(tick).div(tickSpacing).times(tickSpacing)
    ).floor()
}

/**
 * Calculates price range bounds based on percentage changes from current price
 * @param currentPrice - The current price
 * @param lowerPricePercentage - The percentage for lower bound (e.g., -50 for 50% below)
 * @param upperPricePercentage - The percentage for upper bound (e.g., 100 for 100% above)
 * @returns The lower and upper price bounds as Decimals
 */
export function calculatePriceBounds(
    currentPrice: number | string | Decimal,
    lowerPricePercentage: number,
    upperPricePercentage: number
): { lowerPrice: Decimal; upperPrice: Decimal } {
    const decimalPrice = new Decimal(currentPrice)
    const lowerPrice = decimalPrice.mul(
        new Decimal(1).plus(new Decimal(lowerPricePercentage).div(100))
    )
    const upperPrice = decimalPrice.mul(
        new Decimal(1).plus(new Decimal(upperPricePercentage).div(100))
    )
    return { lowerPrice, upperPrice }
}

/**
 * Calculates tick bounds for a concentrated liquidity position
 * @param currentPrice - The current price
 * @param lowerPricePercentage - The percentage for lower bound (e.g., -50 for 50% below)
 * @param upperPricePercentage - The percentage for upper bound (e.g., 100 for 100% above)
 * @param tickSpacing - The tick spacing of the pool
 * @returns The lower and upper tick bounds, aligned to tick spacing, and their corresponding prices
 */
export function calculateTickBounds(
    currentPrice: number | string | Decimal,
    lowerPricePercentage: number,
    upperPricePercentage: number,
    tickSpacing: number
): {
    lowerTick: Decimal
    upperTick: Decimal
    lowerPrice: Decimal
    upperPrice: Decimal
} {
    const { lowerPrice, upperPrice } = calculatePriceBounds(
        currentPrice,
        lowerPricePercentage,
        upperPricePercentage
    )

    const lowerTick = priceToTick(lowerPrice)
    const upperTick = priceToTick(upperPrice)

    // Align to tick spacing
    const alignedLowerTick = alignTickToSpacing(lowerTick, tickSpacing)
    const alignedUpperTick = alignTickToSpacing(upperTick, tickSpacing)

    return {
        lowerTick: alignedLowerTick,
        upperTick: alignedUpperTick,
        lowerPrice: tickToPrice(alignedLowerTick),
        upperPrice: tickToPrice(alignedUpperTick),
    }
}

/**
 * Creates a transaction manifest for adding liquidity to a concentrated liquidity pool
 * @param poolComponentAddress - The component address of the pool
 * @param currentPrice - The current price
 * @param lowerPricePercentage - The percentage for lower bound (e.g., -50 for 50% below)
 * @param upperPricePercentage - The percentage for upper bound (e.g., 100 for 100% above)
 * @param tickSpacing - The tick spacing of the pool
 * @returns The transaction manifest
 */
export function createAddLiquidityManifest(
    poolComponentAddress: string,
    currentPrice: number | string | Decimal,
    lowerPricePercentage: number,
    upperPricePercentage: number,
    tickSpacing: number
): { manifest: string; lowerTick: Decimal; upperTick: Decimal } {
    const { lowerTick, upperTick } = calculateTickBounds(
        currentPrice,
        lowerPricePercentage,
        upperPricePercentage,
        tickSpacing
    )

    const manifest = `
CALL_METHOD
    Address("${poolComponentAddress}")
    "add_liquidity"
    ${lowerTick}i32
    ${upperTick}i32
    Bucket("buyToken")
    Bucket("xrdSide")
    ;`

    return { manifest, lowerTick, upperTick }
}

// const TICK_BASE_SQRT = new Decimal('1.0001').sqrt()
// const MAX_TICK = 887272 // This value might need adjustment based on your specific requirements

// // Interface for TokenAmount
// interface TokenAmount {
//     token: string
//     resource_address: string
// }

// // Function to calculate the number of ticks
// function numberOfTicks(spacing: number): number {
//     return 2 * Math.floor(MAX_TICK / spacing) + 1
// }

// // Function to calculate max liquidity per tick
// function maxLiquidityPerTick(spacing: number): Decimal {
//     // Assuming MAX_LIQUIDITY is defined elsewhere
//     return MAX_LIQUIDITY.div(new Decimal(numberOfTicks(spacing)))
// }

// // Function to convert tick to price sqrt
// function tickToPriceSqrt(tick: number): Decimal {
//     return TICK_BASE_SQRT.pow(tick)
// }

// // Function to align tick
// function alignTick(tick: number, spacing: number): number {
//     return Math.floor(tick / spacing) * spacing
// }

// function adjustWithinMargin(
//     amount: Decimal,
//     allowedAmount: Decimal,
//     margin: Decimal
// ): Decimal {
//     if (amount.sub(allowedAmount).lte(margin)) {
//         return amount
//     }
//     return allowedAmount
// }

export function ociswapLpStrategyManifest({
    account,
    lendResource,
    lendAmount,
    borrowResource,
    borrowAmount,
    swapBorrowAmount,
    swapComponent,
    swapToken,
    poolComponent,
    leftBound,
    rightBound,
}: {
    account: string
    lendResource: string
    lendAmount: string
    borrowResource: string
    borrowAmount: string
    swapBorrowAmount: string
    swapComponent: string
    swapToken: string
    poolComponent: string
    leftBound: string
    rightBound: string
}) {
    return `
CALL_METHOD
Address("component_rdx1cqjzzku4rrkz3zhm8hldn55evpgmxx9rpq9t98qtnj0asdg88f9yj6")
"charge_strategy_royalty"
;
CALL_METHOD
Address("${account}")
"withdraw"
Address("${lendResource}")
Decimal("${lendAmount}")
;
TAKE_ALL_FROM_WORKTOP
Address("${lendResource}")
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
        Address("${borrowResource}"),
        Decimal("${borrowAmount}")
    )
)
;
TAKE_FROM_WORKTOP
Address("${borrowResource}")
Decimal("${swapBorrowAmount}")
Bucket("xrd")
;
CALL_METHOD
Address("${swapComponent}")
"swap"
Bucket("xrd")
;
TAKE_ALL_FROM_WORKTOP
Address("${swapToken}")
Bucket("buyToken")
;
TAKE_ALL_FROM_WORKTOP
Address("${borrowResource}")
Bucket("xrdSide");
CALL_METHOD
Address("${poolComponent}")
"add_liquidity"
${leftBound}i32
${rightBound}i32
Bucket("buyToken")
Bucket("xrdSide")
;
CALL_METHOD
Address("${account}")
"deposit_batch"
Array<Bucket>(Bucket("nft"));
CALL_METHOD
Address("${account}")
"deposit_batch"
Expression("ENTIRE_WORKTOP")
;`
}

const TICK_BASE_SQRT = new Decimal('1.000049998750062496094023416993798697')

const schema = s.struct({
    price_sqrt: s.decimal(),
    active_tick: s.option(s.number()),
    lp_manager: s.address(),
})

const nftSchema = s.struct({
    liquidity: s.decimal(),
    left_bound: s.number(),
    right_bound: s.number(),
})

export function removableAmounts(
    liquidity: Decimal,
    priceSqrt: Decimal,
    priceLeftBoundSqrt: Decimal,
    priceRightBoundSqrt: Decimal,
    xDivisibility: number,
    yDivisibility: number
): {
    left_bound: number
    right_bound: number
    x_amount: Decimal
    y_amount: Decimal
} {
    // Case 1: All liquidity is withdrawn as token x.
    if (priceSqrt.lte(priceLeftBoundSqrt)) {
        const xAmount = Decimal.max(
            liquidity
                .div(priceLeftBoundSqrt)
                .sub(
                    liquidity.div(priceRightBoundSqrt).add(new Decimal('1e-18'))
                ),
            new Decimal(0)
        )

        return {
            left_bound: priceLeftBoundSqrt
                .pow(2)
                .toDecimalPlaces(18)
                .toNumber(),
            right_bound: priceRightBoundSqrt
                .pow(2)
                .toDecimalPlaces(18)
                .toNumber(),
            x_amount: xAmount.toDecimalPlaces(
                xDivisibility,
                Decimal.ROUND_FLOOR
            ),
            y_amount: new Decimal(0),
        }
    }

    // Case 2: All liquidity is withdrawn as token y.
    if (priceSqrt.gte(priceRightBoundSqrt)) {
        const yAmount = liquidity.mul(
            priceRightBoundSqrt.sub(priceLeftBoundSqrt)
        )
        return {
            left_bound: priceLeftBoundSqrt
                .pow(2)
                .toDecimalPlaces(18)
                .toNumber(),
            right_bound: priceRightBoundSqrt
                .pow(2)
                .toDecimalPlaces(18)
                .toNumber(),
            x_amount: new Decimal(0),
            y_amount: yAmount.toDecimalPlaces(
                yDivisibility,
                Decimal.ROUND_FLOOR
            ),
        }
    }

    // Case 3: Liquidity is withdrawn as both x and y.
    const xAmount = Decimal.max(
        liquidity
            .div(priceSqrt)
            .sub(
                liquidity
                    .div(priceRightBoundSqrt)
                    .add(Decimal.min(1e-18, new Decimal('1e-18')))
            ),
        new Decimal(0)
    )
    const yAmount = liquidity.mul(priceSqrt.sub(priceLeftBoundSqrt))

    return {
        left_bound: priceLeftBoundSqrt.toDecimalPlaces(18).toNumber(),
        right_bound: priceRightBoundSqrt.toDecimalPlaces(18).toNumber(),
        x_amount: xAmount,
        y_amount: yAmount,
    }
}

const ATTO = new Decimal('1e-18')

function removableAmountsV2(
    liquidity: Decimal,
    priceSqrt: Decimal,
    priceLeftBoundSqrt: Decimal,
    priceRightBoundSqrt: Decimal,
    xDivisibility: number,
    yDivisibility: number
): {
    left_bound: number
    right_bound: number
    x_amount: Decimal
    y_amount: Decimal
} {
    // When the current price is below the lower bound, all liquidity can be withdrawn as token x.
    if (priceSqrt.lessThanOrEqualTo(priceLeftBoundSqrt)) {
        const xAmount = Decimal.max(
            liquidity
                .div(priceLeftBoundSqrt)
                .minus(liquidity.div(priceRightBoundSqrt).plus(ATTO)),
            new Decimal(0)
        )
        // return [
        //     xAmount.toDecimalPlaces(xDivisibility, Decimal.ROUND_FLOOR),
        //     new Decimal(0),
        // ]

        return {
            left_bound: priceLeftBoundSqrt
                .toDecimalPlaces(xDivisibility)
                .toNumber(),
            right_bound: priceRightBoundSqrt
                .toDecimalPlaces(yDivisibility)
                .toNumber(),
            x_amount: xAmount,
            y_amount: new Decimal(0),
        }
    }

    // When the current price is above the upper bound, all liquidity can be withdrawn as token y.
    if (priceSqrt.greaterThanOrEqualTo(priceRightBoundSqrt)) {
        const yAmount = liquidity.times(
            priceRightBoundSqrt.minus(priceLeftBoundSqrt)
        )
        // return [
        //     new Decimal(0),
        //     yAmount.toDecimalPlaces(yDivisibility, Decimal.ROUND_FLOOR),
        // ]

        return {
            left_bound: priceLeftBoundSqrt
                .toDecimalPlaces(xDivisibility)
                .toNumber(),
            right_bound: priceRightBoundSqrt
                .toDecimalPlaces(yDivisibility)
                .toNumber(),
            x_amount: new Decimal(0),
            y_amount: yAmount,
        }
    }

    // When the current price is within the bounds, calculate the withdrawable amounts for both tokens.
    const xAmount = Decimal.max(
        liquidity
            .div(priceSqrt)
            .minus(liquidity.div(priceRightBoundSqrt).plus(ATTO)),
        new Decimal(0)
    )
    const yAmount = liquidity.times(priceSqrt.minus(priceLeftBoundSqrt))

    //     return [
    //         xAmount.toDecimalPlaces(xDivisibility, Decimal.ROUND_FLOOR),
    //         yAmount.toDecimalPlaces(yDivisibility, Decimal.ROUND_FLOOR),
    //     ]

    return {
        left_bound: priceLeftBoundSqrt.toDecimalPlaces(18).toNumber(),
        right_bound: priceRightBoundSqrt.toDecimalPlaces(18).toNumber(),
        x_amount: xAmount,
        y_amount: yAmount,
    }
}

export function tickToPriceSqrt(tick: Decimal) {
    return TICK_BASE_SQRT.pow(tick)
}

export async function getAllNftIds(
    gatewayApiEzMode: GatewayEzMode,
    resourceAddress: string,
    allNfts: string[] = [],
    nextCursor: string | undefined = undefined,
    state: number
) {
    const nfts = await gatewayApiEzMode.gateway.state.getNonFungibleIds(
        resourceAddress,
        { state_version: state },
        nextCursor
    )

    if (nfts.next_cursor) {
        return await getAllNftIds(
            gatewayApiEzMode,
            resourceAddress,
            [...allNfts, ...nfts.items],
            nfts.next_cursor,
            state
        )
    }

    return [...allNfts, ...nfts.items]
}

export async function getNonFungibleData(
    gatewayApiEzMode: GatewayEzMode,
    resourceAddress: string,
    ids: string[]
) {
    const nonFungibleData =
        await gatewayApiEzMode.gateway.state.getNonFungibleData(
            resourceAddress,
            ids
        )

    return nonFungibleData
        .filter((nft) => !nft.is_burned)
        .map((nft) => nftSchema.parse(nft.data!.programmatic_json ?? {}, []))
}

function getStepSize(min: number, max: number): number {
    const range = new Decimal(max).sub(min)
    const numPoints = 100 // Desired number of points
    return range.dividedBy(numPoints).toDP(9).toNumber()
}

export async function getHistoricalComponentInfo(
    gatewayApiEzMode: GatewayEzMode,
    componentAddress: string,
    date: Date
) {
    return gatewayApiEzMode.gateway.state.innerClient
        .stateEntityDetails({
            stateEntityDetailsRequest: {
                addresses: [componentAddress],
                at_ledger_state: {
                    timestamp: date,
                },
            },
        })
        .then((res) => {
            return res
        })
        .then((response) => {
            if (response.items.length) {
                const component = response.items[0]
                    .details as StateEntityDetailsResponseComponentDetails

                const state = schema.parse(
                    component.state as ProgrammaticScryptoSborValue,
                    []
                )

                const tokens = response.items[0].fungible_resources?.items.map(
                    (fr) => fr.resource_address
                )

                const xAddress = response.items[0].metadata.items.find(
                    (i) => i.key === 'x_address'
                )?.value.typed as MetadataGlobalAddressValue
                const yAddress = response.items[0].metadata.items.find(
                    (i) => i.key === 'y_address'
                )?.value.typed as MetadataGlobalAddressValue

                return {
                    x: tokens![0],
                    y: tokens![1],
                    ...state,
                    x_address: xAddress?.value,
                    y_address: yAddress?.value,
                }
            }
        })
}

export async function getLpPerformanceOverTime(
    gatewayApiEzMode: GatewayEzMode,
    componentAddress: string,
    xAmount: Decimal,
    yAmount: Decimal,
    leftBound: number,
    rightBound: number,
    startDate: Date,
    endDate: Date
) {
    const dateRangePerDayList = []

    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
        dateRangePerDayList.push(new Date(currentDate))
        currentDate.setUTCDate(currentDate.getUTCDate() + 1)
    }

    let previousXAmount = xAmount
    let previousYAmount = yAmount
    const performanceData = await Promise.all(
        dateRangePerDayList.map(async (stateVersion, i) => {
            const componentInfo = await getHistoricalComponentInfo(
                gatewayApiEzMode,
                componentAddress,
                stateVersion
            )
            await sleep(100)

            const x = i === 0 ? xAmount : previousXAmount
            const y = i === 0 ? yAmount : previousYAmount

            const addables = addableAmounts(
                x,
                18, // xDivisibility
                y,
                18, // yDivisibility
                new Decimal(componentInfo?.price_sqrt ?? 0),
                tickToPriceSqrt(new Decimal(leftBound)),
                tickToPriceSqrt(new Decimal(rightBound))
            )

            previousXAmount = addables[0]
            previousYAmount = addables[1]

            return addableAmounts
        })
    )

    return performanceData
}

export async function getPriceOvertime(
    gatewayApiEzMode: GatewayEzMode,
    componentAddress: string,
    startDate: Date,
    endDate: Date
) {
    const dateRangePerDayList = []

    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
        dateRangePerDayList.push(new Date(currentDate))
        currentDate.setUTCDate(currentDate.getUTCDate() + 1)
    }

    const performanceData = await Promise.all(
        dateRangePerDayList.map(async (stateVersion) => {
            const componentInfo = await getHistoricalComponentInfo(
                gatewayApiEzMode,
                componentAddress,
                stateVersion
            )

            await sleep(2000)

            const tick =
                componentInfo?.active_tick.variant === 'Some'
                    ? componentInfo?.active_tick.value
                    : '0'

            return componentInfo
                ? componentInfo.y_address === XRD_RESOURCE_ADDRESS
                    ? tickToPrice(new Decimal(tick)).toNumber()
                    : new Decimal(1)
                          .dividedBy(tickToPrice(new Decimal(tick)))
                          .toNumber()
                : 0
        })
    )

    const latestDate = new Date()

    const componentInfo = await getHistoricalComponentInfo(
        gatewayApiEzMode,
        componentAddress,
        latestDate
    )

    await sleep(100)

    const tick =
        componentInfo?.active_tick.variant === 'Some'
            ? componentInfo?.active_tick.value
            : '0'

    const latestPrice = componentInfo
        ? componentInfo.y_address === XRD_RESOURCE_ADDRESS
            ? tickToPrice(new Decimal(tick)).toNumber()
            : new Decimal(1)
                  .dividedBy(tickToPrice(new Decimal(tick)))
                  .toNumber()
        : 0

    dateRangePerDayList.push(latestDate)
    performanceData.push(latestPrice)

    return dateRangePerDayList.reduce(
        (acc, date, i) => ({
            ...acc,
            [date.toISOString().split('T')[0]]: performanceData[i],
        }),
        {} as Record<string, number>
    )
}

export async function getLiquidityDistribution(
    gatewayApiEzMode: GatewayEzMode,
    componentAddress: string
) {
    const precisionPoolState =
        await gatewayApiEzMode.state.getComponentInfo(componentAddress)

    const pairs =
        precisionPoolState.metadata.metadataExtractor.getMetadataValuesBatch({
            x_address: 'GlobalAddress',
            y_address: 'GlobalAddress',
        })

    const state = await gatewayApiEzMode.status.getCurrentStateVersion()

    const componentState = precisionPoolState.state
        .getWithSchema(schema)
        ._unsafeUnwrap()

    const priceSqrt = new Decimal(componentState.price_sqrt).pow(2)

    const lpResourceAddress = componentState.lp_manager

    const s3Key = `liquidity-distribution/${lpResourceAddress}.json`

    let cachedData: {
        liquidity: string
        left_bound: number
        right_bound: number
    }[] = []

    if (await doesKeyExistInS3(s3Key)) {
        console.log(`Data found in S3 for ${lpResourceAddress}, fetching...`)
        const data = await getFromS3(s3Key)
        if (data) {
            cachedData = JSON.parse(data)
        }

        const resourceInfo =
            await gatewayApiEzMode.state.getResourceInfo(lpResourceAddress)

        const totalSupply = +resourceInfo.supplyInfo.totalSupply

        if (cachedData.length !== totalSupply) {
            console.log(
                `Data in S3 does not match total supply, fetching again...`
            )
            // If not in S3, proceed to fetch and process the data
            const ids = await getAllNftIds(
                gatewayApiEzMode,
                lpResourceAddress,
                [],
                undefined,
                state
            )

            cachedData = await getNonFungibleData(
                gatewayApiEzMode,
                lpResourceAddress,
                ids
            )

            await uploadToS3(s3Key, JSON.stringify(cachedData))
        }
    } else {
        // If not in S3, proceed to fetch and process the data
        const ids = await getAllNftIds(
            gatewayApiEzMode,
            lpResourceAddress,
            [],
            undefined,
            state
        )

        cachedData = await getNonFungibleData(
            gatewayApiEzMode,
            lpResourceAddress,
            ids
        )

        // Store data in S3
        await uploadToS3(s3Key, JSON.stringify(cachedData))
    }

    const liquidityRanges = cachedData
        .map((nft) =>
            removableAmounts(
                new Decimal(nft.liquidity),
                priceSqrt,
                tickToPrice(new Decimal(nft.left_bound)),
                tickToPrice(new Decimal(nft.right_bound)),
                18, // xDivisibility
                18 // yDivisibility
            )
        )
        .sort((a, b) => a.left_bound - b.left_bound)

    //     const validLeftBounds = liquidityRanges
    //         .map((range) => new Decimal(range.left_bound))
    //         .filter((bound) => bound.lt(new Decimal('1e30')))

    //     const validRightBounds = liquidityRanges
    //         .map((range) => new Decimal(range.right_bound))
    //         .filter((bound) => bound.lt(new Decimal('1e30')))

    const priceSqrtMinusNinetyPercent = priceSqrt.minus(
        priceSqrt.div(100).times(90)
    )
    const priceSqrtPlusNineHundredPercent = priceSqrt.plus(
        priceSqrt.div(100).times(900)
    )

    const { left_bound: minLeftBound, right_bound: maxRightBound } =
        removableAmounts(
            new Decimal(0),
            priceSqrt,
            priceSqrtMinusNinetyPercent,
            priceSqrtPlusNineHundredPercent,
            18, // xDivisibility
            18
        )

    const liquidityPoints: {
        price: number
        x_amount: Decimal
        y_amount: Decimal
    }[] = []

    // step size should be dynamic based on the range
    const stepSize = getStepSize(minLeftBound, maxRightBound)

    for (let i = minLeftBound; i <= maxRightBound; i += stepSize) {
        const priceSqrt = new Decimal(i)
        let xAmount = new Decimal(0)
        let yAmount = new Decimal(0)

        liquidityRanges.forEach((range) => {
            if (
                priceSqrt.gte(range.left_bound) &&
                priceSqrt.lte(range.right_bound)
            ) {
                xAmount = xAmount.add(range.x_amount)
                yAmount = yAmount.add(range.y_amount)
            }
        })

        liquidityPoints.push({
            price: new Decimal(1).dividedBy(priceSqrt).toNumber(),
            x_amount: xAmount,
            y_amount: yAmount,
        })
    }

    const normalisedPrice = new Decimal(1).dividedBy(priceSqrt)

    //     // insert the current price sqrt into the liquidity points in an index closest to the left bound
    const closestIndex = liquidityPoints.findIndex(
        (range) => range.price >= normalisedPrice.toNumber()
    )

    const priceNum = normalisedPrice.toNumber()

    if (closestIndex !== -1) {
        liquidityPoints[closestIndex] = {
            price: priceNum,
            x_amount: liquidityPoints[closestIndex].x_amount,
            y_amount: liquidityPoints[closestIndex].y_amount,
        }
    }

    return {
        liquidityPoints: liquidityPoints
            .map((lp) => {
                return {
                    ...lp,
                    price:
                        pairs.y_address === XRD_RESOURCE_ADDRESS
                            ? new Decimal(1).dividedBy(lp.price).toNumber()
                            : lp.price,
                }
            })
            .filter((points) => !points.price.toString().includes('e-'))
            .sort((a, b) => a.price - b.price),
        price:
            pairs.x_address === XRD_RESOURCE_ADDRESS
                ? priceNum
                : priceSqrt.toNumber(),
    }
}

export function adjustWithinMargin(
    amount: Decimal,
    allowedAmount: Decimal,
    margin: Decimal
): Decimal {
    if (amount.gte(allowedAmount) && amount.minus(allowedAmount).lte(margin)) {
        return amount
    }
    return allowedAmount
}

export function addableAmounts(
    xAmount: Decimal,
    xDivisibility: number,
    yAmount: Decimal,
    yDivisibility: number,
    priceSqrt: Decimal,
    priceLeftBoundSqrt: Decimal,
    priceRightBoundSqrt: Decimal
): [Decimal, Decimal] {
    const divisibilityUnit = (divisibility: number) =>
        new Decimal(10).pow(-divisibility)
    const subtractPrecisionMargin = (amount: Decimal, margin: Decimal) =>
        Decimal.max(amount.minus(margin), new Decimal(0))

    const xPrecisionMargin = divisibilityUnit(xDivisibility).mul(2)
    const yPrecisionMargin = divisibilityUnit(yDivisibility).mul(2)

    const xAmountSafe = subtractPrecisionMargin(xAmount, xPrecisionMargin)
    const yAmountSafe = subtractPrecisionMargin(yAmount, yPrecisionMargin)

    if (priceSqrt.lte(priceLeftBoundSqrt)) {
        // const xScale = new Decimal(1)
        //     .div(priceLeftBoundSqrt)
        //     .plus(new Decimal(1e-18))
        //     .minus(new Decimal(1).div(priceRightBoundSqrt))
        // const xLiquidity = xAmountSafe.div(xScale)
        return [xAmount, new Decimal(0)]
    }

    if (priceSqrt.gte(priceRightBoundSqrt)) {
        // const yScale = priceRightBoundSqrt.minus(priceLeftBoundSqrt)
        // const yLiquidity = yAmountSafe.div(yScale)
        return [new Decimal(0), yAmount]
    }

    const xScale = new Decimal(1)
        .div(priceSqrt)
        .plus(new Decimal(1e-18))
        .minus(new Decimal(1).div(priceRightBoundSqrt))
    const xLiquidity = xAmountSafe.div(xScale)

    const yScale = priceSqrt.minus(priceLeftBoundSqrt)
    const yLiquidity = yAmountSafe.div(yScale)

    const liquidity = Decimal.min(xLiquidity, yLiquidity)

    const xAmountAllowed = liquidity
        .mul(xScale)
        .plus(new Decimal(1e-18))
        .toDecimalPlaces(xDivisibility, Decimal.ROUND_CEIL)
    const yAmountAllowed = liquidity
        .mul(yScale)
        .plus(new Decimal(1e-18))
        .toDecimalPlaces(yDivisibility, Decimal.ROUND_CEIL)

    return [
        adjustWithinMargin(xAmount, xAmountAllowed, xPrecisionMargin),
        adjustWithinMargin(yAmount, yAmountAllowed, yPrecisionMargin),
    ]
}

export async function getOciLpPriceOvertime(
    component: string,
    startDate?: Date
) {
    let date = new Date()

    if (startDate) {
        date = new Date(startDate)
    } else {
        date.setDate(date.getDate() - 90)
        date.setDate(date.getDate() + 1)
        date.setHours(0, 0, 0, 0)
    }

    const currentData = (await doesKeyExistInS3(
        `oci-precision-price/${component}.json`
    ))
        ? (JSON.parse(
              (await getFromS3(`oci-precision-price/${component}.json`)) ?? '{}'
          ) as Record<string, number> | undefined)
        : undefined

    const dates = Object.keys(currentData ?? {})

    const latestDate = new Date(dates[dates.length - 1] ?? date)

    console.log('storing precision pool from ', latestDate)

    const price = await getPriceOvertime(
        gatewayApiEzMode,
        component,
        latestDate,
        new Date()
    )

    return { ...currentData, ...price }
}
