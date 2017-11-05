import * as fs from 'fs';

class Atsamd21 {
    memory: Uint32Array;

    instruction: number;
    registers: number[] = [];

    condN: boolean;
    condZ: boolean;
    condV: boolean;
    condC: boolean;

    // Stack pointer
    readonly spIndex = 13;
    // Link register
    readonly lrIndex = 14;
    // Program counter
    readonly pcIndex = 15;

    readonly debug: boolean = false;

    constructor(memory: Uint8Array) {
        this.memory = memory;
    }

    fetchHalfword(addr: number): number {
        return this.memory[addr] | (this.memory[addr + 1] << 8);
    }

    fetchWord(addr: number): number {
        return this.memory[addr] | (this.memory[addr + 1] << 8) | (this.memory[addr + 2] << 16) | (this.memory[addr + 3] << 24);
    }

    writeWord(addr: number, value: number) {
        for (let i = 0; i < 4; i++) {
            this.memory[addr] = value & 0xff;
            value = value >> 8;
            addr += 1;
        }
    }

    setRegister(index: number, value: number) {
        this.registers[index] = value;
    }

    readRegister(index: number): number {
        return this.registers[index];
    }

    private incrementPc() {
        this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) + 2);
    }

    private incrementSp(count: number = 1) {
        this.setRegister(this.spIndex, this.readRegister(this.spIndex) + count);
    }

    private setSubtractionConditionCodes(arg1: number, arg2: number) {
        let result: number = arg1 - arg2;
        this.condZ = result == 0;
        this.condN = result < 0;
        // todo C, V
    }

    private log(message: string) {
        if (this.debug) {
            console.log(message);
        }
    }

    reset() {
        this.setRegister(this.pcIndex, this.fetchHalfword(0x0004) & ~1); // set bit 0 to 0. 
        this.log(`init pc: ${this.readRegister(this.pcIndex).toString(16)}`);
        // pc one instruction ahead due to pipeline.
        this.incrementPc();
    }

    run() {
        this.reset();
        
        for (var i = 0; i < 48000000; i++) {
            this.instruction = this.fetchHalfword(this.readRegister(this.pcIndex) - 2);
            this.log(`inst at ${(this.readRegister(this.pcIndex) - 2).toString(16)}: ${this.instruction.toString(16)}`);
            this.incrementPc();

            if ((this.instruction & 0b1110000000000000) == 0b0000000000000000) {
                let opcode: number = (this.instruction & 0b0001100000000000) >> 11;
                let offset: number = (this.instruction & 0b0000011111000000) >> 6;
                let rs: number =     (this.instruction & 0b0000000000111000) >> 3;
                let rd: number =     (this.instruction & 0b0000000000000111);
                switch (opcode) {
                    case 0: // LSL
                    this.log(`LSL: rd: ${rd}, rs: ${rs}, offset: ${offset}`);
                        this.setRegister(rd, this.readRegister(rs) << offset);
                        break;
                    case 1: // LSR
                        break;
                    case 2: // ASR
                        break;
                    default: // invalid?
                        break;
                }
            }
            else if ((this.instruction & 0b1110000000000000) == 0b0010000000000000) {
                let opcode: number = (this.instruction & 0b0001100000000000) >> 11;
                let rd: number =     (this.instruction & 0b0000011100000000) >> 8;
                let immediateValue: number = this.instruction & 0b11111111;
                switch (opcode) {
                    case 0: // mov
                        this.log(`Move immediate: rd: ${rd}, immediate value: ${immediateValue}`);
                        this.setRegister(rd, immediateValue);
                        // TODO set flags
                        break;
                    case 1: // cmp
                        break;
                    case 2: // add
                        this.log(`Add immediate: rd: ${rd}, immediate value: ${immediateValue}`)
                        this.setRegister(rd, this.readRegister(rd) + immediateValue);
                        // TODO set flags
                        break;
                    case 3: // sub
                        break;
                }
            }
            else if ((this.instruction & 0b1111110000000000) == 0b0100000000000000) {
                let opcode: number = (this.instruction & 0b0000001111000000) >> 6;
                let rs: number =     (this.instruction & 0b0000000000111000) >> 3;
                let rd: number =     (this.instruction & 0b0000000000000111);
                switch (opcode) {
                    case 0b1010: // CMP Rd, Rs
                        this.log(`cmp ${this.readRegister(rd).toString(16)} ${this.readRegister(rs).toString(16)}`);
                        this.setSubtractionConditionCodes(this.readRegister(rd), this.readRegister(rs));
                        break;
                    default: 
                        // todo
                        break;
                }

            }
            else if ((this.instruction & 0b1111110000000000) == 0b0100010000000000) {
                let opH1H2: number = (this.instruction & 0b0000001111000000) >> 6;
                let rsHs: number =   (this.instruction & 0b0000000000111000) >> 3;
                let rdHd: number =   (this.instruction & 0b0000000000000111);
                switch (opH1H2) {
                    case 0b1101:
                        this.log(`BX ${rsHs + 8}`);
                        this.setRegister(this.pcIndex, this.readRegister(rsHs + 8) & ~1); 
                        this.incrementPc();
                        break;
                    default:
                        // todo 
                        break;
                }
            }
            else if ((this.instruction & 0b1111100000000000) == 0b0100100000000000) {
                let rd: number = (this.instruction & 0b0000011100000000) >> 8;
                let immediateValue: number = (this.instruction & 0xff) << 2;
                let readValue: number = this.fetchWord((this.readRegister(this.pcIndex) & ~0b10) + immediateValue);
                this.log(`PC-relative load: rd: ${rd}, immediate value: ${immediateValue}, read value: ${readValue.toString(16)}`);
                this.setRegister(rd, readValue)
            }
            else if ((this.instruction & 0b1110000000000000) == 0b0110000000000000) {
                let bl: number =     (this.instruction & 0b0001100000000000) >> 11;
                let offset: number = (this.instruction & 0b0000011111000000) >> 6;
                let rb: number =     (this.instruction & 0b0000000000111000) >> 3;
                let rd: number =     (this.instruction & 0b0000000000000111);

                switch (bl) {
                    case 0: // store to memory, transfer word
                        this.log(`store with offset: addr: ${(this.readRegister(rb) + offset).toString(16)}, value: ${this.readRegister(rd).toString(16)}`);
                        this.writeWord(this.readRegister(rb) + offset, this.readRegister(rd));
                        break;
                    default:
                        // todo
                        return;
                }
            }
            else if ((this.instruction & 0b1111011000000000) == 0b1011010000000000) {
                let l: boolean = !!(this.instruction & 0b0000100000000000);
                let r: boolean = !!(this.instruction & 0b0000000100000000);
                this.log(`push/pop reg: load/store: ${l}, pc/lr: ${r}, rlist: ${(0xff & this.instruction).toString(2)}`);
                let mask = 1;
                for (let i = 0; i <= 8; i++) {
                    if (this.instruction & mask) {
                        this.writeWord(this.readRegister(this.spIndex), this.registers[i]);
                        this.incrementSp();
                    }
                    mask = mask << 1;
                }
                if (r) {
                    this.writeWord(this.readRegister(this.spIndex), this.readRegister(this.lrIndex));
                    this.incrementSp();
                }
            }
            
            else if ((this.instruction & 0b1111000000000000) == 0b1101000000000000) {
                let condition: number = (this.instruction & 0b0000111100000000) >> 8;
                let offset: number =    (this.instruction & 0b0000000011111111);
                // Handle negative
                if (offset & 0b10000000) offset |= ~0b11111111;
                offset = offset << 1;
                switch (condition) {
                    case 0b0001: // BNE
                        this.log(`BNE ${offset}`);
                        if (!this.condZ) {
                            this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) - 2 + offset);
                            this.incrementPc();
                        }
                        // else console.log(`EQUAL at ${i}`);
                        break;
                    default:
                        // todo
                        break;
                }
            }
            else if ((this.instruction & 0b1111100000000000) == 0b1110000000000000) {
                let offset: number = (this.instruction & 0b0000011111111111);
                // Handle negative
                if (offset & 0b0000010000000000) offset |= ~0b0000011111111111;
                offset = offset << 1;
                this.log(`unconditional branch to ${(this.readRegister(this.pcIndex) + offset).toString(16)}`)
                this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) + offset);
                this.incrementPc();
            }
            else if ((this.instruction & 0b1111000000000000) == 0b1111000000000000) {
                let low: boolean = !!(this.instruction & 0b0000100000000000);
                let offset: number = this.instruction & 0b0000011111111111;
                if (!low) {
                    // Handle negative
                    if (offset & 0b0000010000000000) offset |= ~0b0000011111111111;
                    this.log(`long branch with link: high, offset: ${offset}`);
                    this.setRegister(this.lrIndex, this.readRegister(this.pcIndex) + (offset << 12));
                }
                else {
                    this.log(`long branch with link: low, offset: ${offset}`);
                    // todo figure out prefetch
                    let nextInstruction: number = this.readRegister(this.pcIndex) - 2;
                    this.setRegister(this.pcIndex, this.readRegister(this.lrIndex) + (offset << 1));
                    this.setRegister(this.lrIndex, nextInstruction | 1);
                    this.incrementPc();
                }
            }
        }
    }
}



fs.readFile('./blinker01.gcc.thumb.flash.bin', function(err, data) {  
    if (err) throw err;
    var memory = new Uint8Array(0x100000);
    for (let i = 0; i < data.length; i++) memory[0x0000 + i] = data[i];

    var micro = new Atsamd21(memory);
    micro.run();
});