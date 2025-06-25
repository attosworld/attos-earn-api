import Decimal from 'decimal.js'
import { TOKEN_PRICE_CACHE } from '../getAllPools'
import { getDefiplazaStakingTokens } from './defiplaza'
import { getRootMarketStats } from './rootFinance'
import { WeftClient } from './weftFinance'
import { getFluxIncentivisedReservoir } from './fluxIlikeItStable'

export interface BaseStrategy {
    name: string
    symbol: string
    icon_url: string
    info_url: string
    resource_address: string
    bonus_type: 'APR' | 'APY'
    strategy_type: 'Lending' | 'Staking' | 'Liquidation'
    bonus_value: number | string
}

export interface LendingStrategy extends BaseStrategy {
    strategy_type: 'Lending'
    deposited: string | number
    loaned: string | number
}

export interface StakingStrategy extends BaseStrategy {
    strategy_type: 'Staking'
    total_stake: number
}

export interface LiquidationStrategy extends BaseStrategy {
    strategy_type: 'Liquidation'
    deposited: string | number
}

export type Strategy = LendingStrategy | StakingStrategy | LiquidationStrategy

export type StrategiesResponse = Strategy[]

export async function getV2Strategies() {
    const [weftPools, root, defiplazaStakeTokens, fluxReservoir] =
        await Promise.all([
            WeftClient.getLendingPools(),
            getRootMarketStats(),
            getDefiplazaStakingTokens(),
            getFluxIncentivisedReservoir(),
        ])

    const fluxRemapped = fluxReservoir.map((pool) => ({
        name: `${TOKEN_PRICE_CACHE[pool.resourceAddress].name} Flux Reservoir`,
        symbol: TOKEN_PRICE_CACHE[pool.resourceAddress].symbol,
        icon_url: TOKEN_PRICE_CACHE[pool.resourceAddress].icon_url,
        info_url: TOKEN_PRICE_CACHE[pool.resourceAddress].infoUrl,
        resource_address: pool.resourceAddress,
        provider: 'Flux',
        bonus_type: 'APR',
        bonus_value: pool.totalApr,
        strategy_type: 'Liquidation',
        deposited: pool.currentPoolSize,
    }))

    const weftRemapped = weftPools.map((pool) => ({
        name: TOKEN_PRICE_CACHE[pool.resourceAddress].name,
        symbol: TOKEN_PRICE_CACHE[pool.resourceAddress].symbol,
        icon_url: TOKEN_PRICE_CACHE[pool.resourceAddress].icon_url,
        info_url: TOKEN_PRICE_CACHE[pool.resourceAddress].infoUrl,
        resource_address: pool.resourceAddress,
        provider: 'Weft Finance',
        bonus_type: 'APR',
        bonus_value: new Decimal(pool.netLendingApr).mul(100).toFixed(2),
        strategy_type: 'Lending',
        deposited: pool.totalDeposit,
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
        provider: 'Root Finance',
        bonus_value: root?.assets[assetKey].lendingAPY ?? 0,
        deposited: root?.assets[assetKey].totalSupply.value,
        loaned: root?.assets[assetKey].totalBorrow.value,
    }))

    const defiplazaRemapped = defiplazaStakeTokens.map((token) => ({
        name: TOKEN_PRICE_CACHE[token.token].name,
        symbol: TOKEN_PRICE_CACHE[token.token].symbol,
        icon_url: TOKEN_PRICE_CACHE[token.token].icon_url,
        info_url: token.infoUrl,
        resource_address: token.sToken,
        provider: 'Defiplaza',
        bonus_type: 'APY',
        bonus_value: new Decimal(token.intervalAmount.trim())
            .mul(new Decimal(52).dividedBy(token.interval.trim()))
            .dividedBy(token.totalStake)
            .mul(100)
            .toFixed(2),
        strategy_type: 'Staking',
        total_stake: token.totalStakeUSD,
    }))

    const allStrategies = [
        ...weftRemapped,
        ...rootRemapped,
        ...defiplazaRemapped,
        ...fluxRemapped,
    ] as StrategiesResponse

    return allStrategies.filter((a) => {
        return (
            (a.strategy_type === 'Lending' &&
                new Decimal(a.deposited).gt(100)) ||
            (a.strategy_type === 'Staking' &&
                new Decimal(a.total_stake).gt(100)) ||
            a.strategy_type === 'Liquidation'
        )
    })
}

function sortStrategiesByBonusAndTotal(
    strategies: StrategiesResponse
): StrategiesResponse {
    return [...strategies].sort((a, b) => {
        // First compare by deposited/total_stake
        const aValue =
            a.strategy_type === 'Lending'
                ? new Decimal((a as LendingStrategy).deposited ?? '0')
                : new Decimal((a as StakingStrategy).total_stake ?? '0')

        const bValue =
            b.strategy_type === 'Lending'
                ? new Decimal((b as LendingStrategy).deposited ?? '0')
                : new Decimal((b as StakingStrategy).total_stake ?? '0')

        const valueComparison = bValue.comparedTo(aValue)

        // If deposited/total_stake values are equal, then compare by bonus_value
        if (valueComparison === 0) {
            return new Decimal(b.bonus_value ?? '0').comparedTo(
                new Decimal(a.bonus_value ?? '0')
            )
        }

        // Otherwise return the value comparison result
        return valueComparison
    })
}
