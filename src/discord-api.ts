import { DISCORD_JS_CLIENT } from './discord-attos-earn-bot'

interface DiscordUser {
    id: string
    username: string
    discriminator: string
    avatar: string | null
    email?: string
    verified?: boolean
    flags?: number
    banner?: string | null
    accent_color?: number | null
    premium_type?: number
    public_flags?: number
}

interface TokenValidationResult {
    valid: boolean
    user?: DiscordUser
    error?: string
}

export async function validateDiscordUserToken(
    token: string | null
): Promise<TokenValidationResult> {
    if (!token) {
        return { valid: false, error: 'No token provided' }
    }

    try {
        // Make request to Discord API to validate token
        const response = await fetch('https://discord.com/api/v10/users/@me', {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })

        if (!response.ok) {
            return {
                valid: false,
                error: `Discord API returned status ${response.status}: ${response.statusText}`,
            }
        }

        const userData = (await response.json()) as DiscordUser

        return {
            valid: true,
            user: userData,
        }
    } catch (error) {
        console.error('Error validating Discord token:', error)
        return {
            valid: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }
    }
}

/**
 * Checks if a user is in the specified guild and assigns them the "Verified" role
 * @param userId The Discord user ID to check and assign role to
 * @returns Object containing success status and any error message
 */
export async function verifyUserAndAssignRole(
    userId: string
): Promise<{ success: boolean; message: string }> {
    if (!process.env.DISCORD_TOKEN || !process.env.GUILD_ID) {
        return {
            success: false,
            message:
                'Missing required environment variables (DISCORD_TOKEN or GUILD_ID)',
        }
    }

    // Initialize Discord client with necessary intents
    const client = DISCORD_JS_CLIENT

    try {
        // Get the guild
        const guild = await client.guilds.fetch(process.env.GUILD_ID)

        if (!guild) {
            await client.destroy()
            return { success: false, message: 'Guild not found' }
        }

        try {
            // Check if user is in the guild
            const member = await guild.members.fetch(userId)

            // Find the "Verified" role
            const verifiedRole = guild.roles.cache.find(
                (role) => role.name === 'Verified'
            )

            if (!verifiedRole) {
                return {
                    success: false,
                    message: 'Verified role not found in the guild',
                }
            }

            // Assign the role if user doesn't already have it
            if (!member.roles.cache.has(verifiedRole.id)) {
                console.log(`Assigning role to user ${userId}`)
                await member.roles.add(verifiedRole)
                return {
                    success: true,
                    message: 'Verified role assigned successfully',
                }
            } else {
                return {
                    success: true,
                    message: 'User already has the Verified role',
                }
            }
        } catch (error) {
            console.error('Error fetching user:', error)
            return {
                success: false,
                message: 'User is not a member of the guild',
            }
        }
    } catch (error) {
        console.error('Error verifying user and assigning role:', error)
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Unknown error occurred',
        }
    }
}
