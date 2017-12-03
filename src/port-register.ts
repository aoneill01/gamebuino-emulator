import { Atsamd21 } from "./atsamd21";

const DIR_OFFSET: number = 0x00;
const DIRCLR_OFFSET: number = 0x04;
const DIRSET_OFFSET: number = 0x08;
const DIRTGL_OFFSET: number = 0x0C;
const OUT_OFFSET: number = 0x10;
const OUTCLR_OFFSET: number = 0x14;
const OUTSET_OFFSET: number = 0x18;
const OUTTGL_OFFSET: number = 0x1C;
const IN_OFFSET: number = 0x20;

export class PortRegister {
    private _out: number;
    private _in: number;
    private _dir: number;

    private _outListeners: ((mask: number, out: number)=>void)[] = [];
  
    constructor(offset: number, processor: Atsamd21) {
        processor.registerPeripheralReadHandler(offset + OUT_OFFSET, (address: number) => {
            return this._out;
        });
        processor.registerPeripheralReadHandler(offset + OUTCLR_OFFSET, (address: number) => {
            return this._out;
        });
        processor.registerPeripheralReadHandler(offset + OUTSET_OFFSET, (address: number) => {
            return this._out;
        });
        processor.registerPeripheralReadHandler(offset + OUTTGL_OFFSET, (address: number) => {
            return this._out;
        });

        processor.registerPeripheralReadHandler(offset + IN_OFFSET, (address: number) => {
            return this._in;
        });
        
        processor.registerPeripheralReadHandler(offset + DIR_OFFSET, (address: number) => {
            return this._dir;
        });
        processor.registerPeripheralReadHandler(offset + DIRCLR_OFFSET, (address: number) => {
            return this._dir;
        });
        processor.registerPeripheralReadHandler(offset + DIRSET_OFFSET, (address: number) => {
            return this._dir;
        });
        processor.registerPeripheralReadHandler(offset + DIRTGL_OFFSET, (address: number) => {
            return this._dir;
        });

        processor.registerPeripheralWriteHandler(offset + OUT_OFFSET, (address, value) => {
            var diff: number = this._out ^ value;
            this._out = value;
            this.handleOutModified(diff);
        });
        processor.registerPeripheralWriteHandler(offset + OUTCLR_OFFSET, (address, value) => {
            //console.log(`PORT OUTCLR ${address.toString(16)} ${value.toString(16)}`);            
            var newVal = this._out & ~value;
            var diff: number = this._out ^ newVal;
            this._out = newVal;
            this.handleOutModified(diff);
        });
        processor.registerPeripheralWriteHandler(offset + OUTSET_OFFSET, (address, value) => {
            //console.log(`PORT OUTSET ${address.toString(16)} ${value.toString(16)}`);
            var newVal = this._out | value;
            var diff: number = this._out ^ newVal;
            this._out = newVal;
            this.handleOutModified(diff);
        });
        processor.registerPeripheralWriteHandler(offset + OUTTGL_OFFSET, (address, value) => {
            var newVal = this._out ^ value;
            var diff: number = this._out ^ newVal;
            this._out = newVal;
            this.handleOutModified(diff);
        });
        
        processor.registerPeripheralWriteHandler(offset + DIR_OFFSET, (address, value) => {
            this._dir = this._dir ^ value;
        });
        processor.registerPeripheralWriteHandler(offset + DIRCLR_OFFSET, (address, value) => {
            this._dir = this._dir & ~value;
        });
        processor.registerPeripheralWriteHandler(offset + DIRSET_OFFSET, (address, value) => {
            //console.log(`PORT DIRSET ${address.toString(16)} ${value.toString(16)}`);
            this._dir = this._dir | value;
        });
        processor.registerPeripheralWriteHandler(offset + DIRTGL_OFFSET, (address, value) => {
            this._dir = this._dir ^ value;
        });
    }

    addOutListener(listener: (mask: number, out: number)=>void) {
        this._outListeners.push(listener);
    }

    private handleOutModified(diff: number) {
        if (diff) {
            this._outListeners.forEach(listener => {
                listener(diff, this._out);
            });
        }
    }

    getOut() {
        return this._out;
    }
}