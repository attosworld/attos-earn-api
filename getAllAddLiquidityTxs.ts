import type { CommittedTransactionInfo } from "@radixdlt/babylon-gateway-api-sdk";
import { gatewayApi } from ".";

export const ATTOS_ROYALTY_COMPONENT = 'component_rdx1cpd6et0fy7jua470t0mn0vswgc8wzx52nwxzg6dd6rel0g0e08l0lu';

export const getAllAddLiquidityTxs = async (address: string, items: (CommittedTransactionInfo & { liquidity: 'added' | 'removed' })[] = [], cursor?: string): Promise<((CommittedTransactionInfo & { liquidity: 'added' | 'removed', strategy?: boolean })[])> => {
    const response = await gatewayApi.stream.innerClient.streamTransactions({
        streamTransactionsRequest: {
            affected_global_entities_filter: [address],
            opt_ins: {
                balance_changes: true,
                receipt_output: true,
                manifest_instructions: true,
                affected_global_entities: true
            },
            ...(cursor && { cursor })
        }
    });

    if (response.next_cursor) {
        const processed = response.items
        .filter((tx) => {
            if (tx.manifest_instructions?.includes('add_liquidity')) {
                return true;
            } else if(tx.affected_global_entities?.includes(ATTOS_ROYALTY_COMPONENT) && tx.balance_changes?.fungible_fee_balance_changes.find(f => f.type === 'RoyaltyDistributed')) {
                return true;
            } else if (tx.manifest_instructions?.includes('remove_liquidity')) {
                return true;
            }
            return false;
        })
        .map((tx) => {
            if (tx.manifest_instructions?.includes('add_liquidity')) {
                return { ...tx, liquidity: 'added' }
            } else if (tx.affected_global_entities?.includes(ATTOS_ROYALTY_COMPONENT) && tx.balance_changes?.fungible_fee_balance_changes.find(f => f.type === 'RoyaltyDistributed')) {
                return { ...tx, strategy: true }
            } else {
                return {...tx, liquidity:'removed' }
            }
        }) as (CommittedTransactionInfo & { liquidity: 'added' |'removed' })[];

        return await getAllAddLiquidityTxs(address, [...items, ...processed], response.next_cursor);
    }

        const processed = response.items
        .filter((tx) => {
            if (tx.manifest_instructions?.includes('add_liquidity')) {
                return true;
            } else if(tx.affected_global_entities?.includes(ATTOS_ROYALTY_COMPONENT) && tx.balance_changes?.fungible_fee_balance_changes.find(f => f.type === 'RoyaltyDistributed')) {
                return true;
            } else if (tx.manifest_instructions?.includes('remove_liquidity')) {
                return true;
            }
            return false;
        })
        .map((tx) => {
            if (tx.manifest_instructions?.includes('add_liquidity') && !tx.affected_global_entities?.includes(ATTOS_ROYALTY_COMPONENT)) {
                return { ...tx, liquidity: 'added' }
            } else if (tx.affected_global_entities?.includes(ATTOS_ROYALTY_COMPONENT) && tx.balance_changes?.fungible_fee_balance_changes.find(f => f.type === 'RoyaltyDistributed')) {
                console.log('strategy');
                return { ...tx, strategy: true }
            }else {
                return {...tx, liquidity:'removed' }
            }
        }) as (CommittedTransactionInfo & { liquidity: 'added' |'removed' })[];

    const liquidity = [...items, ...processed];

    return liquidity;
};

