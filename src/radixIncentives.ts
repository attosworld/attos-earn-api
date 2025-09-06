// export interface ActivityCategory {
//     id: string
//     name: string
//     description: string | null
// }

// export interface ActivityItem {
//     id: string
//     name: string | null
//     description: string | null
//     category: string
//     dapp: string
//     componentAddresses: string[]
//     data: Record<string, unknown>
//     activityCategories: ActivityCategory
// }

// export interface ActivityData {
//     provideXrdDerivativeLiquidityToDex: ActivityItem[]
//     tradingVolume: ActivityItem[]
//     maintainXrdBalance: ActivityItem[]
//     provideBlueChipLiquidityToDex: ActivityItem[]
//     provideStablesLiquidityToDex: ActivityItem[]
//     provideNativeLiquidityToDex: ActivityItem[]
//     lendingXrdDerivative: ActivityItem[]
// }

export interface Activity {
    id: string
    name: string
    description: string | null
    category: string
    dapp: string
    componentAddresses: string[]
    // data: {
    //     ap: boolean
    //     multiplier: boolean
    //     showOnEarnPage: boolean
    // }
    // activityCategories: {
    //     id: string
    //     name: string
    //     description: string | null
    // }
}

export type RadixIncentivesResponse = {
    activityCategories: { activities: Activity[] }[]
}

export const ProviderMap = {
    'Weft Finance': 'we',
    'Root Finance': 'ro',
}

export const getRadixIncentives = async (
    category: 'liquidity' | 'lending',
    resources?: {
        symbol: string
        provider: 'Weft Finance' | 'Root Finance'
    }[]
) => {
    return fetch('https://incentives.radixdlt.com/api/campaign-data')
        .then((res) => res.json() as Promise<RadixIncentivesResponse>)
        .then((res) => {
            const activityData = res.activityCategories
                .map((r) => r.activities)
                .flat()

            return activityData.reduce((acc, key) => {
                if (key.category.toLowerCase().includes(category)) {
                    key.componentAddresses.forEach((address) => {
                        acc.add(address)
                    })

                    const keys = key.id.split('_')
                    resources?.forEach((resource) => {
                        if (
                            resource.symbol.includes(
                                key.id.split('_')[keys.length - 1]
                            ) &&
                            keys[0] === ProviderMap[resource.provider]
                        ) {
                            acc.add(
                                `${ProviderMap[resource.provider]}_${resource.symbol}`
                            )
                        }
                    })
                    return acc
                }
                return acc
            }, new Set<string>())
        })
}
