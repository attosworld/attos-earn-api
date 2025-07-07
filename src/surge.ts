export interface SurgeStats {
    apy: {
        start_datetime: string
        tooltip: {
            'Approx LP Rewards': number
            'Trade Fees': number
        }
        value: number
    }
    data: {
        pool_now: {
            datetime: string
            price: number
            total_amount: number
            total_supply: number
        }
        pool_past: {
            datetime: string
            price: number
            total_amount: number
            total_supply: number
        }
    }
    fees_pool: {
        '24hours': string
        '30days': string
        '7days': string
        all_time: string
    }
    fees_protocol: {
        '24hours': string
        '30days': string
        '7days': string
        all_time: string
    }
    last_updated: string
    tvl: number
    volume: {
        '24hours': string
        '30days': string
        '7days': string
        all_time: string
    }
}

export async function getSurgeStats() {
    return fetch('https://api.surge.trade/stats')
        .then((res) => res.json() as Promise<SurgeStats>)
        .catch(() => null)
}
