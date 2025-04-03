import fetch from 'node-fetch'

// Types for the response
export interface PoolState {
    address: string
    unit_to_asset_ratio: string
    ratio_loan: string
    total_loan_unit: string
    total_loan: string
    ratio_deposit: string
    total_deposit_unit: string
    total_deposit: string
    total_reserved_amount: string
}

export interface RootFinancePoolStateResponse {
    states: PoolState[]
}

export async function getRootFinancePoolState(): Promise<RootFinancePoolStateResponse> {
    try {
        const response = await fetch(
            'https://backend-prod.rootfinance.xyz/api/markets/pool-state',
            {
                headers: {
                    accept: 'application/json, text/plain, */*',
                },
                method: 'GET',
            }
        )

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        return (await response.json()) as RootFinancePoolStateResponse
    } catch (error) {
        console.error('Error fetching Root Finance pool state:', error)
        throw error
    }
}
