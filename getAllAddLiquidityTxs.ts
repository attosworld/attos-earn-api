import type { CommittedTransactionInfo } from "@radixdlt/babylon-gateway-api-sdk";
import { gatewayApi } from ".";

export const getAllAddLiquidityTxs = async (address: string, items: (CommittedTransactionInfo & { liquidity: 'added' | 'removed' })[] = [], cursor?: string): Promise<((CommittedTransactionInfo & { liquidity: 'added' | 'removed' })[])> => {
    const response = await gatewayApi.stream.innerClient.streamTransactions({
        streamTransactionsRequest: {
            affected_global_entities_filter: [address],
            opt_ins: {
                balance_changes: true,
                manifest_instructions: true,
            },
            ...(cursor && { cursor })
        }
    });

    if (response.next_cursor) {
        const processed = response.items
        .filter((tx) => {
            if (tx.manifest_instructions?.includes('add_liquidity')) {
                return true;
            } else if (tx.manifest_instructions?.includes('remove_liquidity')) {
                return true;
            }
            return false;
        })
        .map((tx) => {
            if (tx.manifest_instructions?.includes('add_liquidity')) {
                return { ...tx, liquidity: 'added' }
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
            } else if (tx.manifest_instructions?.includes('remove_liquidity')) {
                return true;
            }
            return false;
        })
        .map((tx) => {
            if (tx.manifest_instructions?.includes('add_liquidity')) {
                return { ...tx, liquidity: 'added' }
            } else {
                return {...tx, liquidity:'removed' }
            }
        }) as (CommittedTransactionInfo & { liquidity: 'added' |'removed' })[];

    const liquidity = [...items, ...processed];

    return liquidity;
};

