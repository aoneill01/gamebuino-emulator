import { Atsamd21 } from "./atsamd21";

const SCS_ADDR: number = 0xE000E000 >>> 0;
const SETENA_OFFSET: number = 0x100;
const CLRENA_OFFSET: number = 0x180;

export class ScsRegisters {
    constructor(processor: Atsamd21) {

        processor.registerPeripheralWriteHandler(SCS_ADDR + SETENA_OFFSET, (address: number, value: number) => {
            console.log(`In SETENA (${address.toString(16)} ${value.toString(2)})`);
        });

    }
}