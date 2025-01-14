import assert from "assert"
import basex from "base-x"
import blake2b from "blake2b"
const base58 = basex('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz')
const HASH_PREFIX = Buffer.from('SS58PRE')
const HASH_BUF = Buffer.alloc(64)

/**
 * Decoded SS58 address
 */
export interface Address {
    /**
     * Address [type](https://docs.substrate.io/v3/advanced/ss58/#address-type)
     */
    prefix: number
    /**
     * Raw address bytes
     */
    bytes: Uint8Array
}


/**
 * Decode SS58 address string.
 *
 * This function follows [Ss58Codec trait](https://github.com/paritytech/substrate/blob/ded44948e2d5a398abcb4e342b0513cb690961bb/primitives/core/src/crypto.rs#L245)
 */
export function decode(s: string): Address {
    let buf = base58.decodeUnsafe(s)
    if (buf == null || buf.length < 3) throw invalidAddress(s)
    let b0 = buf[0]
    let offset
    let prefix
    if (b0 < 64) {
        prefix = b0
        offset = 1
    } else if (b0 < 128) {
        let b1 = buf[1]
        let lower = ((b0 << 2) | (b1 >> 6)) & 0b11111111
        let upper = b1 & 0b00111111
        prefix = lower | (upper << 8)
        offset = 2
    } else {
        throw invalidAddress(s)
    }
    computeHash(buf)
    if (HASH_BUF[0] != buf[buf.length - 2] || HASH_BUF[1] != buf[buf.length - 1]) {
        throw invalidAddress(s)
    }
    return {
        prefix,
        bytes: buf.subarray(offset, buf.length - 2)
    }
}


/**
 * Encode SS58 address into canonical string format
 */
export function encode(address: Address): string {
    let prefix = address.prefix
    assert(Number.isInteger(prefix) && prefix >= 0 && prefix < 16384, 'invalid prefix')
    let len = address.bytes.length
    let buf
    let offset
    if (prefix < 64) {
        buf = Buffer.allocUnsafe(3 + len)
        buf[0] = prefix
        offset = 1
    } else {
        buf = Buffer.allocUnsafe(4 + len)
        buf[0] = ((prefix & 0b1111_1100) >> 2) | 0b01000000
        buf[1] = (prefix >> 8) | ((prefix & 0b11) << 6)
        offset = 2
    }
    buf.set(address.bytes, offset)
    computeHash(buf)
    buf[buf.length - 2] = HASH_BUF[0]
    buf[buf.length - 1] = HASH_BUF[1]
    return base58.encode(buf)
}


function computeHash(buf: Uint8Array): void {
    let hash = blake2b(64)
    hash.update(HASH_PREFIX)
    hash.update(buf.subarray(0, buf.length - 2))
    hash.digest(HASH_BUF)
}


function invalidAddress(s: string): Error {
    return new Error('Invalid ss58 address: ' + s)
}
