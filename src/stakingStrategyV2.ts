import type {
    MetadataGlobalAddressValue,
    StateEntityDetailsResponseComponentDetails,
    StateEntityDetailsResponsePackageDetails,
} from '@radixdlt/babylon-gateway-api-sdk'
import { gatewayApi, gatewayApiEzMode } from '..'

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

        // Process each component in the batch
        for (let j = 0; j < batch.length; j++) {
            const stakeComponent = batch[j]
            const componentDetail = componentDetails.items[j]
                .details as StateEntityDetailsResponseComponentDetails

            const blueprintName = componentDetail.blueprint_name
            const packageAddress = componentDetail.package_address

            if (!packageAddress) {
                continue
            }

            // Get package details
            const packageDetails = (
                await gatewayApi.state.innerClient.stateEntityDetails({
                    stateEntityDetailsRequest: {
                        addresses: [packageAddress],
                    },
                })
            ).items[0].details as StateEntityDetailsResponsePackageDetails

            const functionsAndMethods = (
                packageDetails.blueprints?.items.find((item) => {
                    return item.name === blueprintName
                })?.definition as {
                    function_exports: Record<string, Record<string, string>>
                }
            )?.function_exports

            if (!functionsAndMethods) {
                continue
            }

            const foundStakeMethod = Object.keys(COMPATIBLE_METHOD).find(
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
                componentDetails.items[j].metadata.items.find(
                    (m) => m.key === 'stake_receipt'
                )?.value.typed as MetadataGlobalAddressValue
            )?.value

            // Find all resource addresses that map to this stake component
            const matchingResourceAddresses = Object.entries(
                resourceToStakeComponent
            )
                .filter(([_, component]) => component === stakeComponent)
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

    return results
}
