import type { NftInfo } from '@calamari-radix/gateway-ez-mode/dist/types'
import { gatewayApiEzMode } from '../'
import {
    getAllAddLiquidityTxs,
    type EnhancedTransactionInfo,
} from './getAllAddLiquidityTxs'
import { tokensRequest, type TokenInfo } from './astrolescent'
import {
    getRootFinancePoolState,
    type RootFinancePoolStateResponse,
} from './rootFinance'
import {
    processLPPositions,
    processStrategyPositions,
    type PoolPortfolioItem,
} from './positionProcessor'

export async function getAccountLPPortfolio(
    address: string,
    type?: 'lp' | 'strategy'
) {
    const [fungibleLps, nftLps, tokenPrices, liquidityPoolTxs] =
        await Promise.all([
            gatewayApiEzMode.state.getComponentFungibleBalances(address),
            gatewayApiEzMode.state.getComponentNonFungibleBalances(address),
            tokensRequest(),
            getAllAddLiquidityTxs(address),
        ])

    const lps: Record<
        string,
        {
            type: 'defiplaza' | 'ociswap' | 'ociswap_v2'
            balance?: string
            nftInfo?: {
                nfts: NftInfo[]
                component: string
                left_token: string
                right_token: string
            }
        }
    > = {}

    fungibleLps.forEach((token) => {
        if (+token.balance > 0) {
            if (
                token.resourceInfo.metadata.name?.match(
                    /Defiplaza (.+) Quote/
                ) ||
                token.resourceInfo.metadata.name?.match(/Defiplaza (.+) Base/)
            ) {
                lps[token.resourceInfo.resourceAddress] = {
                    type: 'defiplaza',
                    balance: token.balance,
                }
            } else if (
                token.resourceInfo.metadata.name?.startsWith('Ociswap LP')
            ) {
                lps[token.resourceInfo.resourceAddress] = {
                    type: 'ociswap',
                    balance: token.balance,
                }
            }
        }
    })

    for (const token of nftLps) {
        if (token.nftBalance.length) {
            if (token.resourceInfo.metadata.name?.startsWith('Ociswap LP')) {
                const split = token.resourceInfo.metadata.infoUrl?.split(
                    '/'
                ) as string[]
                const pair = await gatewayApiEzMode.state.getComponentInfo(
                    split[split.length - 1]
                )
                const { x_address, y_address } =
                    pair.metadata.metadataExtractor.getMetadataValuesBatch({
                        x_address: 'GlobalAddress',
                        y_address: 'GlobalAddress',
                    }) as { x_address: string; y_address: string }

                lps[token.resourceInfo.resourceAddress] = {
                    type: 'ociswap_v2',
                    nftInfo: {
                        nfts: token.nftBalance,
                        component: split[split.length - 1],
                        left_token: x_address,
                        right_token: y_address,
                    },
                }
            }
        }
    }

    const strategyTxs = liquidityPoolTxs.filter((tx) => tx.strategy)

    const [rootFinancePoolState] = await Promise.all([
        getRootFinancePoolState(),
    ])

    const portfolioPnL: PoolPortfolioItem[] = (
        await Promise.all(
            getPortfolioItems(
                address,
                type,
                lps,
                liquidityPoolTxs,
                strategyTxs,
                rootFinancePoolState,
                tokenPrices
            )
        )
    ).filter(Boolean) as PoolPortfolioItem[]

    return portfolioPnL.filter(
        (pool) =>
            pool &&
            (((+pool.invested || 0) > 0 && +pool.currentValue > 0.001) ||
                (pool.strategy &&
                    +pool.invested != 0 &&
                    +pool.currentValue != 0))
    )
}

export function getPortfolioItems(
    address: string,
    type: 'lp' | 'strategy' | undefined,
    lps: Record<
        string,
        {
            type: 'defiplaza' | 'ociswap' | 'ociswap_v2'
            balance?: string
            nftInfo?: {
                nfts: NftInfo[]
                component: string
                left_token: string
                right_token: string
            }
        }
    >,
    liquidityPoolTxs: EnhancedTransactionInfo[],
    strategyTxs: EnhancedTransactionInfo[],
    rootFinancePoolState: RootFinancePoolStateResponse | null,
    tokenPrices: Record<string, TokenInfo>
) {
    if (type === 'lp') {
        return processLPPositions(lps, liquidityPoolTxs, address, tokenPrices)
    } else if (type === 'strategy') {
        return processStrategyPositions(
            strategyTxs,
            rootFinancePoolState,
            tokenPrices,
            address
        )
    } else {
        return [
            ...processLPPositions(lps, liquidityPoolTxs, address, tokenPrices),
            ...processStrategyPositions(
                strategyTxs,
                rootFinancePoolState,
                tokenPrices,
                address
            ),
        ]
    }
}
