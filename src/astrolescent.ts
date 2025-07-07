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
    tvl: number
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

export type AstrolascentSwapResponse = {
    inputTokens: number
    outputTokens: number
    priceImpact: number
    swapFee: string
    manifest: string
    routes: Array<{
        pools: Array<{
            type: string
            baseToken: string
            quoteToken: string
        }>
        startPrice: string
        endPrice: string
        impact: number
        tokensIn: number
        tokensOut: number
    }>
}

export interface AstrolescentSwapRequest {
    inputToken: string
    outputToken: string
    amount: string
    accountAddress: string
}

export interface AstrolescentSwapResponse {
    inputTokens: number
    outputTokens: number
    priceImpact: number
    swapFee: string
    manifest: string
    routes: Array<{
        pools: Array<{
            type: string
            baseToken: string
            quoteToken: string
        }>
        startPrice: string
        endPrice: string
        impact: number
        tokensIn: number
        tokensOut: number
    }>
}

export const astrolescentRequest = ({
    inputToken,
    outputToken,
    amount,
    accountAddress,
}: AstrolescentSwapRequest) => {
    return fetch(`https://api.astrolescent.com/partner/selfisocial/swap`, {
        headers: {
            accept: 'application/json, text/plain, */*',
        },
        method: 'POST',
        body: JSON.stringify({
            inputToken: inputToken,
            outputToken: outputToken,
            inputAmount: amount,
            fromAddress: accountAddress,
        }),
    })
}

// https://api.astrolescent.com/price/history/resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd?days=90
