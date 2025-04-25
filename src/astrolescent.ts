export interface TokenInfo {
    address: string
    symbol: string
    name: string
    description: string
    iconUrl: string
    infoUrl: string
    divisibility: number
    tokenPriceXRD: number
    tokenPriceUSD: number
    diff24H: number
    diff24HUSD: number
    diff7Days: number
    diff7DaysUSD: number
    totalSupply: number
    icon_url: string
    createdAt: string | null
    tags: string[] | null
}

export type TokensResponse = Array<TokenInfo>

export const tokensRequest = async () => {
    return fetch(`https://api.astrolescent.com/partner/selfisocial/tokens`, {
        headers: {
            accept: 'application/json, text/plain, */*',
        },
        mode: 'cors',
        method: 'GET',
    })
        .then((response) => response.json() as Promise<TokensResponse>)
        .then((tokens) => {
            return tokens.reduce(
                (acc, t) => {
                    if (t.tokenPriceUSD !== null || t.tokenPriceXRD !== null) {
                        acc[t.address] = t
                        return acc
                    }

                    return acc
                },
                {} as Record<string, TokenInfo>
            )
        })
}
