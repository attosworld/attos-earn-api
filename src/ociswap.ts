export type TimeFrames = {
  "1h": string;
  "24h": string;
  "7d": string;
};

export type TimeFramesWithTotal = TimeFrames & {
  total: string;
};

export type TimeFramesWithNow = TimeFrames & {
  now: string;
};

export interface TokenInfo {
  address: string;
  icon_url: string;
  name: string;
  slug: string;
  symbol: string;
}

export interface FeeInfo {
  token: TimeFramesWithTotal;
  usd: TimeFramesWithTotal;
  xrd: TimeFramesWithTotal;
}

export interface LiquidityInfo {
  token: TimeFramesWithNow;
  usd: TimeFramesWithNow;
  xrd: TimeFramesWithNow;
}

export interface PriceInfo {
  token: TimeFramesWithNow;
  usd: TimeFramesWithNow;
  xrd: TimeFramesWithNow;
}

export interface TotalValueLocked {
  token: TimeFramesWithNow;
  usd: TimeFramesWithNow;
  xrd: TimeFramesWithNow;
}

export interface VolumeInfo {
  "1h": string;
  "24h": string;
  "7d": string;
  total: string;
}

export interface TokenData {
  fee: FeeInfo;
  liquidity: LiquidityInfo;
  price: PriceInfo;
  token: TokenInfo;
  total_value_locked: TotalValueLocked;
  volume: VolumeInfo;
}

export interface OciswapPool {
  address: string;
  apr: TimeFrames;
  base_token: string;
  blueprint_name: string;
  created_at: string;
  fee: {
    usd: TimeFramesWithTotal;
    xrd: TimeFramesWithTotal;
  };
  fee_rate: string;
  liquidity: LiquidityInfo;
  lp_token_address: string;
  name: string;
  pool_type: string;
  rank: number;
  slug: string;
  total_value_locked: {
    usd: TimeFramesWithNow;
    xrd: TimeFramesWithNow;
  };
  version: string;
  volume: {
    usd: TimeFramesWithTotal;
    xrd: TimeFramesWithTotal;
  };
  x: TokenData;
  y: TokenData;
}

export async function ociswapPools(items: OciswapPool[] = [], cursor?: string) {
  const options = {method: 'GET', headers: {accept: 'application/json'}};

  const response = await fetch(`https://api.ociswap.com/pools?cursor=${cursor || 0}&limit=100&order=rank&direction=asc`, options)
  .then(res => res.json() as Promise<{ data: OciswapPool[], next_cursor: string}>)
  .catch(err => console.error(err));

  if (response?.next_cursor) {
    return ociswapPools([...items, ...response.data], response.next_cursor);
  }

  if (response) {
    return [...items,...(response as { data: OciswapPool[] }).data];
  }

  return items;
}


export interface OciswapLPInfo {
  x_address: string;
  y_address: string;
  x_amount: {
    token: string;
    xrd: string;
    usd: string;
  };
  y_amount: {
    token: string;
    xrd: string;
    usd: string;
  };
  liquidity_amount: string;
}

export async function getOciswapLpInfo(
  lpPoolComponent: string,
  amount: string,
  leftBound?: number,
  rightBound?: number,
) {
  const bounds =
    leftBound && rightBound
      ? `&left_bound=${leftBound}&right_bound=${rightBound}`
      : "";

  const lpInfo = await fetch(
    `https://api.ociswap.com/preview/remove-liquidity?pool_address=${lpPoolComponent}&liquidity_amount=${amount}${bounds}`,
  )
    .then((response) => response.json() as Promise<OciswapLPInfo>)
    .catch(() => null);

  if (lpInfo && 'error' in lpInfo) {
    return null;
  }

  return lpInfo;
}
