import { Api, TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'

export interface TelegramMessage {
    id: number
    date: Date
    text?: string
    message?: string
    media?: Api.TypeMessageMedia
}

/**
 * Get messages from a Telegram channel using GramJS
 * @param channelUsername The username of the channel (with or without @)
 * @param apiId Your Telegram API ID
 * @param apiHash Your Telegram API Hash
 * @param sessionString Optional session string for authentication
 * @param limit Maximum number of messages to fetch
 * @returns Promise with an array of messages
 */
export async function getChannelMessages(
    channelUsername: string,
    apiId: number,
    apiHash: string,
    sessionString: string = '',
    limit: number = 100
): Promise<TelegramMessage[]> {
    // Initialize the client
    const client = new TelegramClient(
        new StringSession(sessionString),
        apiId,
        apiHash,
        { connectionRetries: 3 }
    )

    try {
        // Connect to Telegram
        await client.connect()

        // Ensure we're logged in (for user accounts)
        if (!(await client.isUserAuthorized())) {
            throw new Error(
                'User not authorized. Please provide a valid session string or login first.'
            )
        }

        // Format channel username
        const formattedUsername = channelUsername.startsWith('@')
            ? channelUsername.substring(1)
            : channelUsername

        // Get the channel entity
        const entity = await client.getEntity(formattedUsername)

        // Get messages from the channel
        const messages = await client.getMessages(entity, {
            limit: limit,
        })

        // Transform messages to our interface format
        const transformedMessages: TelegramMessage[] = messages.map((msg) => ({
            id: msg.id,
            date: new Date(msg.date * 1000),
            text: msg.message,
            media: msg.media,
            replyTo: msg.replyTo?.replyToMsgId,
            fromId:
                (msg.fromId as { userId: Api.long })?.userId.toJSNumber() || 0,
            peerId:
                (
                    msg.peerId as { channelId: Api.long }
                )?.channelId.toJSNumber() || 0,
            groupedId: msg.groupedId?.toString() || '0',
        }))

        return transformedMessages
    } catch (error) {
        console.error('Error fetching Telegram channel messages:', error)

        throw error
    }
}

/**
 * Get all messages from a Telegram channel with pagination
 * @param channelUsername The username of the channel
 * @param apiId Your Telegram API ID
 * @param apiHash Your Telegram API Hash
 * @param sessionString Session string for authentication
 * @param batchSize Number of messages to fetch per batch
 * @param maxMessages Maximum total messages to fetch (0 for all)
 * @returns Promise with all messages from the channel
 */
export async function getAllChannelMessages(
    channelUsername: string,
    apiId: number,
    apiHash: string,
    sessionString: string,
    batchSize: number = 100,
    maxMessages: number = 0
): Promise<TelegramMessage[]> {
    // Initialize the client
    const client = new TelegramClient(
        new StringSession(sessionString),
        apiId,
        apiHash,
        { connectionRetries: 3 }
    )

    const allMessages: TelegramMessage[] = []

    let progress = 0

    try {
        // Connect to Telegram
        await client.connect()

        // Ensure we're logged in
        if (!(await client.isUserAuthorized())) {
            throw new Error(
                'User not authorized. Please provide a valid session string or login first.'
            )
        }

        // Format channel username
        const formattedUsername = channelUsername.startsWith('@')
            ? channelUsername.substring(1)
            : channelUsername

        // Get the channel entity
        const entity = await client.getEntity(formattedUsername)

        let offsetId = 0
        let shouldContinue = true

        while (shouldContinue) {
            // Get batch of messages
            const messages = await client.getMessages(entity, {
                limit: batchSize,
                offsetId: offsetId,
            })

            if (messages.length === 0) {
                break
            }

            console.log(messages.length)
            // Transform messages
            const transformedMessages: TelegramMessage[] = messages
                .filter((msg) => msg.pinned)
                .map((msg) => ({
                    id: msg.id,
                    date: new Date(msg.date * 1000),
                    text: msg.message,
                    media: msg.media,
                    replyTo: msg.replyTo?.replyToMsgId,
                    fromId:
                        (
                            msg.fromId as { userId: Api.long }
                        )?.userId?.toJSNumber() || 0,
                    peerId:
                        (
                            (msg.peerId as { channelId: Api.long })
                                ?.channelId ||
                            (msg.peerId as { userId: Api.long })?.userId
                        )?.toJSNumber() || 0,
                    groupedId: msg.groupedId?.toString(),
                }))

            allMessages.push(...transformedMessages)

            // Update offset for next batch
            offsetId = messages[messages.length - 1].id

            progress = progress + 1

            console.log('progress', progress)
            shouldContinue = progress < maxMessages
        }

        console.log(allMessages.length)
        return allMessages
    } catch (error) {
        console.error('Error fetching all Telegram channel messages:', error)
        throw error
    }
}

const apiId = +process.env.TELEGRAM_API_ID! // Your API ID
const apiHash = process.env.TELEGRAM_API_HASH! // Your API Hash
const sessionString = process.env.TELEGRAM_SESSION_STRING! // Your session string

export async function getMessages(
    channelUsername: string
): Promise<TelegramMessage[]> {
    try {
        // For fetching all messages with pagination
        const allMessages = await getAllChannelMessages(
            channelUsername,
            apiId,
            apiHash,
            sessionString,
            2000, // batch size
            0 // max messages (0 for all)
        )

        console.log(allMessages.length)

        return allMessages
    } catch {
        return [] as TelegramMessage[]
    }
}

export const TOKEN_NEWS_CACHE: Record<string, string> = {
    resource_rdx1t4tjx4g3qzd98nayqxm7qdpj0a0u8ns6a0jrchq49dyfevgh6u0gj3:
        'astrolescent_official',
    resource_rdx1tk3fxrz75ghllrqhyq8e574rkf4lsq2x5a0vegxwlh3defv225cth3:
        'WeftFinance',
}
