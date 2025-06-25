import { TOKEN_PRICE_CACHE } from '../getAllPools'
import { getDefiplazaStakingTokens } from './defiplaza'
import { getRootMarketStats } from './rootFinance'
import { WeftClient } from './weftFinance'

export async function handleV2Strategies() {
    const [weftPools, root, defiplazaStakeTokens] = await Promise.all([
        WeftClient.getLendingPools(),
        getRootMarketStats(),
        getDefiplazaStakingTokens(),
    ])

    const weftRemapped = weftPools.map((pool) => ({
        name: TOKEN_PRICE_CACHE[pool.resourceAddress].name,
        symbol: TOKEN_PRICE_CACHE[pool.resourceAddress].symbol,
        icon_url: TOKEN_PRICE_CACHE[pool.resourceAddress].icon_url,
        info_url: TOKEN_PRICE_CACHE[pool.resourceAddress].infoUrl,
        resource_address: pool.resourceAddress,
        bonus_type: 'APR',
        bonus_value: pool.netLendingApr,
        strategy_type: 'Lending',
        borrowed: pool.totalDeposit,
        loaned: pool.totalLoan,
    }))

    const rootRemapped = Object.keys(root?.assets || {}).map((assetKey) => ({
        name: TOKEN_PRICE_CACHE[root?.assets[assetKey].resource || ''].name,
        symbol: TOKEN_PRICE_CACHE[root?.assets[assetKey].resource || ''].symbol,
        icon_url:
            TOKEN_PRICE_CACHE[root?.assets[assetKey].resource || ''].icon_url,
        info_url:
            TOKEN_PRICE_CACHE[root?.assets[assetKey].resource || ''].infoUrl,
        resource_address: root?.assets[assetKey].resource || '',
        bonus_type: 'APY',
        strategy_type: 'Lending',
        bonus_value: root?.assets[assetKey].lendingAPY,
        borrowed: root?.assets[assetKey].totalSupply.value,
        loaned: root?.assets[assetKey].totalBorrow.value,
    }))

    const defiplazaRemapped = defiplazaStakeTokens.map((token) => ({
        name: TOKEN_PRICE_CACHE[token.token].name,
        symbol: TOKEN_PRICE_CACHE[token.token].symbol,
        icon_url: TOKEN_PRICE_CACHE[token.token].icon_url,
        info_url: token.infoUrl,
        resource_address: token.sToken,
        bonus_type: 'APY',
        bonus_value: new Decimal(token.intervalAmount)
            .mul(new Decimal(52).dividedBy(token.interval))
            .dividedBy(new Decimal(token.totalStake))
            .toFixed(2),
        strategy_type: 'Staking',
        total_stake: token.totalStakeUSD,
    }))

    return new Response(
        JSON.stringify([
            ...weftRemapped,
            ...rootRemapped,
            ...defiplazaRemapped,
        ]),
        {
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
            },
        }
    )
}
