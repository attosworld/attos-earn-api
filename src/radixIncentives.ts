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
    data: {
        ap: boolean
        multiplier: boolean
        showOnEarnPage: boolean
    }
    activityCategories: {
        id: string
        name: string
        description: string | null
    }
}

export type RadixIncentivesResponse = [
    { result: { data: { json: Activity[] } } },
]

export const getRadixIncentives = async (category: 'liquidity' | 'lending') => {
    return fetch(
        'https://incentives.radixdlt.com/api/trpc/activity.getActivityData,activity.getActivityCategories,dapps.getDapps?batch=1'
    )
        .then((res) => res.json() as Promise<RadixIncentivesResponse>)
        .then((res) => {
            const activityData = res[0].result.data.json

            return activityData.reduce((acc, key) => {
                if (
                    key.category.toLowerCase().includes(category) &&
                    key.data.ap
                ) {
                    key.componentAddresses.forEach((address) => {
                        acc.add(address)
                    })
                    return acc
                }
                return acc
            }, new Set<string>())
        })
}
