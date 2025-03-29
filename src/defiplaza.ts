export interface DefiplazaPool {
  address: string;
  dexAddress: string;
  baseToken: string;
  quoteToken: string;
  basePool: string;
  quotePool: string;
  baseAPY: number;
  quoteAPY: number;
  baseTVL: number;
  quoteTVL: number;
  tvlUSD: number;
  volume: number;
};

export async function getDefiplazaPools() {
  const options = { method: 'GET', headers: { accept: 'application/json' } };

  return fetch('https://radix.defiplaza.net/api/pairs', options)
   .then(res => res.json() as Promise<{ data: DefiplazaPool[] }>)
   .catch(err => console.error(err));
}

export interface DefiPlazaLPInfo {
  isBase: boolean;
  baseAmount: number;
  quoteAmount: number;
  baseToken: string;
  quoteToken: string;
}

export async function defiplazaLpInfo(lpResource: string, amount: string) {
  const lpInfo = await fetch(
    `https://radix.defiplaza.net/api/lp/${lpResource}?amount=${amount}`,
  )
    .then((response) => response.json() as Promise<DefiPlazaLPInfo>)
    .catch(() => null);

  return lpInfo;
}

export interface DefiplazaPairAnalytics {
  pair: {
    address: string;
    dexAddress: string;
    baseToken: string;
    quoteToken: string;
    basePool: string;
    quotePool: string;
    baseLPToken: string;
    quoteLPToken: string;
    baseAPY: number;
    quoteAPY: number;
    baseAPY7D: number;
    quoteAPY7D: number;
    config: {
      k_in: string;
      k_out: string;
      fee: string;
      decay_factor: string;
    };
    baseVolume24H: number;
    quoteVolume24H: number;
    bidPrice: number;
    askPrice: number;
    lastPrice: number;
    baseTVL: number;
    quoteTVL: number;
    tvlUSD: number;
    createdAt: string;
    updatedAt: string;
    updatedAPYAt: string;
    stateVersion: number;
  };
  baseToken: {
    address: string;
    symbol: string;
    name: string;
    description: string;
    iconUrl: string;
    infoUrl: string;
    divisibility: number;
    bidPrice: number;
    askPrice: number;
    lastPrice: number;
    tvlUSD: number;
  };
  stats: Array<{
    date: number;
    stateVersion: number;
    totalValueLockedUSD: number;
    volumeUSD: number;
    feesUSD: number;
    lpBaseUSD: number;
    lpQuoteUSD: number;
  }>;
}

export async function getVolumeAndTokenMetadata(basePair: string) {
  return fetch(`https://radix.defiplaza.net/api/analytics/pair/${basePair}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
  }).then(res => res.json() as Promise<DefiplazaPairAnalytics>)
    .then(data => ({
    alr_24h: data.pair.baseAPY,
    alr_7d: data.pair.baseAPY7D,
    tvl_usd: data.pair.tvlUSD,
    volume_24h: data.stats[0].volumeUSD,
    volume_7d: data.stats.slice(0, 6).reduce((acc, curr) => acc + curr.volumeUSD, 0),
    left_alt: data.baseToken.symbol,
    right_alt: data.baseToken.symbol,
    left_icon: data.baseToken.iconUrl,
    right_icon: data.baseToken.iconUrl,
    left_name: data.baseToken.name,
    right_name: data.baseToken.name,
    baseLPToken: data.pair.baseLPToken,
    quoteLPToken: data.pair.quoteLPToken,
  }))
    .catch(() => null);
}
