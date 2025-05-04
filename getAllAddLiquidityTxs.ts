import type {
    CommittedTransactionInfo,
    StreamTransactionsResponse,
} from '@radixdlt/babylon-gateway-api-sdk'
import { gatewayApi } from '.'

export const OLD_ATTOS_ROYALTY_COMPONENT =
    'component_rdx1cpd6et0fy7jua470t0mn0vswgc8wzx52nwxzg6dd6rel0g0e08l0lu'

export const OLD_CHARGE_ROYALTY_METHOD = 'charge_royalty'

export const ATTOS_ROYALTY_COMPONENT =
    'component_rdx1cqjzzku4rrkz3zhm8hldn55evpgmxx9rpq9t98qtnj0asdg88f9yj6'

export const CHARGE_ROYALTY_METHOD = 'charge_strategy_royalty'

export type EnhancedTransactionInfo = CommittedTransactionInfo & {
    liquidity?: 'added' | 'removed'
    strategy?: boolean
    airdropToken?: string
}

const isAddLiquidityTx = (tx: CommittedTransactionInfo): boolean =>
    !!tx.manifest_instructions?.includes('add_liquidity') &&
    !tx.affected_global_entities?.includes(ATTOS_ROYALTY_COMPONENT)

export const CLOSE_POSITION_SURGE_LP_STRATEGY_MANIFEST = [
    'remove_liquidity',
    'unwrap',
    'repay',
    'remove_collateral',
    'swap',
]

export const OPEN_POSITION_SURGE_LP_STRATEGY_MANIFEST = [
    CHARGE_ROYALTY_METHOD,
    'withdraw',
    'contribute',
    'create_cdp',
    'borrow',
    'wrap',
    'add_liquidity',
]

export const OPEN_POSITION_LP_POOL_STRATEGY_MANIFEST = [
    CHARGE_ROYALTY_METHOD,
    'withdraw',
    'contribute',
    'create_cdp',
    'borrow',
    'swap',
    'add_liquidity',
]

const isStrategyTx = (tx: CommittedTransactionInfo): boolean =>
    (!!tx.affected_global_entities?.includes(ATTOS_ROYALTY_COMPONENT) &&
        !!tx.balance_changes?.fungible_fee_balance_changes.some(
            (f) => f.type === 'RoyaltyDistributed'
        ) &&
        tx.manifest_instructions?.includes(CHARGE_ROYALTY_METHOD)) ||
    CLOSE_POSITION_SURGE_LP_STRATEGY_MANIFEST.every((method) =>
        tx.manifest_instructions?.includes(method)
    )

const isIlisAirdrop = (tx: CommittedTransactionInfo): boolean =>
    !!tx.manifest_instructions?.includes(
        'component_rdx1czqa7dy572axllzl6mx57tgrz90rv36wggxn8ltneelj27688nr4jq'
    ) && !!tx.manifest_instructions?.includes('airdrop')

const isRemoveLiquidityTx = (tx: CommittedTransactionInfo): boolean =>
    !!tx.manifest_instructions?.includes('remove_liquidity')

const processTransaction = (
    tx: CommittedTransactionInfo
): EnhancedTransactionInfo => {
    if (isIlisAirdrop(tx)) return { ...tx, airdropToken: 'ilis' }
    if (isStrategyTx(tx)) return { ...tx, strategy: true }
    if (isAddLiquidityTx(tx)) return { ...tx, liquidity: 'added' }
    if (isRemoveLiquidityTx(tx)) return { ...tx, liquidity: 'removed' }
    return tx
}

const fetchTransactions = async (
    address: string,
    cursor?: string
): Promise<StreamTransactionsResponse> => {
    return gatewayApi.stream.innerClient.streamTransactions({
        streamTransactionsRequest: {
            affected_global_entities_filter: [address],
            opt_ins: {
                balance_changes: true,
                receipt_output: true,
                manifest_instructions: true,
                affected_global_entities: true,
            },
            ...(cursor && { cursor }),
        },
    })
}

export const getAllAddLiquidityTxs = async (
    address: string,
    items: EnhancedTransactionInfo[] = [],
    cursor?: string
): Promise<EnhancedTransactionInfo[]> => {
    const response = await fetchTransactions(address, cursor)

    const processedItems = response.items
        .filter(
            (tx) =>
                isIlisAirdrop(tx) ||
                isAddLiquidityTx(tx) ||
                isStrategyTx(tx) ||
                isRemoveLiquidityTx(tx)
        )
        .map(processTransaction)

    const allItems = [...items, ...processedItems]

    return response.next_cursor
        ? getAllAddLiquidityTxs(address, allItems, response.next_cursor)
        : allItems
}
