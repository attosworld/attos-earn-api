export function createAddBasicOrFlexLiquidityManifest(
    poolComponentAddress: string
): string {
    return `
CALL_METHOD
    Address("${poolComponentAddress}")
    "add_liquidity"
    Bucket("buyToken")
    Bucket("xrdSide")
    ;`
}
