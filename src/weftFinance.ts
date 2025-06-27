/**
 * Weft API Client
 * A client for interacting with the Weft Finance API
 */

// Types for API responses
export interface WeftIndexResponse {
    message: string
}

export interface ResourcePrice {
    resourceAddress: string
    price: string
}

export interface PoolConfig {
    interest_update_period: number
    loan_fee_rate: number
    flash_loan_fee_rate: number
    utilization_limit?: number
    deposit_limit: {
        type: 'None' | 'Amount' | 'SupplyRatio'
        value?: number
    }
    flash_loan_amount_limit: {
        type: 'None' | 'Amount' | 'SupplyRatio'
        value?: number
    }
}

export interface InterestModelBreakPoint {
    usage: number
    rate: number
    slop: number
}

export interface InterestModel {
    id: string
    description: string
    breakPoints: InterestModelBreakPoint[]
}

export interface PoolState {
    resourceAddress: string
    depositUnitAddress: string
    totalDeposit: string
    totalLoan: string
    utilizationRate: string
    borrowingApr: string
    rawLendingApr: string
    netLendingApr: string
    depositUnitRatio: string
    depositUnitPrice: string
    loanUnitRatio: string
    loanUnitPrice: string
    config: PoolConfig
    interestModel: InterestModel
}

export interface StakingState {
    apr: number
    staked: number
    tvl_xrd: number
    tvl_usd: number
}

// CDP types based on the example response
export interface CDPData {
    id: string
    data: {
        total_loan_value: string | number | null
        total_adjusted_loan_value: string | number | null
        total_collateral_value: string | number | null
        total_health_collateral_value: string | number | null
        total_liquidation_collateral_value: string | number | null
        collateral_isolation_groups: number[]
        loan_excluded_isolation_groups: number[]
        health_ltv: string | number | null
        liquidation_ltv: string | number | null
        discounted_nft_collateral_value: string | number | null
        discounted_collateral_value: string | number | null
        loan_positions: {
            [resourceAddress: string]: {
                price: string | number | null
                units: string | number | null
                amount: string | number | null
                value: string | number | null
                adjusted_value: string | number | null
                config: {
                    description: string
                    loan_value_factor: string | number | null
                    loan_close_factor: string | number | null
                }
                config_version: number
                resource_config: {
                    loan_config_id: number
                    excluded_isolation_group_ids: number[]
                    efficiency_group_id: number
                }
            }
        }
        collateral_positions: {
            [resourceAddress: string]: {
                price: string | number | null
                amount: string | number | null
                value: string | number | null
                health_value: string | number | null
                liquidation_value: string | number | null
                discounted_value: string | number | null
                config: {
                    description: string
                    loan_to_value_ratio: string | number | null
                    liquidation_threshold_spread?: string | number | null
                    liquidation_bonus_rate?: string | number | null
                }
                config_version: {
                    entry_version: number
                    efficiency_mode?: {
                        variant_id: string
                        efficiency_group_id: number
                    }
                }
                resource_config: {
                    collateral_config_id: number
                    isolation_group_id: number
                    efficiency_group_ids: number[]
                }
                is_from_nft: boolean
            }
        }
        nft_collateral_positions?: {
            [nftResourceAddress: string]: {
                underlying_positions: {
                    [resourceAddress: string]: {
                        price: string | number | null
                        amount: string | number | null
                        value: string | number | null
                        health_value: string | number | null
                        liquidation_value: string | number | null
                        discounted_value: string | number | null
                        config: {
                            description: string
                            loan_to_value_ratio: string | number | null
                            liquidation_threshold_spread?:
                                | string
                                | number
                                | null
                            liquidation_bonus_rate?: string | number | null
                        }
                        config_version: {
                            entry_version: number
                            efficiency_mode?: {
                                variant_id: string
                                efficiency_group_id: number
                            }
                        }
                        resource_config: {
                            collateral_config_id: number
                            isolation_group_id: number
                            efficiency_group_ids: number[]
                        }
                        is_from_nft: boolean
                    }
                }
                value: {
                    value: string | number | null
                    discounted_value: string | number | null
                    loan_payment_value: string | number | null
                    compensation_value: string | number | null
                    liquidation_fee: string | number | null
                    resource_type: {
                        variantName: string
                    }
                }
                max_allowed_discounted_value: string | number | null
            }
        }
    }
}

export interface VolumeData {
    event_type: string
    interval: string
    res_address: string
    amount: number
    volume_usd: number
    volume_xrd: number
}

export class WeftApiClient {
    private baseUrl: string

    constructor(baseUrl: string = 'https://api.weft.finance') {
        this.baseUrl = baseUrl
    }

    async getLendingPools() {
        const prices = await this.getResourcePrices()

        return this.getPoolState(prices.map((price) => price.resourceAddress))
    }

    /**
     * Get the API index
     * @returns Promise with the index response
     */
    async getIndex(): Promise<WeftIndexResponse> {
        const response = await fetch(`${this.baseUrl}/`)

        if (!response.ok) {
            throw new Error(`Failed to fetch index: ${response.statusText}`)
        }

        return await response.json()
    }

    /**
     * Get resource prices valued in XRD
     * @param resourceAddresses Optional comma-separated list of resource addresses
     * @returns Promise with an array of resource prices
     */
    async getResourcePrices(
        resourceAddresses?: string
    ): Promise<ResourcePrice[]> {
        const url = new URL(`${this.baseUrl}/price`)

        if (resourceAddresses) {
            url.searchParams.append('resourceAddresses', resourceAddresses)
        }

        const response = await fetch(url.toString())

        if (!response.ok) {
            throw new Error(
                `Failed to fetch resource prices: ${response.statusText}`
            )
        }

        return await response.json()
    }

    /**
     * Get pool state for specified resources
     * @param resourceAddresses Optional comma-separated list of resource addresses
     * @returns Promise with an array of pool states
     */
    async getPoolState(resourceAddresses: string[]): Promise<PoolState[]> {
        const url = new URL(`${this.baseUrl}/pool`)

        if (resourceAddresses) {
            url.searchParams.append(
                'resourceAddresses',
                resourceAddresses.join(',')
            )
        }

        const response = await fetch(url.toString())

        if (!response.ok) {
            return []
        }

        return await response.json()
    }

    /**
     * Get staking state
     * @returns Promise with staking state information
     */
    async getStakingState(): Promise<StakingState | null> {
        const response = await fetch(`${this.baseUrl}/staking`)

        if (!response.ok) {
            console.error(
                `Failed to fetch staking state: ${response.statusText}`
            )
            return null
        }

        return await response.json()
    }

    /**
     * Get CDP data for specified IDs
     * @param ids Comma-separated list of IDs or ranges (e.g., 1,3-5,7)
     * @returns Promise with an array of CDP data
     */
    async getCDPData(ids: string): Promise<CDPData[]> {
        const response = await fetch(`${this.baseUrl}/cdp/${ids}`)

        if (!response.ok) {
            throw new Error(`Failed to fetch CDP data: ${response.statusText}`)
        }

        return await response.json()
    }

    /**
     * Get list of burned CDPs
     * @returns Promise with an array of burned CDP IDs
     */
    async getBurnedCDPs(): Promise<string[]> {
        const response = await fetch(`${this.baseUrl}/burned-cdp`)

        if (!response.ok) {
            throw new Error(
                `Failed to fetch burned CDPs: ${response.statusText}`
            )
        }

        return await response.json()
    }

    /**
     * Get volume data
     * @param options Optional parameters for filtering volume data
     * @returns Promise with volume data
     */
    async getVolumeData(options?: {
        interval?: '1D' | '1WEEK' | '1M' | '1YEAR' | 'ALL'
        eventTypes?: string[]
        groupByResource?: boolean
        startDate?: string
        endDate?: string
    }): Promise<VolumeData[]> {
        const url = new URL(`${this.baseUrl}/volume`)

        if (options) {
            if (options.interval) {
                url.searchParams.append('interval', options.interval)
            }

            if (options.eventTypes && options.eventTypes.length > 0) {
                options.eventTypes.forEach((eventType) => {
                    url.searchParams.append('eventTypes', eventType)
                })
            }

            if (options.groupByResource !== undefined) {
                url.searchParams.append(
                    'groupByResource',
                    options.groupByResource.toString()
                )
            }

            if (options.startDate) {
                url.searchParams.append('startDate', options.startDate)
            }

            if (options.endDate) {
                url.searchParams.append('endDate', options.endDate)
            }
        }

        const response = await fetch(url.toString())

        if (!response.ok) {
            throw new Error(
                `Failed to fetch volume data: ${response.statusText}`
            )
        }

        return await response.json()
    }
}

// Export a default instance with the standard API URL
export const WeftClient = new WeftApiClient()
