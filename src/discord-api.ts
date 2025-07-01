import type Decimal from 'decimal.js'
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

const LP_ROLE_RANKS = {
    NOVICE: 'Seedling', // Entry level LP
    INTERMEDIATE: 'Cultivator', // Mid-level LP
    ADVANCED: 'Harvester', // Advanced LP
    EXPERT: 'Magnate', // Expert LP
    ELITE: 'Sovereign', // Elite/top-tier LP
}

// LP value thresholds for each role (in XRD)
const LP_ROLE_THRESHOLDS = {
    NOVICE: 1000, // 1,000 XRD
    INTERMEDIATE: 10000, // 10,000 XRD
    ADVANCED: 100000, // 100,000 XRD
    EXPERT: 500000, // 500,000 XRD
    ELITE: 1000000, // 1,000,000 XRD
}

/**
 * Checks if a user is in the specified guild and assigns them the appropriate role based on LP value
 * @param userId The Discord user ID to check and assign role to
 * @param lpValue The user's liquidity provider value in XRD
 * @returns Object containing success status and any error message
 */
export async function verifyUserAndAssignRole(
    userId: string,
    lpValue: Decimal
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

            // Assign the Verified role if user doesn't already have it
            if (!member.roles.cache.has(verifiedRole.id)) {
                console.log(`Assigning Verified role to user ${userId}`)
                await member.roles.add(verifiedRole)
            }

            // Determine which LP role the user should have based on their LP value
            let roleToAssign: string | null = null

            // Convert Decimal to number for comparison
            const lpValueNumber = lpValue.toNumber()

            if (lpValueNumber >= LP_ROLE_THRESHOLDS.ELITE) {
                roleToAssign = LP_ROLE_RANKS.ELITE
            } else if (lpValueNumber >= LP_ROLE_THRESHOLDS.EXPERT) {
                roleToAssign = LP_ROLE_RANKS.EXPERT
            } else if (lpValueNumber >= LP_ROLE_THRESHOLDS.ADVANCED) {
                roleToAssign = LP_ROLE_RANKS.ADVANCED
            } else if (lpValueNumber >= LP_ROLE_THRESHOLDS.INTERMEDIATE) {
                roleToAssign = LP_ROLE_RANKS.INTERMEDIATE
            } else if (lpValueNumber >= LP_ROLE_THRESHOLDS.NOVICE) {
                roleToAssign = LP_ROLE_RANKS.NOVICE
            }

            // If user qualifies for an LP role
            if (roleToAssign) {
                // Find all LP roles in the guild
                const lpRoles = Object.values(LP_ROLE_RANKS)
                    .map((roleName) =>
                        guild.roles.cache.find((role) => role.name === roleName)
                    )
                    .filter(Boolean)

                // Find the specific role to assign
                const targetRole = guild.roles.cache.find(
                    (role) => role.name === roleToAssign
                )

                if (!targetRole) {
                    return {
                        success: true,
                        message: `Verified role assigned, but LP role "${roleToAssign}" not found in the guild`,
                    }
                }

                // Remove any existing LP roles the user might have
                const userLpRoles = member.roles.cache.filter((role) =>
                    lpRoles.some((lpRole) => lpRole?.id === role.id)
                )

                if (userLpRoles.size > 0) {
                    await member.roles.remove(userLpRoles)
                }

                // Assign the new LP role
                await member.roles.add(targetRole)

                return {
                    success: true,
                    message: `Assigned ${roleToAssign} role based on LP value of ${lpValueNumber.toLocaleString()} XRD`,
                }
            }

            return {
                success: true,
                message:
                    'Verified role assigned successfully, but LP value too low for LP role',
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
