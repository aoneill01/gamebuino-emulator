export function decode(hex: string, byteCount: number) : Int8Array {
    let result: Int8Array = new Int8Array(byteCount)

    for (let line of hex.split(/\r?\n/)) {
        if (decodeLine(line, result)) {
            return result
        }
    }

    throw new Error('No end-of-file record')
}

function decodeLine(line: string, array: Int8Array) : boolean {
    // if (line.charAt(0) != ':') throw new Error('Line must start with colon')
    return false
}