export function decode(hex: string, byteCount: number) : Int8Array {
    let result: Int8Array = new Int8Array(byteCount)

    for (let line of hex.split(/\r?\n/)) {
        if (decodeLine(line, result)) {
            return result
        }
    }

    throw new Error('No end-of-file record')
}

enum RecordType {
    Data = 0,
    EndOfFile = 1, 
    ExtendedSegmentAddress = 2,
    StartSegmentAddress = 3,
    ExtendedLinearAddress = 4,
    StartLinearAddress = 5
}

function decodeLine(line: string, data: Int8Array) : boolean {
    if (line.charAt(0) != ':') throw new Error('Line must start with colon')

    let byteCount = hexToNumber(line, 0, 1)
    let address = hexToNumber(line, 1, 2)
    let recordType = hexToNumber(line, 3, 1)
    let checksum = hexToNumber(line, 4 + byteCount, 1)

    if (checksum != calculateChecksum(line)) throw Error('Invalid checksum');

    switch (recordType) {
        case RecordType.Data:
            for (let i = 0; i < byteCount; i++) {
                data[address + i] = hexToNumber(line, 4 + i, 1)
            }
            break
        case RecordType.EndOfFile:
            return true
        // TODO Other record types
    }

    return false
}

function hexToNumber(line: string, start: number, length: number) : number {
    if (1 + 2 * (start + length) > line.length) throw new Error('Line too short')

    return parseInt(line.substring(1 + start * 2, 1 + 2 * (start + length)), 16)
}

function calculateChecksum(line: string) : number {
    let sum = 0;
    for (let i = 0; i < hexToNumber(line, 0, 1) + 4; i++) {
        sum += hexToNumber(line, i, 1)
    }
    return (0x100 - (sum & 0xff)) & 0xff;
}