export class Atsamd21 {
    private _flash: Uint8Array;
    private _sram: Uint8Array;
    private _decodedInstructions: {():void}[] = [];

    registers: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    condN: boolean;
    condZ: boolean;
    condV: boolean;
    condC: boolean;

    peripheralCallback: (addr: number, value: number) => void;

    foo: number;

    // Stack pointer
    readonly spIndex = 13;
    // Link register
    readonly lrIndex = 14;
    // Program counter
    readonly pcIndex = 15;

    readonly debug: boolean = false;

    constructor() {
        this._flash = new Uint8Array(0x40000); // 256KB 
        for (var i = 0; i < this._flash.length; i++) this._flash[i] = 0xff;
        this._sram = new Uint8Array(0x8000); // 32KB 
        for (var i = 0; i < this._sram.length; i++) this._sram[i] = 0xff;
    }

    loadFlash(contents: Uint8Array, offset: number = 0) {
        for (var i = 0; i < contents.length; i++) {
            this._flash[i + offset] = contents[i];
        }
        this.reset();

        this._decodedInstructions = [];
        this.decodeInstructions();
    }

    fetchHalfword(addr: number): number {
        return this._flash[addr] | (this._flash[addr + 1] << 8);
    }

    fetchWord(addr: number): number {
        return this._flash[addr] | (this._flash[addr + 1] << 8) | (this._flash[addr + 2] << 16) | (this._flash[addr + 3] << 24);
    }

    writeWord(addr: number, value: number) {
        // Flash
        if (addr < 0x20000000) {
            this._flash[addr] = value & 0xff;
            this._flash[addr + 1] = (value >> 8) & 0xff;
            this._flash[addr + 2] = (value >> 16) & 0xff;
            this._flash[addr + 3] = (value >> 24) & 0xff;
        }
        // SRAM
        else if (addr < 0x40000000) {
            addr -= 0x20000000;
            this._sram[addr] = value & 0xff;
            this._sram[addr + 1] = (value >> 8) & 0xff;
            this._sram[addr + 2] = (value >> 16) & 0xff;
            this._sram[addr + 3] = (value >> 24) & 0xff;
        }
        // Peripheral 
        else if (addr < 0x60000000) {
            if (this.peripheralCallback) {
                this.peripheralCallback(addr, value);
            }
            
            if (addr == 0x41004418) {
                console.log('LIGHT ON');
            }
            if (addr == 0x41004414) {
                console.log('LIGHT OFF');
            }
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

    private setStatusRegister(arg1: number, arg2: number, result: number) {
        this.condZ = result == 0;
        this.condN = !!(result & 0x80000000);
        // todo C, V
    }

    private log(message: string) {
        if (this.debug) {
            console.log(message);
        }
    }

    reset() {
        this.setRegister(this.spIndex, this.fetchWord(0x0000));
        this.setRegister(this.lrIndex, 0xffffffff);
        this.setRegister(this.pcIndex, this.fetchHalfword(0x0004) & ~1); // set bit 0 to 0. 
        this.log(`init pc: ${this.readRegister(this.pcIndex).toString(16)}`);
        // pc one instruction ahead due to pipeline.
        this.incrementPc();
    }

    step() {
        // console.log(`0x${(this.readRegister(this.pcIndex) - 2).toString(16)}`);
        var instructionHandler = this._decodedInstructions[this.readRegister(this.pcIndex) - 2];
        this.incrementPc();
        instructionHandler();
    }

    speedTestNop() {
        var instructionHandler = this._decodedInstructions[0];        
        instructionHandler();
    }

    private decodeInstructions() {
        for (var instructionIndex: number = 0; instructionIndex < this._flash.length; instructionIndex += 2) {
            // console.log(`${instructionIndex.toString(16)} of ${this._flash.length.toString(16)}`);
            var instruction: number;
        
            instruction = this.fetchHalfword(instructionIndex);
            // this.log(`inst at ${instructionIndex.toString(16)}: ${instruction.toString(16)}`);
            
            if ((instruction & 0b1110000000000000) == 0b0000000000000000) {
                let opcode: number = (instruction & 0b0001100000000000) >> 11;
                let offset: number = (instruction & 0b0000011111000000) >> 6;
                let rs: number =     (instruction & 0b0000000000111000) >> 3;
                let rd: number =     (instruction & 0b0000000000000111);
                switch (opcode) {
                    case 0: // LSL
                        this._decodedInstructions[instructionIndex] = () => {
                            // this.log(`LSL: rd: ${rd}, rs: ${rs}, offset: ${offset}`);
                            this.setRegister(rd, this.readRegister(rs) << offset);
                        }
                        break;
                    case 1: // LSR
                        break;
                    case 2: // ASR
                        break;
                    default: // invalid?
                        break;
                }
            }
            else if ((instruction & 0b1110000000000000) == 0b0010000000000000) {
                let opcode: number = (instruction & 0b0001100000000000) >> 11;
                let rd: number =     (instruction & 0b0000011100000000) >> 8;
                let immediateValue: number = instruction & 0b11111111;
                switch (opcode) {
                    case 0: // mov
                        this._decodedInstructions[instructionIndex] = () => {
                            // this.log(`Move immediate: rd: ${rd}, immediate value: ${immediateValue}`);
                            this.setRegister(rd, immediateValue);
                            // TODO set flags
                        };
                        break;
                    case 1: // cmp
                        break;
                    case 2: // add
                        this._decodedInstructions[instructionIndex] = () => {
                            // this.log(`Add immediate: rd: ${rd}, immediate value: ${immediateValue}`)
                            this.setRegister(rd, this.readRegister(rd) + immediateValue);
                            // TODO set flags
                        };
                        break;
                    case 3: // sub
                        break;
                }
            }
            else if ((instruction & 0b1111110000000000) == 0b0100000000000000) {
                let opcode: number = (instruction & 0b0000001111000000) >> 6;
                let rs: number =     (instruction & 0b0000000000111000) >> 3;
                let rd: number =     (instruction & 0b0000000000000111);
                switch (opcode) {
                    case 0b1010: // CMP Rd, Rs
                        this._decodedInstructions[instructionIndex] = () => {
                            // this.log(`cmp ${this.readRegister(rd).toString(16)} ${this.readRegister(rs).toString(16)}`);
                            this.setStatusRegister(this.readRegister(rd), this.readRegister(rs), this.readRegister(rd) - this.readRegister(rs));
                        };
                        break;
                    default: 
                        // todo
                        break;
                }

            }
            else if ((instruction & 0b1111110000000000) == 0b0100010000000000) {
                let opH1H2: number = (instruction & 0b0000001111000000) >> 6;
                let rsHs: number =   (instruction & 0b0000000000111000) >> 3;
                let rdHd: number =   (instruction & 0b0000000000000111);
                switch (opH1H2) {
                    case 0b1101:
                        this._decodedInstructions[instructionIndex] = () => {
                            // this.log(`BX ${rsHs + 8}`);
                            this.setRegister(this.pcIndex, this.readRegister(rsHs + 8) & ~1); 
                            this.incrementPc();
                        };
                        break;
                    default:
                        // todo 
                        break;
                }
            }
            else if ((instruction & 0b1111100000000000) == 0b0100100000000000) {
                let rd: number = (instruction & 0b0000011100000000) >> 8;
                let immediateValue: number = (instruction & 0xff) << 2;
                this._decodedInstructions[instructionIndex] = () => {
                    var readValue: number = this.fetchWord((this.readRegister(this.pcIndex) & ~0b10) + immediateValue);
                    // this.log(`PC-relative load: rd: ${rd}, immediate value: ${immediateValue}, read value: ${readValue.toString(16)}`);
                    this.setRegister(rd, readValue);
                };
            }
            else if ((instruction & 0b1110000000000000) == 0b0110000000000000) {
                let bl: number =     (instruction & 0b0001100000000000) >> 11;
                let offset: number = (instruction & 0b0000011111000000) >> 6;
                let rb: number =     (instruction & 0b0000000000111000) >> 3;
                let rd: number =     (instruction & 0b0000000000000111);

                switch (bl) {
                    case 0: // store to memory, transfer word
                        this._decodedInstructions[instructionIndex] = () => {
                            // this.log(`store with offset: addr: ${(this.readRegister(rb) + offset).toString(16)}, value: ${this.readRegister(rd).toString(16)}`);
                            this.writeWord(this.readRegister(rb) + offset, this.readRegister(rd));
                        }
                        break;
                    default:
                        // todo
                        break;
                }
            }
            else if ((instruction & 0b1111011000000000) == 0b1011010000000000) {
                let l: boolean = !!(instruction & 0b0000100000000000);
                let r: boolean = !!(instruction & 0b0000000100000000);
                this._decodedInstructions[instructionIndex] = () => {
                    // this.log(`push/pop reg: load/store: ${l}, pc/lr: ${r}, rlist: ${(0xff & instruction).toString(2)}`);
                    var mask = 1;
                    for (var i = 0; i <= 8; i++) {
                        if (instruction & mask) {
                            this.writeWord(this.readRegister(this.spIndex), this.readRegister(i));
                            this.incrementSp(4);
                        }
                        mask = mask << 1;
                    }
                    if (r) {
                        this.writeWord(this.readRegister(this.spIndex), this.readRegister(this.lrIndex));
                        this.incrementSp(4);
                    }
                };
            }
            
            else if ((instruction & 0b1111000000000000) == 0b1101000000000000) {
                let condition: number = (instruction & 0b0000111100000000) >> 8;
                let offset: number =    (instruction & 0b0000000011111111);
                // Handle negative
                if (offset & 0b10000000) offset |= ~0b11111111;
                offset = offset << 1;
                switch (condition) {
                    case 0b0001: // BNE
                        this._decodedInstructions[instructionIndex] = () => {
                            // this.log(`BNE ${offset}`);
                            if (!this.condZ) {
                                this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) - 2 + offset);
                                this.incrementPc();
                            }
                            // else console.log(`EQUAL at ${i}`);
                        };
                        break;
                    default:
                        // todo
                        break;
                }
            }
            else if ((instruction & 0b1111100000000000) == 0b1110000000000000) {
                let offset: number = (instruction & 0b0000011111111111);
                // Handle negative
                if (offset & 0b0000010000000000) offset |= ~0b0000011111111111;
                offset = offset << 1;
                this._decodedInstructions[instructionIndex] = () => {
                    // this.log(`unconditional branch to ${(this.readRegister(this.pcIndex) + offset).toString(16)}`)
                    this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) + offset);
                    this.incrementPc();
                };
            }
            else if ((instruction & 0b1111000000000000) == 0b1111000000000000) {
                let low: boolean = !!(instruction & 0b0000100000000000);
                let offset: number = instruction & 0b0000011111111111;
                if (!low) {
                    // Handle negative
                    if (offset & 0b0000010000000000) offset |= ~0b0000011111111111;
                    this._decodedInstructions[instructionIndex] = () => {
                        // this.log(`long branch with link: high, offset: ${offset}`);
                        this.setRegister(this.lrIndex, this.readRegister(this.pcIndex) + (offset << 12));
                    };
                }
                else {
                    this._decodedInstructions[instructionIndex] = () => {
                        // this.log(`long branch with link: low, offset: ${offset}`);
                        // todo figure out prefetch
                        var nextInstruction: number = this.readRegister(this.pcIndex) - 2;
                        this.setRegister(this.pcIndex, this.readRegister(this.lrIndex) + (offset << 1));
                        this.setRegister(this.lrIndex, nextInstruction | 1);
                        this.incrementPc();
                    };
                }
            }
        }
        {
            let bar = 2;
            this._decodedInstructions[0] = () => {
                this.foo += bar;
                //this.incrementPc();
                //this.setStatusRegister(2, 1, 1);
                var a = this.readRegister(1);
                //var b = this.readRegister(2);
                //this.setStatusRegister(a, b, 1);
                
            }
        }
    }
}
