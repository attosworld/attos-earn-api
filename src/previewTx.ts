import { gatewayApi } from '..'

export async function previewTx(manifest: string) {
    return await gatewayApi.transaction.innerClient.transactionPreview({
        transactionPreviewRequest: {
            manifest,
            signer_public_keys: [],
            nonce: Math.random() * 100000,
            start_epoch_inclusive: 0,
            end_epoch_exclusive: 1,
            flags: {
                use_free_credit: true,
                assume_all_signature_proofs: true,
                skip_epoch_check: true,
                disable_auth_checks: true,
            },
        },
    })
}
