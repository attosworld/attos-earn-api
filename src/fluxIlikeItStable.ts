export async function getFluxIncentivisedReservoir() {
    const fusdXrdReservoir = getReservoirApr({
        collateralAddress:
            'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
    }).then((response) => ({
        ...response.data,
        resourceAddress:
            'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
    }))

    const fusdLsuReservoir = getReservoirApr({
        collateralAddress:
            'resource_rdx1thksg5ng70g9mmy9ne7wz0sc7auzrrwy7fmgcxzel2gvp8pj0xxfmf',
    }).then((response) => ({
        ...response.data,
        resourceAddress:
            'resource_rdx1thksg5ng70g9mmy9ne7wz0sc7auzrrwy7fmgcxzel2gvp8pj0xxfmf',
    }))

    return Promise.all([
        fusdXrdReservoir,
        fusdLsuReservoir,
    ] as Promise<FluxPoolResponse>[]).catch(() => [] as FluxPoolResponse[])
}

export type FluxPoolResponse = FluxPoolData & { resourceAddress: string }

interface FluxPoolData {
    totalApr: number
    currentTotalDebt: number
    currentPoolSize: number
    newPoolSize: number
    additionalFusd: number
}

export interface FluxPoolAprResponse {
    success: boolean
    data: FluxPoolData
}

async function getReservoirApr({
    collateralAddress,
}: {
    collateralAddress: string
}) {
    return fetch('https://flux.ilikeitstable.com/api/flux/get-reservoir-apr', {
        method: 'POST',
        headers: {
            accept: 'application/json',
        },
        body: JSON.stringify({
            collateralAddress,
        }),
    }).then((response) => response.json() as Promise<FluxPoolAprResponse>)
}
