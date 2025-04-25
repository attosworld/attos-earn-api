import {
    XRD_RESOURCE_ADDRESS,
    XUSDC_RESOURCE_ADDRESS,
} from './resourceAddresses'

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
): Promise<OciswapTokenInfo | null> {
    const url = `https://api.ociswap.com/tokens/${tokenAddress}`

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                accept: 'application/json',
            },
        })

        if (!response.ok) {
            console.error(
                `getOciswapTokenInfo : HTTP error! status: ${response.status}`
            )
            return null
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
            console.error(
                `getOciswapPoolDetails : HTTP error! status: ${response.status}`
            )
            return null
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
            console.error(
                `getOciswapAddLiquidityPreview : HTTP error! json: ${await response.text()}`
            )
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

interface PoolInfo {
    address: string
    name: string
    slug: string
    fee_rate: string
    x: TokenInfo
    y: TokenInfo
    base_token: 'x' | 'y'
}

interface Bound {
    price: string
    tick: number
}

interface SwapTokenInfo {
    price: TokenAmount
    amount: TokenAmount
    fee: TokenAmount
}

interface SwapVolumeFee {
    xrd: string
    usd: string
}

interface InstantiatePoolEvent {
    type: 'instantiate_pool'
    timestamp: string
    transaction_id: string
    pool: PoolInfo
}

interface AddLiquidityEvent {
    type: 'add_liquidity'
    timestamp: string
    transaction_id: string
    pool: PoolInfo
    left_bound: Bound
    right_bound: Bound
    lp_nft_id: string
    x: TokenAmount
    y: TokenAmount
    liquidity: TokenAmount
}

interface RemoveLiquidityEvent {
    type: 'remove_liquidity'
    timestamp: string
    transaction_id: string
    pool: PoolInfo
    lp_nft_id: string
    x: TokenAmount
    y: TokenAmount
    liquidity: TokenAmount
}

interface SwapEvent {
    type: 'swap'
    swap_type: 'buy_x' | 'buy_y'
    timestamp: string
    transaction_id: string
    pool: PoolInfo
    x: SwapTokenInfo
    y: SwapTokenInfo
    volume: SwapVolumeFee
    fee: SwapVolumeFee
}

type PoolEvent =
    | InstantiatePoolEvent
    | AddLiquidityEvent
    | RemoveLiquidityEvent
    | SwapEvent

interface PoolEventsResponse {
    data: PoolEvent[]
    next_cursor: number | null
}

export async function getOciswapPoolEvents(
    poolIdentifier: string,
    days: number = 7,
    items: PoolEvent[] = [],
    cursor: number = 0,
    limit: number = 100
): Promise<PoolEvent[]> {
    const options = { method: 'GET', headers: { accept: 'application/json' } }
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    try {
        const response = await fetch(
            `https://api.ociswap.com/pools/${poolIdentifier}/events?cursor=${cursor}&limit=${limit}`,
            options
        )

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = (await response.json()) as PoolEventsResponse

        const filteredEvents = result.data.filter(
            (event) => new Date(event.timestamp) >= cutoffDate
        )
        const newItems = [...items, ...filteredEvents]

        if (
            result.next_cursor !== null &&
            filteredEvents.length === result.data.length
        ) {
            // If there's a next cursor and we haven't reached the cutoff date, make a recursive call
            return getOciswapPoolEvents(
                poolIdentifier,
                days,
                newItems,
                result.next_cursor,
                limit
            )
        }

        // If there's no next cursor or we've reached the cutoff date, return the accumulated items
        return newItems
    } catch (err) {
        console.error('Error fetching Ociswap pool events:', err)
        // In case of an error, return the items collected so far
        return items
    }
}

export async function getOciswapPoolVolumePerDay(
    poolIdentifier: string,
    days: number = 7
): Promise<{ pool: string; volume: number[] }> {
    const events = await getOciswapPoolEvents(poolIdentifier, days)

    // Create a map to store volume per day
    const volumePerDay = new Map<string, number>()

    // Initialize the last 'days' number of days with 0 volume
    const now = new Date()
    for (let i = 0; i < days; i++) {
        const date = new Date(now)
        date.setDate(now.getDate() - i)
        const dateString = date.toISOString().split('T')[0]
        volumePerDay.set(dateString, 0)
    }

    // Process swap events
    events.forEach((event) => {
        if (event.type === 'swap') {
            const date = new Date(event.timestamp)
            const dateString = date.toISOString().split('T')[0]

            if (volumePerDay.has(dateString)) {
                const currentVolume = volumePerDay.get(dateString) || 0
                const eventVolume = parseFloat(event.volume.usd)
                volumePerDay.set(dateString, currentVolume + eventVolume)
            }
        }
    })

    // Convert map to array, sorted from oldest to newest
    const sortedVolumes = Array.from(volumePerDay.entries())
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .map((entry) => entry[1])

    return { pool: poolIdentifier, volume: sortedVolumes }
}

export function closeOciswapLpPosition({
    nonXrd,
    lpAddress,
    lpAmount,
    lpComponent,
    account,
    rootNftId,
    swapComponent,
    lendAmount,
}: {
    nonXrd: string
    lpAddress: string
    lpAmount: string
    lpComponent: string
    account: string
    rootNftId: string
    swapComponent: string
    lendAmount: string
}) {
    return `CALL_METHOD
  Address("${account}")
  "withdraw"
  Address("${lpAddress}")
  Decimal("${lpAmount}")
;
TAKE_ALL_FROM_WORKTOP
  Address("${lpAddress}")
  Bucket("surge_lp")
;
CALL_METHOD
  Address("${lpComponent}")
  "remove_liquidity"
  Bucket("surge_lp")
;
TAKE_ALL_FROM_WORKTOP
  Address("${nonXrd}")
  Bucket("left_token")
;
CALL_METHOD
    Address("${swapComponent}")
    "swap"
    Bucket("left_token")
;
TAKE_ALL_FROM_WORKTOP
    Address("${XRD_RESOURCE_ADDRESS}")
    Bucket("xrd")
;
CALL_METHOD
  Address("${account}")
  "create_proof_of_non_fungibles"
  Address("resource_rdx1ngekvyag42r0xkhy2ds08fcl7f2ncgc0g74yg6wpeeyc4vtj03sa9f")
  Array<NonFungibleLocalId>(
    NonFungibleLocalId("${rootNftId}")
  )
;
POP_FROM_AUTH_ZONE
  Proof("root_nft")
;
CLONE_PROOF
  Proof("root_nft")
  Proof("root_nft_2")
;
CALL_METHOD
  Address("component_rdx1crwusgp2uy9qkzje9cqj6pdpx84y94ss8pe7vehge3dg54evu29wtq")
  "repay"
  Proof("root_nft")
  Enum<0u8>()
  Array<Bucket>(
    Bucket("xrd")
  )
;
CALL_METHOD
  Address("component_rdx1crwusgp2uy9qkzje9cqj6pdpx84y94ss8pe7vehge3dg54evu29wtq")
  "remove_collateral"
  Proof("root_nft_2")
  Array<Tuple>(
    Tuple(
      Address("${XUSDC_RESOURCE_ADDRESS}"),
      Decimal("${lendAmount}"),
      false
    )
  )
;
CALL_METHOD
  Address("${account}")
  "deposit_batch"
  Expression("ENTIRE_WORKTOP")
;`
}

export function closeOciswapLpValue({
    nonXrd,
    lpAddress,
    lpAmount,
    lpComponent,
    account,
    swapComponent,
}: {
    nonXrd: string
    lpAddress: string
    lpAmount: string
    lpComponent: string
    account: string
    swapComponent: string
}) {
    return `CALL_METHOD
  Address("${account}")
  "withdraw"
  Address("${lpAddress}")
  Decimal("${lpAmount}")
;
TAKE_ALL_FROM_WORKTOP
  Address("${lpAddress}")
  Bucket("surge_lp")
;
CALL_METHOD
  Address("${lpComponent}")
  "remove_liquidity"
  Bucket("surge_lp")
;
TAKE_ALL_FROM_WORKTOP
  Address("${nonXrd}")
  Bucket("left_token")
;
CALL_METHOD
    Address("${swapComponent}")
    "swap"
    Bucket("left_token")
;
CALL_METHOD
  Address("${account}")
  "deposit_batch"
  Expression("ENTIRE_WORKTOP")
;`
}
