import { gatewayApi } from '../'

export interface TokenMetadata {
    dapp_definition: string
    icon_url: string
    symbol: string
    description: string
    name: string
    info_url: string
    tags: string[]
}

export const getTokenMetadata = async (
    tokenAddress: string
): Promise<TokenMetadata> => {
    const response = await gatewayApi.state.getEntityMetadata(tokenAddress)

    return response.items.reduce((acc, m) => {
        if ('value' in m.value.typed) {
            acc[m.key as keyof Omit<TokenMetadata, 'tags'>] = m.value.typed
                .value as string
        } else if (m.key == 'tags' && 'values' in m.value.typed) {
            acc[m.key as keyof { tags: string[] }] = m.value.typed
                .values as string[]
        }
        return acc
    }, {} as TokenMetadata)
}
