import type {
    MetadataGlobalAddressValue,
    StateEntityDetailsResponseComponentDetails,
    StateEntityDetailsResponsePackageDetails,
} from '@radixdlt/babylon-gateway-api-sdk'
import { gatewayApi, gatewayApiEzMode, STRATEGIES_V2_CACHE } from '..'
import type { StakingStrategy } from './strategiesV2'
import { astrolescentRequest } from './astrolescent'
import { XRD_RESOURCE_ADDRESS } from './resourceAddresses'
import type { AstrolescentSwapResponse } from './astrolescent'
import {
    ATTOS_ROYALTY_COMPONENT,
    CHARGE_ROYALTY_METHOD,
} from './getAllAddLiquidityTxs'

const COMPATIBLE_METHOD = {
    AddStake: 'add_stake',
    Stake: 'stake',
}

export interface StakeImplementation {
    resourceAddresses: string[]
}

export interface StakeImplementationResponse {
    stakeComponent: string
    stakeMethod: string
    requireOptionalProof?: boolean
}

export const stakeImplementationMethod = async ({
    resourceAddresses,
}: StakeImplementation): Promise<
    Record<string, StakeImplementationResponse>
> => {
    // Initialize the result record
    const results: Record<string, StakeImplementationResponse> = {}

    // Get resource info batch
    const resourceInfos =
        await gatewayApiEzMode.state.getResourceInfoBatch(resourceAddresses)

    // Create a mapping of resource address to stake component
    const resourceToStakeComponent: Record<string, string> = {}

    // Extract stake components and create the mapping
    const stakeComponents = resourceInfos
        .map((info, index) => {
            const stakeComponent =
                info.metadata.metadataExtractor.getMetadataValue(
                    'stake_component',
                    'GlobalAddress'
                )

            if (stakeComponent) {
                resourceToStakeComponent[resourceAddresses[index]] =
                    stakeComponent
                return stakeComponent
            }
            return null
        })
        .filter(Boolean) as string[] // Filter out undefined values

    // Process stake components in batches of 20
    for (let i = 0; i < stakeComponents.length; i += 20) {
        const batch = stakeComponents.slice(i, i + 20)

        // Get component details for the batch
        const componentDetails =
            await gatewayApi.state.innerClient.stateEntityDetails({
                stateEntityDetailsRequest: {
                    addresses: batch,
                },
            })

        // Collect package addresses for batch processing
        const packageAddresses: string[] = []
        const componentToPackage: Record<string, string> = {}
        const componentData: Record<
            string,
            {
                blueprintName: string
                index: number
            }
        > = {}

        // Process each component in the batch to collect package addresses
        for (let j = 0; j < batch.length; j++) {
            const stakeComponent = batch[j]
            const componentDetail = componentDetails.items[j]
                .details as StateEntityDetailsResponseComponentDetails

            const blueprintName = componentDetail.blueprint_name
            const packageAddress = componentDetail.package_address

            if (packageAddress) {
                packageAddresses.push(packageAddress)
                componentToPackage[stakeComponent] = packageAddress
                componentData[stakeComponent] = {
                    blueprintName,
                    index: j,
                }
            }
        }

        // Batch request package details
        if (packageAddresses.length === 0) continue

        // Process package addresses in batches of 20
        for (let k = 0; k < packageAddresses.length; k += 20) {
            const packageBatch = packageAddresses.slice(k, k + 20)

            const packageDetailsResponse =
                await gatewayApi.state.innerClient.stateEntityDetails({
                    stateEntityDetailsRequest: {
                        addresses: packageBatch,
                    },
                })

            // Process each package in the batch
            for (let p = 0; p < packageBatch.length; p++) {
                const packageAddress = packageBatch[p]
                const packageDetails = packageDetailsResponse.items[p]
                    .details as StateEntityDetailsResponsePackageDetails

                // Find components that use this package
                const componentsUsingPackage = Object.entries(
                    componentToPackage
                )
                    .filter(([, pkg]) => pkg === packageAddress)
                    .map(([component]) => component)

                for (const stakeComponent of componentsUsingPackage) {
                    const { blueprintName, index } =
                        componentData[stakeComponent]

                    const functionsAndMethods = (
                        packageDetails.blueprints?.items.find((item) => {
                            return item.name === blueprintName
                        })?.definition as {
                            function_exports: Record<
                                string,
                                Record<string, string>
                            >
                        }
                    )?.function_exports

                    if (!functionsAndMethods) {
                        continue
                    }

                    const foundStakeMethod = Object.keys(
                        COMPATIBLE_METHOD
                    ).find(
                        (key) =>
                            functionsAndMethods[
                                COMPATIBLE_METHOD[
                                    key as keyof typeof COMPATIBLE_METHOD
                                ] as keyof typeof functionsAndMethods
                            ]
                    ) as keyof typeof COMPATIBLE_METHOD

                    if (!foundStakeMethod) {
                        continue
                    }

                    const stakeReceipt = (
                        componentDetails.items[index].metadata.items.find(
                            (m) => m.key === 'stake_receipt'
                        )?.value.typed as MetadataGlobalAddressValue
                    )?.value

                    // Find all resource addresses that map to this stake component
                    const matchingResourceAddresses = Object.entries(
                        resourceToStakeComponent
                    )
                        .filter(([, component]) => component === stakeComponent)
                        .map(([resourceAddress]) => resourceAddress)

                    // Add an entry for each matching resource address
                    for (const resourceAddress of matchingResourceAddresses) {
                        results[resourceAddress] = {
                            stakeComponent,
                            stakeMethod: COMPATIBLE_METHOD[foundStakeMethod],
                            ...(stakeReceipt && { requireOptionalProof: true }),
                        }
                    }
                }
            }
        }
    }

    return results
}

export function getSwapAndStakeManifest({
    swapManifest,
    account,
    tokenAddress,
    componentAddress,
    method,
    requireOptionalProof,
}: {
    swapManifest: string
    account: string
    tokenAddress: string
    amount: string
    componentAddress: string
    method: string
    requireOptionalProof: boolean | undefined
}) {
    return `
CALL_METHOD
Address("${ATTOS_ROYALTY_COMPONENT}")
"${CHARGE_ROYALTY_METHOD}"
;
${swapManifest}
TAKE_ALL_FROM_WORKTOP
  Address("${tokenAddress}")
  Bucket("x")
;
CALL_METHOD
    Address("${componentAddress}")
    "${method}"
    Bucket("x")
    ${requireOptionalProof ? 'None' : ''}
;
CALL_METHOD
    Address("${account}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
    `
}

export async function handleStrategiesV2Staking({
    accountAddress,
    amount,
    componentAddress,
}: {
    accountAddress: string
    amount: string
    componentAddress: string
}): Promise<{ manifest: string } | undefined> {
    const strategy = STRATEGIES_V2_CACHE.find(
        (s) => (s as StakingStrategy).stakeComponent === componentAddress
    ) as StakingStrategy | undefined

    if (!strategy) {
        return
    }

    const swapResponse = await astrolescentRequest({
        accountAddress,
        inputToken: XRD_RESOURCE_ADDRESS,
        outputToken: strategy.resource_address,
        amount,
    })
        .then((res) => res.json() as Promise<AstrolescentSwapResponse>)
        .catch(() => undefined)

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

    return {
        manifest: getSwapAndStakeManifest({
            swapManifest: buyManifestWithoutDeposit?.join(';'),
            account: accountAddress,
            tokenAddress: strategy.resource_address,
            amount,
            componentAddress,
            method: strategy.stakeMethod,
            requireOptionalProof: strategy.requireOptionalProof,
        }),
    }
}
