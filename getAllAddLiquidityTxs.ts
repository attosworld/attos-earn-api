import type { CommittedTransactionInfo, StreamTransactionsResponse } from "@radixdlt/babylon-gateway-api-sdk";
import { gatewayApi } from ".";

export const ATTOS_ROYALTY_COMPONENT = 'component_rdx1cpd6et0fy7jua470t0mn0vswgc8wzx52nwxzg6dd6rel0g0e08l0lu';

type EnhancedTransactionInfo = CommittedTransactionInfo & { 
  liquidity?: 'added' | 'removed';
  strategy?: boolean;
};

const isAddLiquidityTx = (tx: CommittedTransactionInfo): boolean =>
  !!tx.manifest_instructions?.includes('add_liquidity') && 
  !tx.affected_global_entities?.includes(ATTOS_ROYALTY_COMPONENT);

const isStrategyTx = (tx: CommittedTransactionInfo): boolean =>
  !!tx.affected_global_entities?.includes(ATTOS_ROYALTY_COMPONENT) && 
  !!tx.balance_changes?.fungible_fee_balance_changes.some(f => f.type === 'RoyaltyDistributed');

const isRemoveLiquidityTx = (tx: CommittedTransactionInfo): boolean =>
  !!tx.manifest_instructions?.includes('remove_liquidity');

const processTransaction = (tx: CommittedTransactionInfo): EnhancedTransactionInfo => {
  if (isStrategyTx(tx)) return { ...tx, strategy: true };
  if (isAddLiquidityTx(tx)) return { ...tx, liquidity: 'added' };
  if (isRemoveLiquidityTx(tx)) return { ...tx, liquidity: 'removed' };
  return tx;
};

const fetchTransactions = async (address: string, cursor?: string): Promise<StreamTransactionsResponse> => {
  return gatewayApi.stream.innerClient.streamTransactions({
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
};

export const getAllAddLiquidityTxs = async (
  address: string, 
  items: EnhancedTransactionInfo[] = [], 
  cursor?: string
): Promise<EnhancedTransactionInfo[]> => {
  const response = await fetchTransactions(address, cursor);

  const processedItems = response.items
    .filter(tx => isAddLiquidityTx(tx) || isStrategyTx(tx) || isRemoveLiquidityTx(tx))
    .map(processTransaction);

  const allItems = [...items, ...processedItems];

  return response.next_cursor
    ? getAllAddLiquidityTxs(address, allItems, response.next_cursor)
    : allItems;
};

