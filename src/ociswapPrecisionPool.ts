import Decimal from 'decimal.js'

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
