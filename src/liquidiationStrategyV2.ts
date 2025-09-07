import { STRATEGIES_V2_CACHE } from '..'
import {
    ATTOS_ROYALTY_COMPONENT,
    CHARGE_ROYALTY_METHOD,
} from './getAllAddLiquidityTxs'
import {
    astrolescentRequest,
    type AstrolescentSwapResponse,
} from './astrolescent'
import { getReservoirDeposit } from './fluxIlikeItStable'
import { XRD_RESOURCE_ADDRESS } from './resourceAddresses'
import type { LiquidationStrategy } from './strategiesV2'

export const FUSD =
    'resource_rdx1t49wa75gve8ehvejr760g3pgvkawsgsgq0u3kh7vevzk0g0cnsmscq'

export async function handleLiquidationStrategy({
    accountAddress,
    amount,
    resourceAddress,
}: {
    accountAddress: string
    amount: string
    resourceAddress: string
}) {
    const strategy = STRATEGIES_V2_CACHE.find(
        (s) => (s as LiquidationStrategy).resource_address === resourceAddress
    ) as LiquidationStrategy | undefined

    const swapResponse = await astrolescentRequest({
        accountAddress,
        inputToken: XRD_RESOURCE_ADDRESS,
        outputToken: FUSD,
        amount,
    })
        .then((res) => res.json() as Promise<AstrolescentSwapResponse>)
        .catch(() => undefined)

    if (!strategy || !swapResponse) {
        return
    }

    const reserviorManifest = await getReservoirDeposit({
        amount: `${swapResponse.outputTokens}`,
        collateralAddress: strategy.resource_address,
        accountAddress: accountAddress,
    })

    const buyManifestWithoutDeposit = swapResponse?.manifest?.split(';')

    if (!buyManifestWithoutDeposit) {
        return
    }

    const depositCall = buyManifestWithoutDeposit?.findIndex((m) =>
        m.includes('deposit_batch')
    )

    if (!depositCall) {
        return
    }

    buyManifestWithoutDeposit.splice(depositCall, 1)

    const depositFeesCall = buyManifestWithoutDeposit?.findIndex((m) =>
        m.includes('fee_bucket')
    )

    if (depositFeesCall) {
        buyManifestWithoutDeposit.splice(depositFeesCall, 2)
    }

    const reserviorDepositManifest = reserviorManifest.data.manifest.split(';')

    if (!reserviorDepositManifest) {
        return
    }

    reserviorDepositManifest.splice(0, 1)

    return {
        manifest: getSwapAndAddLiquidityManifest({
            swapManifest: buyManifestWithoutDeposit.join(';'),
            fUsdPoolManifest: reserviorDepositManifest.join(';'),
        }),
    }
}

export function getSwapAndAddLiquidityManifest({
    swapManifest,
    fUsdPoolManifest,
}: {
    swapManifest: string
    fUsdPoolManifest: string
}) {
    return `
CALL_METHOD
Address("${ATTOS_ROYALTY_COMPONENT}")
"${CHARGE_ROYALTY_METHOD}"
;
${swapManifest}
${fUsdPoolManifest}`
}
