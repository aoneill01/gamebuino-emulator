import { decode } from './intel-hex';
import { expect } from 'chai';
import 'mocha';

describe('decode function', () => {
    const simpleHex: string = 
`:10010000214601360121470136007EFE09D2190140
:100110002146017E17C20001FF5F16002148011928
:10012000194E79234623965778239EDA3F01B2CAA7
:100130003F0156702B5E712B722B732146013421C7
:00000001FF`

    it('should throw when no eof', () => {
        expect(decode.bind(this, ':10010000214601360121470136007EFE09D2190140', 0x0200))
            .to.throw('No end-of-file record')
    })

    it('should throw when line does not start with colon', () => {

    })

    it('should parse a simple hex string', () => {
        let result = decode(simpleHex, 0x0200)
        expect(result[0x0100]).to.equal(0x21)
        expect(result[0x010f]).to.equal(0x01)
        expect(result[0x0130]).to.equal(0x00)
        expect(result[0x013f]).to.equal(0x21)
    })

});