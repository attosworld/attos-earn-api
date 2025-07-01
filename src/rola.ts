import { randomBytes } from 'node:crypto'
import { Rola, type SignedChallenge } from '@radixdlt/rola'
import { CACHE_DIR } from '..'
import {
    existsSync,
    writeFileSync,
    unlinkSync,
    readFileSync,
    readdirSync,
    mkdirSync,
} from 'node:fs'
import path from 'node:path'
import { verifyUserAndAssignRole } from './discord-api'

export const secureRandom = (byteCount: number): string =>
    randomBytes(byteCount).toString('hex')

export function readChallengeFile(challenge: string): boolean {
    // Check if challenge file exists
    // If the challenge file does not exist, return false
    if (!existsSync(`${CACHE_DIR}/challenges`)) {
        mkdirSync(`${CACHE_DIR}/challenges`, { recursive: true })
    }

    // Read expiration timestamp from the file
    const expiresTimestamp = parseInt(
        readFileSync(`${CACHE_DIR}/challenges/${challenge}`, 'utf-8')
    )

    // If the timestamp is in the future, challenge is valid
    if (expiresTimestamp > Date.now()) {
        return true
    }

    // If the timestamp is in the past, remove the file
    unlinkSync(`${CACHE_DIR}/challenges/${challenge}`)

    return false
}

export function writeChallengeFile(challenge: string, expires: number) {
    if (!existsSync(`${CACHE_DIR}/challenges`)) {
        mkdirSync(`${CACHE_DIR}/challenges`, { recursive: true })
    }
    // Write expiration timestamp to the file
    writeFileSync(`${CACHE_DIR}/challenges/${challenge}`, `${expires}`, 'utf-8')
}

export function cleanupExpiredChallenges() {
    try {
        // Check if challenges directory exists
        if (!existsSync(`${CACHE_DIR}/challenges`)) {
            return
        }

        // Read all challenge files
        const challengesDir = `${CACHE_DIR}/challenges`
        const files = readdirSync(challengesDir)

        const now = Date.now()
        let removedCount = 0

        // Check each file and remove if expired
        files.forEach((file) => {
            const filePath = path.join(challengesDir, file)
            try {
                const expiresTimestamp = parseInt(
                    readFileSync(filePath, 'utf-8')
                )

                // If the timestamp is in the past, remove the file
                if (expiresTimestamp < now) {
                    unlinkSync(filePath)
                    removedCount++
                }
            } catch (error) {
                console.error(`Error processing challenge file ${file}:`, error)
            }
        })

        if (removedCount > 0) {
            console.log(`Cleaned up ${removedCount} expired challenge files`)
        }
    } catch (error) {
        console.error('Error cleaning up expired challenges:', error)
    }
}

const ChallengeStore = () => {
    const create = () => {
        const challenge = secureRandom(32) // 32 random bytes as hex string
        const expires = Date.now() + 1000 * 60 * 5 // expires in 5 minutes

        // Store challenge with expiration in file system
        writeChallengeFile(challenge, expires)

        return challenge
    }

    const verify = (input: string) => {
        // Check if challenge file exists
        if (!readChallengeFile(input)) return false

        try {
            // Read expiration time from file
            const expires = parseInt(
                readFileSync(`${CACHE_DIR}/challenges/${input}`, 'utf-8')
            )

            // Delete the challenge file after reading it
            unlinkSync(`${CACHE_DIR}/challenges/${input}`)

            // Check if challenge has expired
            const isValid = expires > Date.now()

            return isValid
        } catch (error) {
            console.error('Error verifying challenge:', error)
            return false
        }
    }

    return { create, verify }
}

export const challengeStore = ChallengeStore()

const { verifySignedChallenge } = Rola({
    applicationName: 'Attos Earn',
    dAppDefinitionAddress:
        'account_rdx12xpquh9jpf0tekllepvcenhpwdxc3k25qrlhljmylmrksahmcemaw3', // address of the dApp definition
    networkId: 1, // network id of the Radix network
    expectedOrigin: process.env.EXPECTED_ORIGIN || 'http://localhost:4200', // origin of the client making the wallet request
})

export async function verifyRola(
    body: SignedChallenge[],
    userId: string | undefined
) {
    if (!userId) {
        return { valid: false }
    }

    const challenges = [
        ...body
            .reduce((acc, curr) => acc.add(curr.challenge), new Set<string>())
            .values(),
    ]
    const isChallengeValid = challenges.every((challenge) =>
        challengeStore.verify(challenge)
    )

    if (!isChallengeValid) return { valid: false }

    const result = await Promise.all(
        body.map((signedChallenge) => verifySignedChallenge(signedChallenge))
    ).catch(() => false)

    if (!result) return { valid: false }

    const isVerified = await verifyUserAndAssignRole(userId)

    if (!isVerified.success) {
        return { valid: false, error: isVerified.message }
    }

    // The signature is valid and the public key is owned by the user
    return { valid: true }
}
