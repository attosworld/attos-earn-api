import {
    AttachmentBuilder,
    Client,
    Events,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
} from 'discord.js'
import { POOLS_CACHE, readCacheFromFile } from '../index' // Adjust the import path as necessary
import { ChartJSNodeCanvas } from 'chartjs-node-canvas'
import type { ChartConfiguration } from 'chart.js'
import type { Pool } from '../src/getAllPools'
import { createCanvas, loadImage } from 'canvas'

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!)

export const DISCORD_JS_CLIENT = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
})

DISCORD_JS_CLIENT.once('ready', () => {
    console.log('Discord bot is ready!')
})

enum ProviderIcon {
    Ociswap = 'https://ociswap.com/icons/oci.png',
    DefiPlaza = 'https://static.defiplaza.net/website/uploads/2023/09/25115716/defiplaza-dex-icon-stokenet.png',
}

async function generateFeaturedPoolsImage(
    pools: Pool[],
    title: string
): Promise<Buffer> {
    const width = 800
    const iconSize = 50
    const spacing = 20
    const poolInfoHeight = iconSize + spacing + 100
    const height = 100 + pools.length * poolInfoHeight

    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')

    // Background
    ctx.fillStyle = '#1e2939'
    ctx.fillRect(0, 0, width, height)

    // Title
    ctx.fillStyle = '#f0b100'
    ctx.font = 'bold 30px FreeSans'
    ctx.fillText(title, 50, 50)

    // Pool Information
    ctx.font = '20px FreeSans'

    for (const [index, pool] of pools.entries()) {
        const yPosition = 100 + index * poolInfoHeight

        // Load and draw left icon
        if (pool.left_icon) {
            const leftIcon = await loadImage(pool.left_icon)
            ctx.save()
            ctx.beginPath()
            ctx.arc(75, yPosition + iconSize / 2, iconSize / 2, 0, Math.PI * 2)
            ctx.closePath()
            ctx.clip()
            ctx.drawImage(leftIcon, 50, yPosition, iconSize, iconSize)
            ctx.restore()
        }

        // Load and draw right icon
        if (pool.right_icon) {
            const rightIcon = await loadImage(pool.right_icon)
            ctx.save()
            ctx.beginPath()
            ctx.arc(135, yPosition + iconSize / 2, iconSize / 2, 0, Math.PI * 2)
            ctx.closePath()
            ctx.clip()
            ctx.drawImage(rightIcon, 110, yPosition, iconSize, iconSize)
            ctx.restore()
        }

        // Load and draw provider icon
        const providerIconUrl =
            pool.bonus_name === 'ALR'
                ? ProviderIcon.DefiPlaza
                : ProviderIcon.Ociswap
        const providerIcon = await loadImage(providerIconUrl)
        ctx.drawImage(
            providerIcon,
            80, // Centered between the left and right icons
            yPosition + iconSize + 10,
            iconSize,
            iconSize
        )

        // Draw pool information
        ctx.fillStyle = '#ffffff'
        ctx.fillText(`${pool.name}`, 180, yPosition + 20)

        ctx.fillStyle = '#00ff00' // Green color for Bonus 7d
        ctx.fillText(
            `Bonus 7d: ${pool.bonus_7d.toFixed(2)}%`,
            180,
            yPosition + 50
        )

        ctx.fillStyle = '#ffffff'
        ctx.fillText(
            `Volume 7d: $${pool.volume_7d.toLocaleString()}`,
            180,
            yPosition + 80
        )
        ctx.fillText(`TVL: $${pool.tvl.toLocaleString()}`, 180, yPosition + 110)
    }

    return canvas.toBuffer()
}

export async function startDiscordBot() {
    DISCORD_JS_CLIENT.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) return

        if (interaction.commandName === 'volumechart') {
            const componentAddress = interaction.options.get(
                'component_address'
            )?.value as string

            if (!componentAddress) {
                await interaction.reply(
                    'Please provide a valid component address.'
                )
                return
            }

            console.log(
                'Fetching volume data for component address:',
                componentAddress
            )

            const poolInfo = POOLS_CACHE?.find(
                (pool) => pool.component === componentAddress
            )

            const cache =
                readCacheFromFile(componentAddress) ?? poolInfo?.volume_per_day

            if (!cache) {
                interaction.reply(
                    'No volume data found for the specified component address.'
                )
                return
            }

            const width = 800 // width of the chart
            const height = 400 // height of the chart
            const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height })

            const configuration: ChartConfiguration = {
                type: 'bar',
                data: {
                    labels:
                        'data' in cache
                            ? Object.keys(cache.data)
                            : Object.keys(cache),
                    datasets: [
                        {
                            label: 'Volume',
                            data:
                                'data' in cache
                                    ? Object.values(cache.data)
                                    : Object.values(cache),
                            borderColor: '#f0b100',
                            backgroundColor: '#f0b100',
                            borderRadius: 5,
                        },
                    ],
                },
                options: {
                    backgroundColor: '#1e2939',
                    color: '#ffffff',
                    plugins: {
                        legend: {
                            display: false,
                        },
                    },
                    scales: {
                        x: {
                            title: {
                                display: false,
                                text: 'Date',
                            },
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Volume ($)',
                            },
                        },
                    },
                },
            }

            const imageBuffer =
                await chartJSNodeCanvas.renderToBuffer(configuration)

            const attachment = new AttachmentBuilder(imageBuffer, {
                name: 'volume-chart.png',
            })

            const provider =
                poolInfo?.bonus_name === 'ALR' ? 'Defiplaza' : 'Ociswap'

            interaction.reply({
                content: `Volume chart for ${poolInfo?.name} Pool by ${provider}`,
                files: [attachment],
            })
        }

        if (interaction.commandName === 'poolinfo') {
            const query = interaction.options.get('query')?.value as string

            if (!query) {
                await interaction.reply(
                    'Please provide a valid pool name or resource address.'
                )
                return
            }

            console.log('Fetching pool info for query:', query)

            const matchingPools = POOLS_CACHE?.filter(
                (pool) =>
                    pool.name.toLowerCase().includes(query.toLowerCase()) ||
                    pool.component === query
            )

            if (!matchingPools || matchingPools.length === 0) {
                interaction.reply('No pool found for the specified query.')
                return
            }

            const poolList = matchingPools
                .map((pool) => {
                    return `
**Name:** ${pool.name}
**Provider:** ${pool.bonus_name === 'ALR' ? 'Defiplaza' : 'Ociswap'}
**TVL:** $${pool.tvl.toLocaleString()}
**Volume 7d:** $${pool.volume_7d.toLocaleString()}
**APR 7d:** ${pool.bonus_7d.toFixed(2)}%
**Component:** ${pool.component}
                `
                })
                .join('')

            const MAX_MESSAGE_LENGTH = 2000
            const messages = []

            for (let i = 0; i < poolList.length; i += MAX_MESSAGE_LENGTH) {
                messages.push(poolList.slice(i, i + MAX_MESSAGE_LENGTH))
            }

            // Send the first message as a reply
            await interaction.reply({
                content: messages[0],
            })

            // Follow up with the remaining messages
            for (let i = 1; i < messages.length; i++) {
                await interaction.followUp({
                    content: messages[i],
                })
            }
        }

        if (interaction.commandName === 'featuredpools') {
            const deepestLiquidity = POOLS_CACHE?.sort(
                (a, b) => b.tvl - a.tvl
            ).slice(0, 3)

            const highestVolume = POOLS_CACHE?.sort(
                (a, b) => b.volume_7d - a.volume_7d
            ).slice(0, 3)

            const bestBonus = POOLS_CACHE?.filter((pool) => pool.boosted)
                .sort((a, b) => b.bonus_7d - a.bonus_7d)
                .slice(0, 3)

            if (deepestLiquidity) {
                const imageBuffer = await generateFeaturedPoolsImage(
                    deepestLiquidity,
                    'Deepest Liquidity Pools'
                )
                const attachment = new AttachmentBuilder(imageBuffer, {
                    name: 'deepest-liquidity-pools.png',
                })
                await interaction.reply({ files: [attachment] })
            }

            if (highestVolume) {
                const imageBuffer = await generateFeaturedPoolsImage(
                    highestVolume,
                    'Highest Volume Pools'
                )
                const attachment = new AttachmentBuilder(imageBuffer, {
                    name: 'highest-volume-pools.png',
                })
                await interaction.followUp({ files: [attachment] })
            }

            if (bestBonus) {
                const imageBuffer = await generateFeaturedPoolsImage(
                    bestBonus,
                    'Best Bonus Pools'
                )
                const attachment = new AttachmentBuilder(imageBuffer, {
                    name: 'best-bonus-pools.png',
                })
                await interaction.followUp({ files: [attachment] })
            }
        }
    })

    const volumeCommand = new SlashCommandBuilder()
        .setName('volumechart')
        .setDescription('Get the volume chart for a liquidity pool')
        .addStringOption((option) =>
            option
                .setName('component_address')
                .setDescription('The component address of the pool')
                .setRequired(true)
        )

    const poolInfoCommand = new SlashCommandBuilder()
        .setName('poolinfo')
        .setDescription(
            'Get information about a liquidity pool by name or resource address'
        )
        .addStringOption((option) =>
            option
                .setName('query')
                .setDescription('The name or resource address of the pool')
                .setRequired(true)
        )

    const featuredPoolsCommand = new SlashCommandBuilder()
        .setName('featuredpools')
        .setDescription(
            'Get a list of featured pools based on different criteria'
        )

    await rest
        .put(
            Routes.applicationGuildCommands(
                process.env.DISCORD_APPLICATION_ID!,
                process.env.GUILD_ID!
            ),
            {
                body: [
                    volumeCommand.toJSON(),
                    poolInfoCommand.toJSON(),
                    featuredPoolsCommand.toJSON(),
                ],
            }
        )
        .catch((error) => {
            console.log('Error creating slash command:', error)
        })

    await DISCORD_JS_CLIENT.login(process.env.DISCORD_TOKEN!)
}
