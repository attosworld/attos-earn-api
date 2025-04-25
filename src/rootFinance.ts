import fetch from 'node-fetch'
import {
    XRD_RESOURCE_ADDRESS,
    XUSDC_RESOURCE_ADDRESS,
} from './resourceAddresses'

// Types for the response
export interface PoolState {
    address: string
    unit_to_asset_ratio: string
    ratio_loan: string
    total_loan_unit: string
    total_loan: string
    ratio_deposit: string
    total_deposit_unit: string
    total_deposit: string
    total_reserved_amount: string
}

export interface RootFinancePoolStateResponse {
    states: PoolState[]
}

export async function getRootFinancePoolState(): Promise<RootFinancePoolStateResponse | null> {
    try {
        const response = await fetch(
            'https://backend-prod.rootfinance.xyz/api/markets/pool-state',
            {
                headers: {
                    accept: 'application/json, text/plain, */*',
                },
                method: 'GET',
            }
        )

        if (!response.ok) {
            console.error(
                `getRootFinancePoolState : HTTP error! status: ${response.status}`
            )
            return null
        }

        return (await response.json()) as RootFinancePoolStateResponse
    } catch (error) {
        console.error('Error fetching Root Finance pool state:', error)
        throw error
    }
}

export const BORROW_MANIFEST = `CALL_METHOD
Address("component_rdx1cpd6et0fy7jua470t0mn0vswgc8wzx52nwxzg6dd6rel0g0e08l0lu")
"charge_royalty"
;
CALL_METHOD
  Address("{account}")
  "withdraw"
  Address("${XUSDC_RESOURCE_ADDRESS}")
  Decimal("{xusdcAmount}")
;
TAKE_ALL_FROM_WORKTOP
  Address("${XUSDC_RESOURCE_ADDRESS}")
  Bucket("bucket_0")
;
CALL_METHOD
  Address("component_rdx1crwusgp2uy9qkzje9cqj6pdpx84y94ss8pe7vehge3dg54evu29wtq")
  "contribute"
  Bucket("bucket_0")
;
TAKE_ALL_FROM_WORKTOP
  Address("resource_rdx1tk024ja6xnstalrqk7lrzhq3pgztxn9gqavsuxuua0up7lqntxdq2a")
  Bucket("bucket_1")
;
CALL_METHOD
  Address("component_rdx1crwusgp2uy9qkzje9cqj6pdpx84y94ss8pe7vehge3dg54evu29wtq")
  "create_cdp"
  Enum<0u8>()
  Enum<0u8>()
  Enum<0u8>()
  Array<Bucket>(
    Bucket("bucket_1")
  )
;
TAKE_ALL_FROM_WORKTOP
  Address("resource_rdx1ngekvyag42r0xkhy2ds08fcl7f2ncgc0g74yg6wpeeyc4vtj03sa9f")
  Bucket("nft")
;
CREATE_PROOF_FROM_BUCKET_OF_ALL
  Bucket("nft")
  Proof("nft_proof")
;
CALL_METHOD
  Address("component_rdx1crwusgp2uy9qkzje9cqj6pdpx84y94ss8pe7vehge3dg54evu29wtq")
  "borrow"
  Proof("nft_proof")
  Array<Tuple>(
    Tuple(
      Address("${XRD_RESOURCE_ADDRESS}"),
      Decimal("{borrowXrdAmount}")
    )
  )
;
CALL_METHOD
  Address("{account}")
  "deposit_batch"
  Expression("ENTIRE_WORKTOP")
;`
