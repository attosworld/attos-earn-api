import type { CommittedTransactionInfo } from "@radixdlt/babylon-gateway-api-sdk";
import { gatewayApi } from ".";

export const getAllAddLiquidityTxs = async (address: string, items: CommittedTransactionInfo[] = [], cursor?: string): Promise<
{ 
    added: CommittedTransactionInfo[];
    removed: CommittedTransactionInfo[];
}
> => {
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
        return await getAllAddLiquidityTxs(address, [...items, ...response.items], response.next_cursor);
    }

    const liquidity = [...items, ...response.items];

    return {
        added: liquidity.filter((tx) => tx.manifest_instructions?.includes('add_liquidity')),
        removed: liquidity.filter((tx) => tx.manifest_instructions?.includes('remove_liquidity'))
    };
};

