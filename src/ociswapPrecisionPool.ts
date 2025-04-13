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

const TICK_BASE_SQRT = new Decimal('1.0001').sqrt()
const MAX_TICK = 887272 // This value might need adjustment based on your specific requirements

// Enum for SwapType
enum SwapType {
    BuyX,
    SellX,
}

// Interface for TokenAmount
interface TokenAmount {
    token: string
    resource_address: string
}

// Function to calculate the number of ticks
function numberOfTicks(spacing: number): number {
    return 2 * Math.floor(MAX_TICK / spacing) + 1
}

// Function to calculate max liquidity per tick
function maxLiquidityPerTick(spacing: number): Decimal {
    // Assuming MAX_LIQUIDITY is defined elsewhere
    return MAX_LIQUIDITY.div(new Decimal(numberOfTicks(spacing)))
}

// Function to convert tick to price sqrt
function tickToPriceSqrt(tick: number): Decimal {
    return TICK_BASE_SQRT.pow(tick)
}

// Function to align tick
function alignTick(tick: number, spacing: number): number {
    return Math.floor(tick / spacing) * spacing
}

// Function to calculate addable amounts
function addableAmounts(
    xAmount: Decimal,
    xDivisibility: number,
    yAmount: Decimal,
    yDivisibility: number,
    priceSqrt: Decimal,
    priceLeftBoundSqrt: Decimal,
    priceRightBoundSqrt: Decimal
): [Decimal, Decimal, Decimal] {
    const xPrecisionMargin = new Decimal(10).pow(-xDivisibility).mul(2)
    const yPrecisionMargin = new Decimal(10).pow(-yDivisibility).mul(2)

    const xAmountSafe = xAmount.sub(xPrecisionMargin).max(new Decimal(0))
    const yAmountSafe = yAmount.sub(yPrecisionMargin).max(new Decimal(0))

    if (priceSqrt.lte(priceLeftBoundSqrt)) {
        const xScale = xScaleSafe(priceLeftBoundSqrt, priceRightBoundSqrt)
        const xLiquidity = xAmountSafe.div(xScale)
        return [xLiquidity, xAmount, new Decimal(0)]
    }

    if (priceSqrt.gte(priceRightBoundSqrt)) {
        const yScale = yScaleSafe(priceLeftBoundSqrt, priceRightBoundSqrt)
        const yLiquidity = yAmountSafe.div(yScale)
        return [yLiquidity, new Decimal(0), yAmount]
    }

    const xScale = xScaleSafe(priceSqrt, priceRightBoundSqrt)
    const xLiquidity = xAmountSafe.div(xScale)

    const yScale = yScaleSafe(priceLeftBoundSqrt, priceSqrt)
    const yLiquidity = yAmountSafe.div(yScale)

    const liquidity = Decimal.min(xLiquidity, yLiquidity)

    const xAmountAllowed = liquidity
        .mul(xScale)
        .add(Decimal.ATTO)
        .ceil()
        .toDecimalPlaces(xDivisibility)
    const yAmountAllowed = liquidity
        .mul(yScale)
        .add(Decimal.ATTO)
        .ceil()
        .toDecimalPlaces(yDivisibility)

    return [
        liquidity,
        adjustWithinMargin(xAmount, xAmountAllowed, xPrecisionMargin),
        adjustWithinMargin(yAmount, yAmountAllowed, yPrecisionMargin),
    ]
}

// Helper functions
function xScaleSafe(lowerPriceSqrt: Decimal, upperPriceSqrt: Decimal): Decimal {
    return new Decimal(1)
        .div(lowerPriceSqrt)
        .add(Decimal.ATTO)
        .sub(new Decimal(1).div(upperPriceSqrt))
}

function yScaleSafe(lowerPriceSqrt: Decimal, upperPriceSqrt: Decimal): Decimal {
    return upperPriceSqrt.sub(lowerPriceSqrt)
}

function adjustWithinMargin(
    amount: Decimal,
    allowedAmount: Decimal,
    margin: Decimal
): Decimal {
    if (amount.sub(allowedAmount).lte(margin)) {
        return amount
    }
    return allowedAmount
}

// Function to calculate removable amounts
function removableAmounts(
    liquidity: Decimal,
    priceSqrt: Decimal,
    priceLeftBoundSqrt: Decimal,
    priceRightBoundSqrt: Decimal,
    xDivisibility: number,
    yDivisibility: number
): [Decimal, Decimal] {
    if (priceSqrt.lte(priceLeftBoundSqrt)) {
        const xAmount = liquidity
            .div(priceLeftBoundSqrt)
            .sub(liquidity.div(priceRightBoundSqrt).add(Decimal.ATTO))
            .max(new Decimal(0))
        return [xAmount.floor().toDecimalPlaces(xDivisibility), new Decimal(0)]
    }

    if (priceSqrt.gte(priceRightBoundSqrt)) {
        const yAmount = liquidity.mul(
            priceRightBoundSqrt.sub(priceLeftBoundSqrt)
        )
        return [new Decimal(0), yAmount.floor().toDecimalPlaces(yDivisibility)]
    }

    const xAmount = liquidity
        .div(priceSqrt)
        .sub(liquidity.div(priceRightBoundSqrt).add(Decimal.ATTO))
        .max(new Decimal(0))
    const yAmount = liquidity.mul(priceSqrt.sub(priceLeftBoundSqrt))

    return [
        xAmount.floor().toDecimalPlaces(xDivisibility),
        yAmount.floor().toDecimalPlaces(yDivisibility),
    ]
}

// Function to calculate input amount net
function inputAmountNet(
    inputAmount: Decimal,
    inputFeeRate: Decimal,
    feeProtocolShare: Decimal,
    divisibility: number
): [Decimal, Decimal, Decimal] {
    const inputAmountGross = new Decimal(inputAmount)
    const inputFeeTotal = inputAmountGross
        .mul(inputFeeRate)
        .ceil()
        .toDecimalPlaces(divisibility)
    const protocolFeeInput = inputFeeTotal
        .mul(feeProtocolShare)
        .floor()
        .toDecimalPlaces(divisibility)
    const inputFeeLp = inputFeeTotal.sub(protocolFeeInput)
    const inputAmountNet = inputAmount.sub(inputFeeTotal)

    if (inputAmountNet.lte(0)) {
        throw new Error('Input amount net needs to be positive!')
    }

    return [inputAmountNet, inputFeeLp, protocolFeeInput]
}

// Function to calculate new price
function newPrice(
    swapType: SwapType,
    liquidity: Decimal,
    priceSqrt: Decimal,
    inputAmount: Decimal,
    inputDivisibility: number
): Decimal {
    const inputAmountAdjusted = inputAmount
        .sub(new Decimal(10).pow(-inputDivisibility))
        .max(new Decimal(0))

    switch (swapType) {
        case SwapType.BuyX:
            return inputAmountAdjusted
                .div(liquidity)
                .add(priceSqrt)
                .max(priceSqrt)
        case SwapType.SellX:
            return liquidity
                .mul(priceSqrt)
                .add(Decimal.ATTO)
                .div(liquidity.add(inputAmountAdjusted.mul(priceSqrt)))
                .add(Decimal.ATTO)
                .min(priceSqrt)
    }
}
