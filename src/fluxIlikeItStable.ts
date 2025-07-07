export async function getFluxIncentivisedReservoir() {
    const fusdXrdReservoir = getReservoirApr({
        collateralAddress:
            'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
    }).then((response) => ({
        ...response.data,
        reservoirComponent:
            'component_rdx1cpkye6pp2643ghalcppdxks6kymyu5gla87gf7sk34k0vg7xu57jaj',
        resourceAddress:
            'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
    }))

    const fusdLsuReservoir = getReservoirApr({
        collateralAddress:
            'resource_rdx1thksg5ng70g9mmy9ne7wz0sc7auzrrwy7fmgcxzel2gvp8pj0xxfmf',
    }).then((response) => ({
        ...response.data,
        reservoirComponent:
            'component_rdx1cpkye6pp2643ghalcppdxks6kymyu5gla87gf7sk34k0vg7xu57jaj',
        resourceAddress:
            'resource_rdx1thksg5ng70g9mmy9ne7wz0sc7auzrrwy7fmgcxzel2gvp8pj0xxfmf',
    }))

    return Promise.all([
        fusdXrdReservoir,
        fusdLsuReservoir,
    ] as Promise<FluxPoolResponse>[]).catch(() => [] as FluxPoolResponse[])
}

export type FluxPoolResponse = FluxPoolData & {
    resourceAddress: string
    reservoirComponent: string
}

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
        mode: 'cors',
    }).then((response) => response.json() as Promise<FluxPoolAprResponse>)
}

export interface FluxDepositResponse {
    success: boolean
    data: FluxDepositData
}

interface FluxDepositData {
    amount: number
    collateral: string
    collateralAddress: string
    manifest: string
    oracleMessage: {
        message: string
        signature: string
    }
}

export async function getReservoirDeposit({
    amount,
    collateralAddress,
    accountAddress,
}: {
    amount: string
    collateralAddress: string
    accountAddress: string
}) {
    return fetch(
        'https://flux.ilikeitstable.com/api/flux/get-reservoir-deposit',
        {
            method: 'POST',
            headers: {
                accept: 'application/json',
            },
            body: JSON.stringify({
                amount,
                collateralAddress,
                accountAddress,
            }),
            mode: 'cors',
        }
    ).then((response) => response.json() as Promise<FluxDepositResponse>)
}
