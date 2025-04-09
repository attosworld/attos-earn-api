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
