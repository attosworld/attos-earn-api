import { XRD_RESOURCE_ADDRESS } from './resourceAddresses'

export type TimeFrames = {
    '1h': string
    '24h': string
    '7d': string
}

export type TimeFramesWithTotal = TimeFrames & {
    total: string
}

export type TimeFramesWithNow = TimeFrames & {
    now: string
}

export interface TokenInfo {
    address: string
    icon_url: string
    name: string
    slug: string
    symbol: string
}

export interface FeeInfo {
    token: TimeFramesWithTotal
    usd: TimeFramesWithTotal
    xrd: TimeFramesWithTotal
}

export interface LiquidityInfo {
    token: TimeFramesWithNow
    usd: TimeFramesWithNow
    xrd: TimeFramesWithNow
}

export interface PriceInfo {
    token: TimeFramesWithNow
    usd: TimeFramesWithNow
    xrd: TimeFramesWithNow
}

export interface TotalValueLocked {
    token: TimeFramesWithNow
    usd: TimeFramesWithNow
    xrd: TimeFramesWithNow
}

export interface VolumeInfo {
    '1h': string
    '24h': string
    '7d': string
    total: string
}

export interface TokenData {
    fee: FeeInfo
    liquidity: LiquidityInfo
    price: PriceInfo
    token: TokenInfo
    total_value_locked: TotalValueLocked
    volume: VolumeInfo
}

export interface OciswapPool {
    address: string
    apr: TimeFrames
    base_token: string
    blueprint_name: string
    created_at: string
    fee: {
        usd: TimeFramesWithTotal
        xrd: TimeFramesWithTotal
    }
    fee_rate: string
    liquidity: LiquidityInfo
    lp_token_address: string
    name: string
    pool_type: string
    rank: number
    slug: string
    total_value_locked: {
        usd: TimeFramesWithNow
        xrd: TimeFramesWithNow
    }
    version: string
    volume: {
        usd: TimeFramesWithTotal
        xrd: TimeFramesWithTotal
    }
    x: TokenData
    y: TokenData
}

export async function ociswapPools(items: OciswapPool[] = [], cursor?: string) {
    const options = { method: 'GET', headers: { accept: 'application/json' } }

    const response = await fetch(
        `https://api.ociswap.com/pools?cursor=${cursor || 0}&limit=100&order=rank&direction=asc`,
        options
    )
        .then(
            (res) =>
                res.json() as Promise<{
                    data: OciswapPool[]
                    next_cursor: string
                }>
        )
        .catch((err) => console.error(err))

    if (response?.next_cursor) {
        return ociswapPools([...items, ...response.data], response.next_cursor)
    }

    if (response) {
        return [...items, ...(response as { data: OciswapPool[] }).data]
    }

    return items
}

export interface OciswapLPInfo {
    x_address: string
    y_address: string
    x_amount: {
        token: string
        xrd: string
        usd: string
    }
    y_amount: {
        token: string
        xrd: string
        usd: string
    }
    liquidity_amount: string
}

export async function getOciswapLpInfo(
    lpPoolComponent: string,
    amount: string,
    leftBound?: number,
    rightBound?: number
) {
    const bounds =
        leftBound && rightBound
            ? `&left_bound=${leftBound}&right_bound=${rightBound}`
            : ''

    const lpInfo = await fetch(
        `https://api.ociswap.com/preview/remove-liquidity?pool_address=${lpPoolComponent}&liquidity_amount=${amount}${bounds}`
    ).then((response) => response.json() as Promise<OciswapLPInfo>)

    if (lpInfo && 'error' in lpInfo) {
        return
    }

    return lpInfo
}

interface OciswapTokenInfo {
    address: string
    description: string
    icon_url: string
    info_url: string
    links: Array<{ type: string; url: string }>
    liquidity: {
        token: Record<string, string>
        usd: Record<string, string>
        xrd: Record<string, string>
    }
    listed_at: string
    market_cap: {
        circulating: {
            usd: Record<string, string>
            xrd: Record<string, string>
        }
        fully_diluted: {
            usd: Record<string, string>
            xrd: Record<string, string>
        }
    }
    name: string
    price: {
        usd: Record<string, string>
        xrd: Record<string, string>
    }
    rank: number
    slug: string
    supply: {
        burnable: boolean
        circulating: string
        divisbility: number
        mintable: boolean
        total: string
    }
    symbol: string
    total_value_locked: {
        token: Record<string, string>
        usd: Record<string, string>
        xrd: Record<string, string>
    }
    volume: {
        token: Record<string, string>
        usd: Record<string, string>
        xrd: Record<string, string>
    }
}

export async function getOciswapTokenInfo(
    tokenAddress: string
): Promise<OciswapTokenInfo> {
    const url = `https://api.ociswap.com/tokens/${tokenAddress}`

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                accept: 'application/json',
            },
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data: OciswapTokenInfo = await response.json()
        return data
    } catch (error) {
        console.error('Error fetching token info:', error)
        throw error
    }
}

interface OciswapPoolDetails {
    address: string
    apr: TimeFrames
    base_token: string
    blueprint_name: string
    created_at: string
    fee: {
        usd: TimeFramesWithTotal
        xrd: TimeFramesWithTotal
    }
    fee_rate: string
    liquidity: LiquidityInfo
    lp_token_address: string
    name: string
    pool_type: string
    rank: number
    slug: string
    total_value_locked: {
        usd: TimeFramesWithNow
        xrd: TimeFramesWithNow
    }
    version: string
    volume: {
        usd: TimeFramesWithTotal
        xrd: TimeFramesWithTotal
    }
    x: TokenData
    y: TokenData
}

export async function getOciswapPoolDetails(
    poolIdentifier: string
): Promise<OciswapPoolDetails | null> {
    const url = `https://api.ociswap.com/pools/${poolIdentifier}`

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                accept: 'application/json',
            },
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data: OciswapPoolDetails = await response.json()
        return data
    } catch (error) {
        console.error('Error fetching Ociswap pool details:', error)
        return null
    }
}

// Add this interface to your existing types
export interface TokenAmount {
    token: string
    xrd: string
    usd: string
}

// Add this interface for the add liquidity preview response
export interface AddLiquidityPreview {
    x_amount: TokenAmount
    y_amount: TokenAmount
    liquidity_amount: string
}

export async function getOciswapAddLiquidityPreview(
    poolAddress: string,
    xAmount?: string,
    yAmount?: string,
    leftBound?: string | null,
    rightBound?: string | null
): Promise<AddLiquidityPreview | null> {
    let url = `https://api.ociswap.com/preview/add-liquidity?pool_address=${poolAddress}`

    if (xAmount) {
        url += `&x_amount=${xAmount}`
    }
    if (yAmount) {
        url += `&y_amount=${yAmount}`
    }
    if (leftBound) {
        url += `&left_bound=${leftBound}`
    }
    if (rightBound) {
        url += `&right_bound=${rightBound}`
    }

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                accept: 'application/json',
            },
        })

        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`)
            console.error(`HTTP error! json: ${await response.text()}`)
        }

        const data: AddLiquidityPreview = await response.json()
        return data
    } catch (error) {
        console.error('Error fetching Ociswap add liquidity preview:', error)
        return null
    }
}

export function buyFromOciToken(dexAddress: string): string {
    return `
TAKE_FROM_WORKTOP
  Address("${XRD_RESOURCE_ADDRESS}")
  Decimal("{buyTokenAmount}")
  Bucket("xrd")
;
CALL_METHOD
  Address("${dexAddress}")
  "swap"
  Bucket("xrd")
;
`
}

interface Swap {
    input_address: string
    input_amount: TokenAmount
    input_take: string
    output_address: string
    output_amount: TokenAmount
    input_fee_lp: TokenAmount
    input_fee_settlement: TokenAmount
    price_impact: string
    pool_address: string
    protocol: string
}

interface SwapPreview {
    input_address: string
    input_amount: TokenAmount
    output_address: string
    output_amount: TokenAmount
    input_fee_lp: TokenAmount
    input_fee_settlement: TokenAmount
    price_impact: string
    swaps: Swap[]
}

export async function getOciswapSwapPreview(
    inputAddress: string,
    inputAmount: string,
    outputAddress: string,
    outputAmount: string
): Promise<SwapPreview | null> {
    const url = new URL('https://api.ociswap.com/preview/swap')
    if (inputAddress) {
        url.searchParams.append('input_address', inputAddress)
    }
    if (inputAmount) {
        url.searchParams.append('input_amount', inputAmount)
    }
    if (outputAddress) {
        url.searchParams.append('output_address', outputAddress)
    }
    if (outputAmount) {
        url.searchParams.append('output_amount', outputAmount)
    }

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            accept: 'application/json',
        },
    })

    if (!response.ok) {
        console.error(url)
        console.error(`swap preview HTTP error! status: ${response.status}`)
        console.error(await response.text())
        return null
    }

    return (await response.json()) as SwapPreview
}
