import Decimal from 'decimal.js'
import { TOKEN_PRICE_CACHE } from './getAllPools'
import { getDefiplazaStakingTokens } from './defiplaza'
import { getRootMarketStats } from './rootFinance'
import { WeftClient } from './weftFinance'
import { getFluxIncentivisedReservoir } from './fluxIlikeItStable'
import {
    WEFT_RESOURCE_ADDRESS,
    XRD_RESOURCE_ADDRESS,
} from './resourceAddresses'
import { stakeImplementationMethod } from './stakingStrategyV2'

export interface BaseStrategy {
    name: string
    symbol: string
    icon_url: string
    info_url: string
    resource_address: string
    bonus_type: 'APR' | 'APY'
    strategy_type: 'Lending' | 'Staking' | 'Liquidation'
    bonus_value: number
    provider: 'Flux' | 'Defiplaza' | 'Weft Finance' | 'Root Finance'
    requiredAssets: { resource_address: string; symbol: string }[]
    rewardTokens: string[]
}

export interface LendingStrategy extends BaseStrategy {
    strategy_type: 'Lending'
    deposited: number
    loaned: number
}

export interface StakingStrategy extends BaseStrategy {
    strategy_type: 'Staking'
    total_stake: number
    sToken: string
    stakeComponent: string
    stakeMethod: string
    requireOptionalProof?: boolean
}

export interface LiquidationStrategy extends BaseStrategy {
    strategy_type: 'Liquidation'
    deposited: string | number
    reservoirComponent: string
}

export type Strategy = LendingStrategy | StakingStrategy | LiquidationStrategy

export type StrategiesResponse = Strategy[]

export async function getV2Strategies() {
    const [weftPools, root, defiplazaStakeTokens, fluxReservoir, weftStaking] =
        await Promise.all([
            WeftClient.getLendingPools(),
            getRootMarketStats(),
            getDefiplazaStakingTokens(),
            getFluxIncentivisedReservoir(),
            WeftClient.getStakingState(),
        ])

    const fluxRemapped: LiquidationStrategy[] = fluxReservoir.map((pool) => ({
        name: `${TOKEN_PRICE_CACHE[pool.resourceAddress].name} Flux Reservoir`,
        symbol: TOKEN_PRICE_CACHE[pool.resourceAddress].symbol,
        icon_url: TOKEN_PRICE_CACHE[pool.resourceAddress].icon_url,
        info_url: TOKEN_PRICE_CACHE[pool.resourceAddress].infoUrl,
        resource_address: pool.resourceAddress,
        reservoirComponent: pool.reservoirComponent,
        provider: 'Flux',
        bonus_type: 'APR',
        bonus_value: pool.totalApr,
        strategy_type: 'Liquidation',
        deposited: pool.currentPoolSize,
        requiredAssets: [
            { resource_address: XRD_RESOURCE_ADDRESS, symbol: 'XRD' },
        ],
        rewardTokens: ['fUSD'],
    }))

    const weftRemapped: LendingStrategy[] = weftPools.map((pool) => ({
        name: TOKEN_PRICE_CACHE[pool.resourceAddress].name,
        symbol: TOKEN_PRICE_CACHE[pool.resourceAddress].symbol,
        icon_url: TOKEN_PRICE_CACHE[pool.resourceAddress].icon_url,
        info_url: TOKEN_PRICE_CACHE[pool.resourceAddress].infoUrl,
        resource_address: pool.resourceAddress,
        provider: 'Weft Finance',
        bonus_type: 'APR',
        bonus_value: +new Decimal(pool.netLendingApr).mul(100).toFixed(2),
        strategy_type: 'Lending',
        deposited: +new Decimal(pool.totalDeposit)
            .mul(TOKEN_PRICE_CACHE[pool.resourceAddress].tokenPriceUSD)
            .toFixed(2),
        loaned: +pool.totalLoan,
        requiredAssets: [
            { resource_address: XRD_RESOURCE_ADDRESS, symbol: 'XRD' },
        ],
        rewardTokens: [TOKEN_PRICE_CACHE[pool.resourceAddress].symbol],
    }))

    const rootRemapped: LendingStrategy[] = Object.keys(root?.assets || {}).map(
        (assetKey) => ({
            name: TOKEN_PRICE_CACHE[root?.assets[assetKey].resource || ''].name,
            symbol: TOKEN_PRICE_CACHE[root?.assets[assetKey].resource || '']
                .symbol,
            icon_url:
                TOKEN_PRICE_CACHE[root?.assets[assetKey].resource || '']
                    .icon_url,
            info_url:
                TOKEN_PRICE_CACHE[root?.assets[assetKey].resource || '']
                    .infoUrl,
            resource_address: root?.assets[assetKey].resource || '',
            bonus_type: 'APY',
            strategy_type: 'Lending',
            provider: 'Root Finance',
            bonus_value: root?.assets[assetKey].lendingAPY ?? 0,
            deposited: root?.assets[assetKey].totalSupply.value || 0,
            loaned: root?.assets[assetKey].totalBorrow.value || 0,
            requiredAssets: [
                { resource_address: XRD_RESOURCE_ADDRESS, symbol: 'XRD' },
            ],
            rewardTokens: [
                TOKEN_PRICE_CACHE[root?.assets[assetKey].resource || ''].symbol,
            ],
        })
    )

    const stakingImplementations = await stakeImplementationMethod({
        resourceAddresses: [WEFT_RESOURCE_ADDRESS],
    })

    const defiplazaStakingRemapped: StakingStrategy[] =
        defiplazaStakeTokens.map((token) => ({
            name: TOKEN_PRICE_CACHE[token.token].name,
            symbol: TOKEN_PRICE_CACHE[token.token].symbol,
            icon_url: TOKEN_PRICE_CACHE[token.token].icon_url,
            sToken: token.sToken,
            info_url: token.infoUrl,
            resource_address: token.token,
            provider: 'Defiplaza',
            bonus_type: 'APY',
            bonus_value: +new Decimal(token.intervalAmount.trim())
                .mul(new Decimal(52).dividedBy(token.interval.trim()))
                .dividedBy(token.totalStake)
                .mul(100)
                .toFixed(2),
            strategy_type: 'Staking',
            total_stake: token.totalStakeUSD,
            requiredAssets: [
                { resource_address: XRD_RESOURCE_ADDRESS, symbol: 'XRD' },
            ],
            rewardTokens: [TOKEN_PRICE_CACHE[token.token].symbol],
            stakeComponent: token.address,
            stakeMethod: 'add_stake',
            requireOptionalProof: false,
        }))

    const allStrategies = [
        ...weftRemapped,
        ...rootRemapped,
        ...defiplazaStakingRemapped,
        ...(weftStaking
            ? ([
                  {
                      name: TOKEN_PRICE_CACHE[WEFT_RESOURCE_ADDRESS].name,
                      symbol: TOKEN_PRICE_CACHE[WEFT_RESOURCE_ADDRESS].symbol,
                      icon_url:
                          TOKEN_PRICE_CACHE[WEFT_RESOURCE_ADDRESS].icon_url,
                      info_url:
                          TOKEN_PRICE_CACHE[WEFT_RESOURCE_ADDRESS].infoUrl,
                      resource_address: WEFT_RESOURCE_ADDRESS,
                      provider: 'Weft Finance',
                      bonus_type: 'APR',
                      bonus_value: +new Decimal(weftStaking.apr)
                          .times(100)
                          .toFixed(2),
                      strategy_type: 'Staking',
                      total_stake: weftStaking.tvl_usd,
                      requiredAssets: [
                          {
                              resource_address: XRD_RESOURCE_ADDRESS,
                              symbol: 'XRD',
                          },
                      ],
                      rewardTokens: [
                          TOKEN_PRICE_CACHE[WEFT_RESOURCE_ADDRESS].symbol,
                      ],
                      stakeComponent:
                          stakingImplementations[WEFT_RESOURCE_ADDRESS]
                              ?.stakeComponent,
                      stakeMethod:
                          stakingImplementations[WEFT_RESOURCE_ADDRESS]
                              ?.stakeMethod,
                      requireOptionalProof:
                          stakingImplementations[WEFT_RESOURCE_ADDRESS]
                              ?.requireOptionalProof,
                  },
              ] as StakingStrategy[])
            : []),
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
