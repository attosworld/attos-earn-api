import {
    type FungibleResourcesCollectionItemGloballyAggregated,
    type ProgrammaticScryptoSborValueTuple,
    type StateEntityDetailsRequest,
    type StateEntityDetailsResponseComponentDetails,
    type StateEntityDetailsResponseFungibleResourceDetails,
    type StateEntityFungiblesPageRequest,
} from '@radixdlt/babylon-gateway-api-sdk'
import BigNumber from 'bignumber.js'
import { XRD_RESOURCE_ADDRESS } from './resourceAddresses'
import { gatewayApi, gatewayApiEzMode, POOLS_CACHE } from '../'
import {
    getVolumeAndTokenMetadata,
    type VolumeAndTokenMetadata,
} from './defiplaza'
import { sleep } from 'bun'
import { getFromS3 } from './s3-client'

// Global cache for LP pool data
const GLOBAL_LP_CACHE: Record<
    string,
    Record<
        string,
        {
            date: string
            totalSupplyLP: string
            'xrd-priceUSD': string
            values: Record<string, BigNumber>
            p0: string
            target_ratio: string
        }
    >
> = {}

export async function getLpPerformance(
    baseToken: string,
    type: 'base' | 'quote' | 'ociswap' | undefined,
    component: string | undefined,
    startDate?: Date,
    userLpAmount?: string
) {
    let pair: VolumeAndTokenMetadata = {} as VolumeAndTokenMetadata

    if (type !== 'ociswap') {
        const pairData = await getVolumeAndTokenMetadata(baseToken)

        if (!pairData) {
            return
        }

        pair = pairData
    }

    let date = new Date()

    if (startDate) {
        date = startDate
    } else {
        date.setDate(date.getDate() - 90)
        date.setDate(date.getDate() + 1)
        date.setHours(0, 0, 0, 0)
    }

    const now = new Date()
    const globalValuesByDate: Record<string, number> = {}
    const userValuesByDate: Record<string, number> = {}

    const ociswapDetails =
        type === 'ociswap'
            ? POOLS_CACHE?.find((p) => p.component === component)
            : undefined

    const currentData = JSON.parse(
        (await getFromS3(
            `lp-performance/${baseToken}-${type}-${component}.json`
        )) ?? '{}'
    ) as Record<string, number>

    const lpPoolAddress =
        type === 'ociswap' &&
        ociswapDetails?.sub_type !== 'precision' &&
        component
            ? await gatewayApiEzMode.state
                  .getComponentInfo(component)
                  .then((c) =>
                      c.metadata.metadataExtractor.getMetadataValue(
                          'liquidity_pool',
                          'GlobalAddress'
                      )
                  )
            : undefined

    while (date < now) {
        const xrd = await fetchOrGetPrice(XRD_RESOURCE_ADDRESS, date)
        const dateKey = date.toISOString().split('T')[0] // Format as YYYY-MM-DD

        if (type == 'base') {
            const lpToken = pair.baseLPToken
            const isoDateKey = date.toISOString()

            // Check if we already have this data in cache
            if (!GLOBAL_LP_CACHE[lpToken]) {
                GLOBAL_LP_CACHE[lpToken] = {}
            }

            if (!GLOBAL_LP_CACHE[lpToken][isoDateKey]) {
                const [supply] = await fetchTotalSupply([lpToken], date)
                const values = await fetchPoolValue(pair.basePool, date)
                const state = await fetchPoolStates(pair.component, date)

                GLOBAL_LP_CACHE[lpToken][isoDateKey] = {
                    date: isoDateKey,
                    totalSupplyLP: supply?.totalSupply ?? 0,
                    values,
                    'xrd-priceUSD': xrd?.tokenPriceUSD ?? 0,
                    p0: state?.p0,
                    target_ratio: state?.target_ratio,
                }
            }

            const cachedData = GLOBAL_LP_CACHE[lpToken][isoDateKey]

            // Calculate total XRD value of all tokens in the pool
            let totalXrdValue = new BigNumber(0)
            Object.entries(cachedData.values).forEach(([key, value]) => {
                if (!key.includes('-price')) {
                    const tokenAmount = new BigNumber(value)
                    const tokenPriceXRD = new BigNumber(
                        cachedData.values[`${key}-priceXRD`] || 0
                    )
                    totalXrdValue = totalXrdValue.plus(
                        tokenAmount.multipliedBy(tokenPriceXRD)
                    )
                }
            })

            // Store global value
            globalValuesByDate[dateKey] = totalXrdValue.toNumber()

            // Calculate user value if userLpAmount is provided
            if (userLpAmount) {
                const userShare = new BigNumber(userLpAmount).dividedBy(
                    cachedData.totalSupplyLP
                )
                const userXrdValue = totalXrdValue.multipliedBy(userShare)
                userValuesByDate[dateKey] = userXrdValue.toNumber()
            }
        } else if (type == 'quote') {
            const lpToken = pair.quoteLPToken
            const isoDateKey = date.toISOString()

            // Check if we already have this data in cache
            if (!GLOBAL_LP_CACHE[lpToken]) {
                GLOBAL_LP_CACHE[lpToken] = {}
            }

            if (!GLOBAL_LP_CACHE[lpToken][isoDateKey]) {
                const [supply] = await fetchTotalSupply([lpToken], date)
                const values = await fetchPoolValue(pair.quotePool, date)
                const state = await fetchPoolStates(pair.component, date)

                GLOBAL_LP_CACHE[lpToken][isoDateKey] = {
                    date: isoDateKey,
                    totalSupplyLP: supply?.totalSupply ?? 0,
                    values,
                    'xrd-priceUSD': xrd?.tokenPriceUSD ?? 0,
                    p0: state?.p0,
                    target_ratio: state?.target_ratio,
                }
            }

            const cachedData = GLOBAL_LP_CACHE[lpToken][isoDateKey]

            // Calculate total XRD value of all tokens in the pool
            let totalXrdValue = new BigNumber(0)
            Object.entries(cachedData.values).forEach(([key, value]) => {
                if (!key.includes('-price')) {
                    const tokenAmount = new BigNumber(value)
                    const tokenPriceXRD = new BigNumber(
                        cachedData.values[`${key}-priceXRD`] || 0
                    )
                    totalXrdValue = totalXrdValue.plus(
                        tokenAmount.multipliedBy(tokenPriceXRD)
                    )
                }
            })

            // Store global value
            globalValuesByDate[dateKey] = totalXrdValue.toNumber()

            // Calculate user value if userLpAmount is provided
            if (userLpAmount) {
                const userShare = new BigNumber(userLpAmount).dividedBy(
                    cachedData.totalSupplyLP
                )
                const userXrdValue = totalXrdValue.multipliedBy(userShare)
                userValuesByDate[dateKey] = userXrdValue.toNumber()
            }
        } else if (type === 'ociswap') {
            const isoDateKey = date.toISOString()

            if (ociswapDetails?.sub_type !== 'precision') {
                if (!lpPoolAddress) {
                    return
                }
            }

            if (!ociswapDetails || !ociswapDetails.lp_token) {
                return
            }

            const lpToken = ociswapDetails.lp_token

            if (ociswapDetails.sub_type !== 'precision') {
                // Check if we already have this data in cache
                if (!GLOBAL_LP_CACHE[lpToken]) {
                    GLOBAL_LP_CACHE[lpToken] = {}
                }

                if (!GLOBAL_LP_CACHE[lpToken][isoDateKey]) {
                    const [supply] = await fetchTotalSupply([lpToken], date)
                    const values = lpPoolAddress
                        ? await fetchPoolValue(lpPoolAddress, date)
                        : {}

                    GLOBAL_LP_CACHE[lpToken][isoDateKey] = {
                        date: isoDateKey,
                        totalSupplyLP: supply?.totalSupply ?? 0,
                        values,
                        'xrd-priceUSD': xrd?.tokenPriceUSD ?? 0,
                        p0: '', // Ociswap doesn't use p0
                        target_ratio: '', // Ociswap doesn't use target_ratio
                    }
                }

                const cachedData = GLOBAL_LP_CACHE[lpToken][isoDateKey]

                // Calculate total XRD value of all tokens in the pool
                let totalXrdValue = new BigNumber(0)
                Object.entries(cachedData.values).forEach(([key, value]) => {
                    if (!key.includes('-price')) {
                        const tokenAmount = new BigNumber(value)
                        const tokenPriceXRD = new BigNumber(
                            cachedData.values[`${key}-priceXRD`] || 0
                        )

                        totalXrdValue = totalXrdValue.plus(
                            tokenAmount.multipliedBy(tokenPriceXRD)
                        )
                    }
                })

                // Store global value
                globalValuesByDate[dateKey] = totalXrdValue.toNumber()

                // Calculate user value if userLpAmount is provided
                if (userLpAmount) {
                    const userShare = new BigNumber(userLpAmount).dividedBy(
                        cachedData.totalSupplyLP
                    )
                    const userXrdValue = totalXrdValue.multipliedBy(userShare)
                    userValuesByDate[dateKey] = userXrdValue.toNumber()
                }
            }
        }

        date.setDate(date.getDate() + 1)
        await sleep(200)
    }

    return Object.fromEntries(
        Object.entries({ ...currentData, ...globalValuesByDate }).slice(-365)
    )
}

async function fetchPoolValue(poolAddress: string, date: Date) {
    const query: StateEntityFungiblesPageRequest = {
        address: poolAddress,
        at_ledger_state: {
            timestamp: date,
        },
    }

    const walletState = await gatewayApi.state.innerClient
        .entityFungiblesPage({
            stateEntityFungiblesPageRequest: query,
        })
        .catch(() => ({
            items: [] as FungibleResourcesCollectionItemGloballyAggregated[],
        }))

    const values = {} as {
        [token: string]: BigNumber
    }

    for (const item of walletState.items) {
        const price = await fetchOrGetPrice(item.resource_address, date)

        if (!price?.tokenPriceXRD) {
            console.log(`--- oops`, date, item.resource_address)
        }

        values[item.resource_address] = BigNumber(
            (item as FungibleResourcesCollectionItemGloballyAggregated)?.amount
        )
        values[item.resource_address + '-priceXRD'] = BigNumber(
            price?.tokenPriceXRD ?? 0
        )
    }

    return values
}

async function fetchPoolStates(componentAddress: string, date: Date) {
    const componentDetails = await gatewayApi.state
        .getEntityDetailsVaultAggregated(
            componentAddress,
            {},
            {
                timestamp: date,
            }
        )
        .catch(() => ({
            details: {
                state: {
                    fields: [],
                },
            },
        }))

    for (const field of (
        (componentDetails.details as StateEntityDetailsResponseComponentDetails)!
            .state as unknown as ProgrammaticScryptoSborValueTuple
    ).fields) {
        if (field.field_name == 'state' && field.kind === 'Tuple') {
            const pairState = {
                p0: 0,
                shortage: 'Equilibrium',
                target_ratio: 0,
                last_outgoing: 0,
                last_out_spot: 0,
            } as Record<string, unknown>

            type Key = keyof typeof pairState

            for (const stateField of field.fields) {
                if (stateField.field_name) {
                    if (stateField.kind == 'Enum') {
                        pairState[stateField.field_name as Key] =
                            stateField.variant_name as string
                    } else if ('value' in stateField) {
                        pairState[stateField.field_name as Key] =
                            stateField.value
                    }
                }
            }

            return pairState as { p0: string; target_ratio: string }
        }
    }
    return { p0: '', target_ratio: '' }
}

export async function fetchTotalSupply(addresses: string[], date: Date) {
    const query: StateEntityDetailsRequest = {
        addresses,
        at_ledger_state: {
            timestamp: date,
        },
    }

    const tokenDetails = await gatewayApi.state.innerClient.stateEntityDetails({
        stateEntityDetailsRequest: query,
    })

    const supplies = []

    for (const detail of tokenDetails.items) {
        supplies.push({
            address: detail.address,
            totalSupply: (
                detail.details as StateEntityDetailsResponseFungibleResourceDetails
            ).total_supply,
        })
    }

    return supplies
}

const THIRTY_DAY_PRICE_HISTORY_CACHE: Record<
    number,
    Record<string, unknown>
> = {}

async function fetchOrGetPrice(tokenAddress: string, date: Date) {
    if (THIRTY_DAY_PRICE_HISTORY_CACHE[date.getTime()]) {
        return THIRTY_DAY_PRICE_HISTORY_CACHE[date.getTime()][tokenAddress]
    }
    const price = await fetchPrice(tokenAddress, date)
    THIRTY_DAY_PRICE_HISTORY_CACHE[date.getTime()] = price

    return price
}

async function fetchPrice(tokenAddress: string, date: Date) {
    return fetch(
        `https://api.astrolescent.com/partner/defiplaza/prices?address=${tokenAddress}&timestamp=${date.getTime()}`
    ).then((res) => res.json())
}
