import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
} from '@aws-sdk/client-s3'

// Initialize S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
})

// Bucket name from environment variable
const BUCKET_NAME = process.env.BUCKET_NAME

// S3 operations
export async function uploadToS3(key: string, data: string): Promise<void> {
    try {
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: data,
            ContentType: 'application/json',
        })

        await s3Client.send(command)
    } catch (error) {
        console.error(`Error uploading to S3: ${key}`, error)
        throw error
    }
}

export async function getFromS3(key: string): Promise<string | null> {
    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        })

        const response = await s3Client.send(command)

        if (response.Body) {
            return await response.Body.transformToString()
        }
        return null
    } catch (error) {
        // If the object doesn't exist, return null instead of throwing
        if ((error as { name: string }).name === 'NoSuchKey') {
            return null
        }
        console.error(`Error getting from S3: ${key}`, error)
        throw error
    }
}

export async function doesKeyExistInS3(key: string): Promise<boolean> {
    try {
        const command = new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        })

        const response = await s3Client.send(command)
        console.log(response.ContentLength)
        return (response?.ContentLength || 0) > 2
    } catch (error) {
        if ((error as { name: string }).name === 'NotFound') {
            return false
        }
        console.error(`Error checking key existence in S3: ${key}`, error)
        throw error
    }
}
