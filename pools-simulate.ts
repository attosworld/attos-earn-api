import {
    type FungibleResourcesCollectionItemGloballyAggregated,
    type ProgrammaticScryptoSborValueTuple,
    type StateEntityDetailsRequest,
    type StateEntityDetailsResponseComponentDetails,
    type StateEntityDetailsResponseFungibleResourceDetails,
    type StateEntityFungiblesPageRequest,
} from '@radixdlt/babylon-gateway-api-sdk'
import BigNumber from 'bignumber.js'
import { XRD_RESOURCE_ADDRESS } from './src/resourceAddresses'
import { gatewayApi } from '.'
import { getVolumeAndTokenMetadata } from './src/defiplaza'

// Global cache for LP pool data
const GLOBAL_LP_CACHE: Record<
    string,
    Record<
        string,
        {
            date: string
            totalSupplyLP: string
            'xrd-priceUSD': string
            values: Record<string, BigNumber>
            p0: string
            target_ratio: string
        }
    >
> = {}

// HUG
// const baseToken = 'resource_rdx1t5kmyj54jt85malva7fxdrnpvgfgs623yt7ywdaval25vrdlmnwe97';
// // 1% pool
// // const OCI_LP = 'resource_rdx1t5suu53gjzj2fx2tphgeqk4z5k2mygjw2fr7gel6vpxqw50hwpnvny';
// // const OCI_POOL = 'pool_rdx1c57rem0vrrv3wh7c5cjz63ww7se0a3cu9f7zd8az2qxtphgu72r0as';
// // 0.3% pool
// const OCI_LP = 'resource_rdx1th0mdz8zw6rdprgn0p5myql0qepjzq2k682mju2ryn9e729ruhua4a';
// const OCI_POOL = 'pool_rdx1c47dzmdpmc7wx3u6vp40qf960w23yxfp50y4er8426juftgjgefjem';

// XRD
// const baseToken = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
// const OCI_LP = 'resource_rdx1t4tz50azduex9ka66cszd62xwv87gjsh36lrvyz49dnwr2m207tq4e';
// const OCI_POOL = 'pool_rdx1c4rcj58mh6kcf2wsvcap0zj9e42hcjz65me5dk73mjzjy3qep5yvxa';

// GAB
// const baseToken = 'resource_rdx1tknu3dqlkysz9lt08s7spuvllz3kk2k2yccslfpdk73t4lnznl9jck';
// const OCI_LP = 'resource_rdx1t4knl50feey02lamt2kz0xpz97kv96p8m2ganrqk2jmxwttkpumyy2';
// const OCI_POOL = 'pool_rdx1ckepm8acua47w874f3luw28lv8z2metxtdr7jk77kvxrrcvxjrrj4v';

// // Early
// const baseToken = 'resource_rdx1t5xv44c0u99z096q00mv74emwmxwjw26m98lwlzq6ddlpe9f5cuc7s';
// const OCI_LP = 'resource_rdx1t5362v5zqsfkfe38uyl368edpsdm23u5g69qt55jn0ye8nf6umnnv9';
// const OCI_POOL = 'pool_rdx1c5hm2rt67scp22pq6tpkfg6cd22g0wwz88065wsy9gdfnd86sv3t4t';

// Dextr
// const baseToken = 'resource_rdx1tkktjr0ew96se7wpsqxxvhp2vr67jc8anq04r5xkgxq3f0rg9pcj0c';
// const OCI_LP = 'resource_rdx1t4mxtwckz000v0chw49860znrc6trv0z77acq0a0lq9zryz66dnrnq';
// const OCI_POOL = 'pool_rdx1c5uvsp2ngznwew2q2thhye8n2h25e0cqg763cwet9f77z0gwqzzzkj';

// MNI
// const baseToken = 'resource_rdx1t5fut5566uvkrgf6fltt7pxcdcjs42ydgc5tm3gj8qzaag7xkqn4lg';
// const OCI_LP = 'resource_rdx1t4ssu5d6jcuhctrvl97er9n4w0pydvqyjr6kzmjspyteg5gx68298w';
// const OCI_POOL = 'pool_rdx1ckav94kw3ltam0l6nddfl0xzdd6atw0nf8feu7wean3yjrcug6ep9k';

// RDK
// const baseToken = 'resource_rdx1t4zrksrzh7ucny7r57ss99nsrxscqwh8crjn6k22m8e9qyxh8c05pl';
// const OCI_LP = 'resource_rdx1t54hf7nvxmg64qyve7wtqhr993ty0wglex8c2gng26rwkxlcle8fvq';
// const OCI_POOL = 'pool_rdx1c5zgqjgdgyw5xunzdr8j9ueue58t866u5maghksf2ha9lz2gk4xv25';

// // Weft
// const baseToken = 'resource_rdx1tk3fxrz75ghllrqhyq8e574rkf4lsq2x5a0vegxwlh3defv225cth3';
// const OCI_LP = 'resource_rdx1th5slwxk8x8xs7438ek6kp7kvrz5lxuu823tql4dqvd92q2fzxr3aq';
// const OCI_POOL = 'pool_rdx1ck5w5vnm6qwrmcp4way3wtyjztk7armjea3xc5xaktlk9r4gq6s3ee';

// FLOOP
// const baseToken = 'resource_rdx1t5pyvlaas0ljxy0wytm5gvyamyv896m69njqdmm2stukr3xexc2up9';
// const OCI_LP = 'resource_rdx1t4832rmztxfrgm5n9dr0phjv6qahvlqykql56rd26qpwuxpt992ftl';
// const OCI_POOL = 'pool_rdx1ch56t5mztc4h0glwsxrk0lrc7w7qyzqa2083u4nzf0a84sxpvf0tt5';

// OCI
// const baseToken = 'resource_rdx1t52pvtk5wfhltchwh3rkzls2x0r98fw9cjhpyrf3vsykhkuwrf7jg8';
// const OCI_LP = 'resource_rdx1th7ew2u9c9t00xhk34efm9uj8zxnme48h4ypuerv5uu4ftz8j82gdm';
// const OCI_POOL = 'pool_rdx1ckyg8aujf09uh8qlz6asst75g5w6pl6vu8nl6qrhskawcndyk6585y';

// ASTRL
// const baseToken = 'resource_rdx1t4tjx4g3qzd98nayqxm7qdpj0a0u8ns6a0jrchq49dyfevgh6u0gj3';
// const OCI_LP = 'resource_rdx1t5e99f88nkmvx38nmg6s48m5et9zxavqaxyxpv043kavu2n64pffpk';
// const OCI_POOL = 'pool_rdx1chccz7xl280el9s77uhlcy76ldt5ysvd6gxrgu4tjgrw3rrmqmj3e6';

// DGC
// const baseToken = 'resource_rdx1tk2ekrvckgptrtls6zp0uautg8t34nzl3h93vagt66k49vh757w5px';
// const OCI_LP = 'resource_rdx1tkpevy7ysc29j4ftja3djnt9z27eh5cgarprgt2wagpuxr67qg7u4w';
// const OCI_POOL = 'pool_rdx1c4drahjct9vwprr9ypsn6z60rp7rmn04txppmw0jpwa3w3xtmxv7u6';

// FOTON
// const baseToken = 'resource_rdx1t4km4k306ul40s3zr8zwwrm25xfmx7w8ytjvdwqh0u3kkch0eph9rn';
// const OCI_LP = 'resource_rdx1t4qhd5m0z0wgqhc522j2kmshxpt9hha9n7rw5espdr3m7uljdn83jh';
// const OCI_POOL = 'pool_rdx1c59jpe57uhlpcslfjh4lvkmgdx0pchdr3py6ncncm6x9trpg82k47w';

// WOWO
// const baseToken = 'resource_rdx1t4kc5ljyrwlxvg54s6gnctt7nwwgx89h9r2gvrpm369s23yhzyyzlx';
// const OCI_LP = 'resource_rdx1t4ujaludtcppy4ynqmjqycnez9zmyny2c8nkk7gy3xfnxpq0n54sma';
// const OCI_POOL = 'pool_rdx1ck7q3g6gwmfjdzgvl6nmpkrwx5clvl6rp6hnv0tvxsadsetajgu2na';

// SRG
// const baseToken = 'resource_rdx1tka3kqqkjxcpddvcx0u300qt66z3tlzv7swqx9rklp60m5yqry6yzk';
// const OCI_LP = 'resource_rdx1tkl2lw7mjrvwcsuymcdknrpsugdggzmceqd77kcp4c22ysk4grym0m';
// const OCI_POOL = 'pool_rdx1c587dvtqvvpvxdp30kd27zqfzffustfgcxtzk77puxeckuv9rxd2z5';

// ILIS
// const baseToken = 'resource_rdx1t4r86qqjtzl8620ahvsxuxaf366s6rf6cpy24psdkmrlkdqvzn47c2';
// const OCI_LP = 'resource_rdx1t4vvunhvl24nrc8hh99dujuumyllvvsurvu72keaeh74e25358nhah';
// const OCI_POOL = 'pool_rdx1ck0daslg9anw64t5ytq0g4svmuj85jwvrrhgz2005exh8gt6qxle4w';

// Deliver
// const baseToken =
//     'resource_rdx1t466mhd2l2jmmzxr8cg3mkwjqhs7zmjgtder2utnh0ue5msxrhyk3t'
// const OCI_LP = ''
// const OCI_POOL = ''

// const type = 'quote'
// const type = 'quote';
// const type = 'oci';

export async function getLpPerformance(
    baseToken: string,
    type: 'base' | 'quote',
    userLpAmount?: string
) {
    const pair = await getVolumeAndTokenMetadata(baseToken)

    if (!pair) {
        return
    }

    const date = new Date()
    date.setDate(date.getDate() - 30)
    date.setDate(date.getDate() + 1)

    const tzOffset = (date.getTimezoneOffset() / 60) * -1
    date.setHours(tzOffset, 0, 0, 0)

    // let date = new Date('2024-11-04 0:00:00')
    const now = new Date()
    const globalValuesByDate: Record<string, number> = {}
    const userValuesByDate: Record<string, number> = {}

    while (date < now) {
        const xrd = await fetchOrGetPrice(XRD_RESOURCE_ADDRESS, date)
        const dateKey = date.toISOString().split('T')[0] // Format as YYYY-MM-DD

        if (type == 'base') {
            const lpToken = pair.baseLPToken
            const isoDateKey = date.toISOString()

            // Check if we already have this data in cache
            if (!GLOBAL_LP_CACHE[lpToken]) {
                GLOBAL_LP_CACHE[lpToken] = {}
            }

            if (!GLOBAL_LP_CACHE[lpToken][isoDateKey]) {
                const [supply] = await fetchTotalSupply([lpToken], date)
                const values = await fetchPoolValue(pair.basePool, date)
                const state = await fetchPoolStates(pair.component, date)

                GLOBAL_LP_CACHE[lpToken][isoDateKey] = {
                    date: isoDateKey,
                    totalSupplyLP: supply.totalSupply,
                    values,
                    'xrd-priceUSD': xrd.tokenPriceUSD,
                    p0: state?.p0,
                    target_ratio: state?.target_ratio,
                }
            }

            const cachedData = GLOBAL_LP_CACHE[lpToken][isoDateKey]

            // Calculate total XRD value of all tokens in the pool
            let totalXrdValue = new BigNumber(0)
            Object.entries(cachedData.values).forEach(([key, value]) => {
                if (!key.includes('-price')) {
                    const tokenAmount = new BigNumber(value)
                    const tokenPriceXRD = new BigNumber(
                        cachedData.values[`${key}-priceXRD`] || 0
                    )
                    totalXrdValue = totalXrdValue.plus(
                        tokenAmount.multipliedBy(tokenPriceXRD)
                    )
                }
            })

            // Store global value
            globalValuesByDate[dateKey] = totalXrdValue.toNumber()

            // Calculate user value if userLpAmount is provided
            if (userLpAmount) {
                const userShare = new BigNumber(userLpAmount).dividedBy(
                    cachedData.totalSupplyLP
                )
                const userXrdValue = totalXrdValue.multipliedBy(userShare)
                userValuesByDate[dateKey] = userXrdValue.toNumber()
            }
        } else if (type == 'quote') {
            const lpToken = pair.quoteLPToken
            const isoDateKey = date.toISOString()

            // Check if we already have this data in cache
            if (!GLOBAL_LP_CACHE[lpToken]) {
                GLOBAL_LP_CACHE[lpToken] = {}
            }

            if (!GLOBAL_LP_CACHE[lpToken][isoDateKey]) {
                const [supply] = await fetchTotalSupply([lpToken], date)
                const values = await fetchPoolValue(pair.quotePool, date)
                const state = await fetchPoolStates(pair.component, date)

                GLOBAL_LP_CACHE[lpToken][isoDateKey] = {
                    date: isoDateKey,
                    totalSupplyLP: supply.totalSupply,
                    values,
                    'xrd-priceUSD': xrd.tokenPriceUSD,
                    p0: state?.p0,
                    target_ratio: state?.target_ratio,
                }
            }

            const cachedData = GLOBAL_LP_CACHE[lpToken][isoDateKey]

            // Calculate total XRD value of all tokens in the pool
            let totalXrdValue = new BigNumber(0)
            Object.entries(cachedData.values).forEach(([key, value]) => {
                if (!key.includes('-price')) {
                    const tokenAmount = new BigNumber(value)
                    const tokenPriceXRD = new BigNumber(
                        cachedData.values[`${key}-priceXRD`] || 0
                    )
                    totalXrdValue = totalXrdValue.plus(
                        tokenAmount.multipliedBy(tokenPriceXRD)
                    )
                }
            })

            // Store global value
            globalValuesByDate[dateKey] = totalXrdValue.toNumber()

            // Calculate user value if userLpAmount is provided
            if (userLpAmount) {
                const userShare = new BigNumber(userLpAmount).dividedBy(
                    cachedData.totalSupplyLP
                )
                const userXrdValue = totalXrdValue.multipliedBy(userShare)
                userValuesByDate[dateKey] = userXrdValue.toNumber()
            }
        }

        date.setDate(date.getDate() + 1)
        console.log(date)
    }

    return globalValuesByDate
}

async function fetchPoolValue(poolAddress: string, date: Date) {
    const query: StateEntityFungiblesPageRequest = {
        address: poolAddress,
        at_ledger_state: {
            timestamp: date,
        },
    }

    const walletState = await gatewayApi.state.innerClient.entityFungiblesPage({
        stateEntityFungiblesPageRequest: query,
    })

    const values = {} as {
        [token: string]: BigNumber
    }

    for (const item of walletState.items) {
        const price = await fetchOrGetPrice(item.resource_address, date)

        if (!price.tokenPriceXRD) {
            console.log(`--- oops`, date, item.resource_address)
        }

        values[item.resource_address] = BigNumber(
            (item as FungibleResourcesCollectionItemGloballyAggregated).amount
        )
        values[item.resource_address + '-priceXRD'] = BigNumber(
            price.tokenPriceXRD
        )
    }

    return values
}

async function batchFetchPoolStates(componentAddress: string[], date: Date) {
    const componentDetails =
        await gatewayApi.state.getEntityDetailsVaultAggregated(
            componentAddress,
            {},
            {
                timestamp: date,
            }
        )

    return componentDetails.map((componentDetails) => {
        for (const field of (
            (componentDetails.details as StateEntityDetailsResponseComponentDetails)!
                .state as unknown as ProgrammaticScryptoSborValueTuple
        ).fields) {
            if (field.field_name == 'state' && field.kind === 'Tuple') {
                const pairState = {
                    p0: 0,
                    shortage: 'Equilibrium',
                    target_ratio: 0,
                    last_outgoing: 0,
                    last_out_spot: 0,
                } as Record<string, unknown>

                type Key = keyof typeof pairState

                for (const stateField of field.fields) {
                    if (stateField.field_name) {
                        if (stateField.kind == 'Enum') {
                            pairState[stateField.field_name as Key] =
                                stateField.variant_name as string
                        } else if ('value' in stateField) {
                            pairState[stateField.field_name as Key] =
                                stateField.value
                        }
                    }
                }

                return pairState
            }
        }
    }) as Record<string, unknown>[]
}

async function fetchPoolStates(componentAddress: string, date: Date) {
    const componentDetails =
        await gatewayApi.state.getEntityDetailsVaultAggregated(
            componentAddress,
            {},
            {
                timestamp: date,
            }
        )

    for (const field of (
        (componentDetails.details as StateEntityDetailsResponseComponentDetails)!
            .state as unknown as ProgrammaticScryptoSborValueTuple
    ).fields) {
        if (field.field_name == 'state' && field.kind === 'Tuple') {
            const pairState = {
                p0: 0,
                shortage: 'Equilibrium',
                target_ratio: 0,
                last_outgoing: 0,
                last_out_spot: 0,
            } as Record<string, unknown>

            type Key = keyof typeof pairState

            for (const stateField of field.fields) {
                if (stateField.field_name) {
                    if (stateField.kind == 'Enum') {
                        pairState[stateField.field_name as Key] =
                            stateField.variant_name as string
                    } else if ('value' in stateField) {
                        pairState[stateField.field_name as Key] =
                            stateField.value
                    }
                }
            }

            return pairState as { p0: string; target_ratio: string }
        }
    }
    return { p0: '', target_ratio: '' }
}

export async function fetchTotalSupply(addresses: string[], date: Date) {
    const query: StateEntityDetailsRequest = {
        addresses,
        at_ledger_state: {
            timestamp: date,
        },
    }

    const tokenDetails = await gatewayApi.state.innerClient.stateEntityDetails({
        stateEntityDetailsRequest: query,
    })

    const supplies = []

    for (const detail of tokenDetails.items) {
        supplies.push({
            address: detail.address,
            totalSupply: (
                detail.details as StateEntityDetailsResponseFungibleResourceDetails
            ).total_supply,
        })
    }

    return supplies
}

const THIRTY_DAY_PRICE_HISTORY_CACHE: Record<
    number,
    Record<string, unknown>
> = {}

async function fetchOrGetPrice(tokenAddress: string, date: Date) {
    if (THIRTY_DAY_PRICE_HISTORY_CACHE[date.getTime()]) {
        return THIRTY_DAY_PRICE_HISTORY_CACHE[date.getTime()][tokenAddress]
    }
    const price = await fetchPrice(tokenAddress, date)
    THIRTY_DAY_PRICE_HISTORY_CACHE[date.getTime()] = price

    return price
}

async function fetchPrice(tokenAddress: string, date: Date) {
    return fetch(
        `https://api.astrolescent.com/partner/defiplaza/prices?address=${tokenAddress}&timestamp=${date.getTime()}`
    ).then((res) => res.json())
}
