import { NEWS_CACHE_DIR } from '..'
import { tokensRequest } from './astrolescent'
import { sleep } from 'bun'
import { getMessages, getTelegramSocial, type TokenNews } from './telegramApi'
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs'

export const TOKEN_NEWS_CACHE: Record<string, string> = {
    resource_rdx1t4tjx4g3qzd98nayqxm7qdpj0a0u8ns6a0jrchq49dyfevgh6u0gj3:
        'astrolescent_official',
    resource_rdx1tk3fxrz75ghllrqhyq8e574rkf4lsq2x5a0vegxwlh3defv225cth3:
        'WeftFinance',
    resource_rdx1t4r86qqjtzl8620ahvsxuxaf366s6rf6cpy24psdkmrlkdqvzn47c2:
        'ilisdao',
    resource_rdx1t52pvtk5wfhltchwh3rkzls2x0r98fw9cjhpyrf3vsykhkuwrf7jg8:
        'ociswap',
    resource_rdx1t42hpqvsk4t42l6aw09hwphd2axvetp6gvas9ztue0p30f4hzdwxrp:
        'RedDicks_XRD',
    resource_rdx1t5xv44c0u99z096q00mv74emwmxwjw26m98lwlzq6ddlpe9f5cuc7s:
        'early_xrd',
    resource_rdx1t5kmyj54jt85malva7fxdrnpvgfgs623yt7ywdaval25vrdlmnwe97:
        're_HUG',
    resource_rdx1t4kc5ljyrwlxvg54s6gnctt7nwwgx89h9r2gvrpm369s23yhzyyzlx:
        'wowoproject_xrd',
    resource_rdx1tk4y4ct50fzgyjygm7j3y6r3cw5rgsatyfnwdz64yp5t388v0atw8w:
        'DanCoinXRD',
}

export async function getTokenNews(tokenAddress: string): Promise<TokenNews[]> {
    // Initialize the news cache directory
    if (!existsSync(NEWS_CACHE_DIR)) {
        mkdirSync(NEWS_CACHE_DIR, { recursive: true })
    }

    // If not in memory, try to read from file
    const filePath = `${NEWS_CACHE_DIR}/${tokenAddress}`
    if (existsSync(filePath)) {
        try {
            const data = readFileSync(filePath, 'utf-8')
            const news = JSON.parse(data) as TokenNews[]
            // Update in-memory cache
            return news
        } catch (error) {
            console.error(
                `Error reading news cache for ${tokenAddress}:`,
                error
            )
        }
    }

    return []
}

// Write news data to file
function writeNewsToFile(tokenAddress: string, news: TokenNews[]) {
    try {
        writeFileSync(
            `${NEWS_CACHE_DIR}/${tokenAddress}`,
            JSON.stringify(news),
            'utf-8'
        )
    } catch (error) {
        console.error(`Error writing news cache for ${tokenAddress}:`, error)
    }
}

export async function updateNewsCache() {
    console.log('Updating news cache...', new Date().toISOString())
    const tokens = await tokensRequest()

    // Ensure the news cache directory exists
    if (!existsSync(NEWS_CACHE_DIR)) {
        mkdirSync(NEWS_CACHE_DIR, { recursive: true })
    }

    const tokenAddresses = Object.keys(tokens).filter(
        (t) => tokens[t]?.tvl > 1_000
    )

    for (const tokenAddress of tokenAddresses) {
        try {
            const news = await getMessages(
                TOKEN_NEWS_CACHE[tokenAddress] ??
                    (await getTelegramSocial(tokenAddress))
            )

            // Write news to file
            writeNewsToFile(
                tokenAddress,
                news.filter((news) => news.text)
            )

            // Add delay between requests to avoid rate limiting
            await sleep(1000)
        } catch (error) {
            console.error(`Error updating news for ${tokenAddress}:`, error)
            // Continue with the next token even if one fails
            await sleep(500)
        }
    }

    console.log(
        `News cache updated for ${tokenAddresses.length} tokens at ${new Date().toISOString()}`
    )
}
