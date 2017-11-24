import { PortRegister } from "./port-register";

const PORTA_OFFSET: number = 0x41004400;
const PORTB_OFFSET: number = 0x41004480;

export class Atsamd21 {
    private _flash: Uint8Array;
    private _sram: Uint8Array;
    private _decodedInstructions: {():void}[] = [];

    registers: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    condN: boolean;
    condZ: boolean;
    condV: boolean;
    condC: boolean;

    private _peripheralWriteHandlers: ((addr: number, value: number) => void)[] = [];
    private _peripheralReadHandlers: ((addr: number) => number)[] = [];

    portA: PortRegister;
    portB: PortRegister;
    
    cycleCount: number = 0;

    // Stack pointer
    readonly spIndex = 13;
    // Link register
    readonly lrIndex = 14;
    // Program counter
    readonly pcIndex = 15;

    readonly debug: boolean = true;

    constructor() {
        this._flash = new Uint8Array(0x40000); // 256KB 
        for (var i = 0; i < this._flash.length; i++) this._flash[i] = 0xff;
        this._sram = new Uint8Array(0x8000); // 32KB 
        for (var i = 0; i < this._sram.length; i++) this._sram[i] = 0xff;
        
        this.portA = new PortRegister(PORTA_OFFSET, this);
        this.portB = new PortRegister(PORTB_OFFSET, this);
    }

    loadFlash(contents: Uint8Array, offset: number = 0) {
        for (var i = 0; i < contents.length; i++) {
            this._flash[i + offset] = contents[i];
        }
        this.reset(offset);

        this._decodedInstructions = [];
        this.decodeInstructions();
    }

    fetchHalfword(addr: number): number {
        if (addr < 0x20000000) {
            return this._flash[addr] | (this._flash[addr + 1] << 8);
        }
        if (addr < 0x40000000) {
            addr -= 0x20000000;
            return this._sram[addr] | (this._sram[addr + 1] << 8);
        }
        this.log("NO HANDLER");
        return 0;
    }

    fetchWord(addr: number): number {
        if (addr < 0x20000000) {
            return (this._flash[addr] | (this._flash[addr + 1] << 8) | (this._flash[addr + 2] << 16) | (this._flash[addr + 3] << 24)) >>> 0;
        }
        if (addr < 0x40000000) {
            addr -= 0x20000000;
            return (this._sram[addr] | (this._sram[addr + 1] << 8) | (this._sram[addr + 2] << 16) | (this._sram[addr + 3] << 24)) >>> 0;
        }
        // TODO Implement separate handler
        if (addr == 0x4000080c) {
            // Hack for PCLKSR
            return 0b11010010; // DFLLLCKC, DFLLLCKF, DFLLRDY, XOSC32KRDY
        }
        this.log("NO HANDLER");
        return 0;
    }

    fetchByte(addr: number): number {
        if (addr < 0x20000000) {
            return this._flash[addr];
        }
        if (addr < 0x40000000) {
            addr -= 0x20000000;
            return this._sram[addr];
        }
        // TODO Implement separate handler
        if (addr == 0x40000c00) {
            // Hack for GCLK CTRL
            return 0; // There is no reset operation ongoing
        }
        this.log("NO HANDLER");
        return 0;
    }

    writeWord(addr: number, value: number) {
        // Flash
        if (addr < 0x20000000) {
            /* this._flash[addr] = value & 0xff;
            this._flash[addr + 1] = (value >> 8) & 0xff;
            this._flash[addr + 2] = (value >> 16) & 0xff;
            this._flash[addr + 3] = (value >> 24) & 0xff; */
            this.log("Shouldn't write to flash???");
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
            var handler = this._peripheralWriteHandlers[addr];
            if (handler) {
                handler(addr, value);
            }
            else {
                this.log("NO HANDLER");
            }
        }
    }

    writeHalfword(addr: number, value: number) {
        // Flash
        if (addr < 0x20000000) {
            /* this._flash[addr] = value & 0xff;
            this._flash[addr + 1] = (value >> 8) & 0xff;
            this._flash[addr + 2] = (value >> 16) & 0xff;
            this._flash[addr + 3] = (value >> 24) & 0xff; */
            this.log("Shouldn't write to flash???");
        }
        // SRAM
        else if (addr < 0x40000000) {
            addr -= 0x20000000;
            this._sram[addr] = value & 0xff;
            this._sram[addr + 1] = (value >> 8) & 0xff;
        }
        // Peripheral 
        else if (addr < 0x60000000) {
            // TODO let handler know if this is a word, halfword or byte.
            var handler = this._peripheralWriteHandlers[addr];
            if (handler) {
                handler(addr, value);
            }
            else {
                this.log("NO HANDLER");
            }
        }
    }

    writeByte(addr: number, value: number) {
        // Flash
        if (addr < 0x20000000) {
            this.log("Shouldn't write to flash???");
        }
        // SRAM
        else if (addr < 0x40000000) {
            this._sram[addr - 0x20000000] = value;
        }
        // Peripheral 
        else if (addr < 0x60000000) {
            var handler = this._peripheralWriteHandlers[addr];
            if (handler) {
                handler(addr, value);
            }
            else {
                this.log("NO HANDLER");
            }
        }
    }

    setRegister(index: number, value: number) {
        this.registers[index] = value;
    }

    readRegister(index: number): number {
        return this.registers[index];
    }

    registerPeripheralWriteHandler(address: number, handler: (address: number, value: number) => void) {
        this._peripheralWriteHandlers[address] = handler;
    }

    registerPeripheralReadHandler(address: number, handler: (address: number) => number) {
        this._peripheralReadHandlers[address] = handler;
    }

    private incrementPc() {
        this.registers[this.pcIndex]+=2;
        // this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) + 2);
    }

    private pushStack(value: number) {
        // TODO: Should SP be decremented before writing?
        this.writeWord(this.readRegister(this.spIndex), value);
        this.log(`${value} pushed to 0x${this.readRegister(this.spIndex).toString(16)}`);
        this.setRegister(this.spIndex, this.readRegister(this.spIndex) - 4);
    }

    private popStack(register: number) {
        this.setRegister(this.spIndex, this.readRegister(this.spIndex) + 4);
        this.setRegister(register, this.fetchWord(this.readRegister(this.spIndex)));
        this.log(`${this.fetchWord(this.readRegister(this.spIndex))} popped from 0x${this.readRegister(this.spIndex).toString(16)}`);
    }

    private addAndSetCondition(n1: number, n2: number): number {
        var n1Unsigned = (n1 & 0xffffffff) >>> 0;
        var n2Unsigned = (n2 & 0xffffffff) >>> 0;
        var result = n1Unsigned + n2Unsigned;
        this.condC = result > 0xffffffff;
        this.condZ = (result & 0xffffffff) == 0;
        this.condN = (result & 0x80000000) != 0;
        this.condV = (((n1Unsigned & 0x80000000) == (n2Unsigned & 0x80000000)) && ((n1Unsigned & 0x80000000) != (result & 0x80000000)));
        this.log(`c: ${this.condC}; z: ${this.condZ}; n: ${this.condN}; v: ${this.condV}`);
        return result & 0xffffffff;
    }

    private setNZ(result: number) {
        this.condN = result < 0;
        this.condZ = result == 0;
    }

    private log(message: string) {
        if (this.debug) {
            console.log(message);
        }
    }

    reset(offset: number) {
        this.setRegister(this.spIndex, this.fetchWord(0x0000 + offset));
        this.setRegister(this.lrIndex, 0xffffffff);
        this.setRegister(this.pcIndex, this.fetchHalfword(0x0004 + offset) & ~1); // set bit 0 to 0. 
        this.log(`init pc: ${this.readRegister(this.pcIndex).toString(16)}`);
        // pc one instruction ahead due to pipeline.
        this.incrementPc();
        // this.incrementPc();
    }

    step() {
        this.log(`; 0x${(this.readRegister(this.pcIndex) - 2).toString(16)}: 0x${this.fetchHalfword(this.readRegister(this.pcIndex) - 2).toString(16)}`);
        var instructionHandler = this._decodedInstructions[this.readRegister(this.pcIndex) - 2];
        this.incrementPc();
        instructionHandler();
    }

    speedTestNop(i: number) {
        var instructionHandler = this._decodedInstructions[i];        
        if (instructionHandler) instructionHandler();
    }

    private decodeInstructions() {
        for (var instructionIndex: number = 0; instructionIndex < this._flash.length; instructionIndex += 2) {
            // console.log(`${instructionIndex.toString(16)} of ${this._flash.length.toString(16)}`);
            var instruction: number;
        
            instruction = this.fetchHalfword(instructionIndex);
            // this.log(`inst at ${instructionIndex.toString(16)}: ${instruction.toString(16)}`);
            
            if ((instruction & 0b1110000000000000) == 0b0000000000000000) {
                let rs: number =     (instruction & 0b0000000000111000) >> 3;
                let rd: number =     (instruction & 0b0000000000000111);
                if ((instruction & 0b0001100000000000) != 0b0001100000000000) {
                    let opcode: number = (instruction & 0b0001100000000000) >> 11;
                    let offset: number = (instruction & 0b0000011111000000) >> 6;
                    switch (opcode) {
                        case 0: // LSL
                            this._decodedInstructions[instructionIndex] = () => {
                                var result = this.readRegister(rs) << offset;
                                this.log(`lsl r${rd}, r${rs}, #${offset} ; 0b${this.readRegister(rs).toString(2)} 0b${result.toString(2)}`);
                                this.setRegister(rd, result);
                                this.condC = (this.readRegister(rs) & (1 << offset)) != 0;
                                this.setNZ(result);
                            }
                            break;
                        case 1: // LSR
                            this._decodedInstructions[instructionIndex] = () => {
                                var result = this.readRegister(rs) >>> offset;
                                this.log(`lsr r${rd}, r${rs}, #${offset} ; 0b${this.readRegister(rs).toString(2)} 0b${result.toString(2)}`);
                                this.setRegister(rd, result);
                                this.condC = (this.readRegister(rs) & (1 << (32 - offset))) != 0;
                                this.setNZ(result);
                            }
                            break;
                        case 2: // ASR
                            this._decodedInstructions[instructionIndex] = () => {
                                var result = this.readRegister(rs) >> offset;
                                this.log(`lsr r${rd}, r${rs}, #${offset} ; 0b${this.readRegister(rs).toString(2)} 0b${result.toString(2)}`);
                                this.setRegister(rd, result);
                                this.condC = (this.readRegister(rs) & (1 << (32 - offset))) != 0;
                                this.setNZ(result);
                            }
                            break;
                    }
                }
                else {
                    let opcode: number = (instruction & 0b0000011000000000) >> 9;
                    let rnOffset: number = (instruction & 0b0000000111000000) >> 6;
                    switch (opcode) {
                        case 0b00: // ADD RN
                            this._decodedInstructions[instructionIndex] = () => {
                                this.log(`add r${rd}, r${rs}, r${rnOffset}`);
                                this.setRegister(rd, this.addAndSetCondition(this.readRegister(rs), this.readRegister(rnOffset)));
                            }
                            break;
                        case 0b10: // ADD Rd, Rs, #Offset3
                            this._decodedInstructions[instructionIndex] = () => {
                                this.log(`add r${rd}, r${rs}, #${rnOffset}`);
                                this.setRegister(rd, this.addAndSetCondition(this.readRegister(rs), rnOffset));
                            }
                            break;
                        case 0b01: // SUB Rd, Rs, Rn
                            this._decodedInstructions[instructionIndex] = () => {
                                this.log(`sub r${rd}, r${rs}, r${rnOffset}`);
                                this.setRegister(rd, this.addAndSetCondition(this.readRegister(rs), -this.readRegister(rd)));
                            }
                            break;
                        case 0b11: // SUB Rd, Rs, #Offset3
                            this._decodedInstructions[instructionIndex] = () => {
                                this.log(`sub r${rd}, r${rs}, #${rnOffset}`);
                                this.setRegister(rd, this.addAndSetCondition(this.readRegister(rs), -rnOffset));
                            }
                            break;
                    }
                }
            }
            else if ((instruction & 0b1110000000000000) == 0b0010000000000000) {
                let opcode: number = (instruction & 0b0001100000000000) >> 11;
                let rd: number =     (instruction & 0b0000011100000000) >> 8;
                let immediateValue: number = instruction & 0b11111111;
                switch (opcode) {
                    case 0: // mov
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`movs r${rd}, #${immediateValue} ; 0x${immediateValue.toString(16)}`);
                            this.setRegister(rd, immediateValue);
                            // TODO set flags
                        };
                        break;
                    case 1: // cmp
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`cmp r${rd}, #${immediateValue} ; #${this.readRegister(rd)}`);
                            this.addAndSetCondition(this.readRegister(rd), -immediateValue);
                        };
                        break;
                    case 2: // add
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`Add immediate: rd: ${rd}, immediate value: ${immediateValue}`)
                            this.setRegister(rd, this.addAndSetCondition(this.readRegister(rd), immediateValue));
                        };
                        break;
                    case 3: // sub
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`sub r${rd}, #${immediateValue}`)
                            this.setRegister(rd, this.addAndSetCondition(this.readRegister(rd), -immediateValue));
                        };
                        break;
                }
            }
            else if ((instruction & 0b1111110000000000) == 0b0100000000000000) {
                let opcode: number = (instruction & 0b0000001111000000) >> 6;
                let rs: number =     (instruction & 0b0000000000111000) >> 3;
                let rd: number =     (instruction & 0b0000000000000111);
                switch (opcode) {
                    case 0b0000: // AND
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`and r${rd}, r${rs}`);
                            var result = this.readRegister(rd) & this.readRegister(rs);
                            this.setRegister(rd, result);
                            this.setNZ(result);
                        };
                        break;
                    case 0b0010: // LSL
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`lsl r${rd}, r${rs}`);
                            var offset = this.readRegister(rs);
                            var result = this.readRegister(rd) << offset;
                            this.setRegister(rd, result);
                            this.condC = (this.readRegister(rs) & (1 << offset)) != 0;
                            this.setNZ(result);
                        };
                        break;
                    case 0b1010: // CMP Rd, Rs
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`cmp r${rd}, r${rs} ; 0x${this.readRegister(rd).toString(16)} - 0x${this.readRegister(rs).toString(16)}`);
                            this.addAndSetCondition(this.readRegister(rd), -this.readRegister(rs));
                        };
                        break;
                    case 0b1100: // ORR Rd, Rs ; Rd := Rd OR Rs
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`orr r${rd}, r${rs}`);
                            var result = this.readRegister(rd) | this.readRegister(rs);
                            this.setRegister(rd, result);
                            this.setNZ(result);
                        };
                        break;
                    case 0b1101: // MUL Rd, Rs ; Rd := Rd * Rs
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`mul r${rd}, r${rs}`);
                            var result = this.readRegister(rd) * this.readRegister(rs);
                            this.setRegister(rd, result);
                            this.setNZ(result);
                            // TODO V C flags
                        };
                        break;
                    case 0b1110: // BIC Rd, Rs ; Rd := Rd AND NOT Rs
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`bic r${rd}, r${rs}`);
                            var result = this.readRegister(rd) & ~this.readRegister(rs);
                            this.setRegister(rd, result);
                            this.setNZ(result);
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
                    case 0b0001:
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`add r${rdHd}, h${rsHs + 8}`);
                            this.setRegister(rdHd, this.addAndSetCondition(this.readRegister(rdHd), this.readRegister(rsHs + 8)));
                        };
                        break;
                    case 0b0010:
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`add h${rdHd + 8}, r${rsHs}`);
                            this.setRegister(rdHd + 8, this.addAndSetCondition(this.readRegister(rdHd + 8), this.readRegister(rsHs)));
                        };
                        break;
                    case 0b0011:
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`add h${rdHd + 8}, h${rsHs + 8}`);
                            this.setRegister(rdHd + 8, this.addAndSetCondition(this.readRegister(rdHd + 8), this.readRegister(rsHs + 8)));
                        };
                        break;
                    case 0b1001:
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`mov r${rdHd}, h${rsHs + 8}`);
                            this.setRegister(rdHd, this.readRegister(rsHs + 8));
                        };
                        break;
                    case 0b1010:
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`mov h${rdHd + 8}, r${rsHs}`);
                            this.setRegister(rdHd + 8, this.readRegister(rsHs));
                        };
                        break;
                    case 0b1011:
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`mov h${rdHd + 8}, h${rsHs + 8}`);
                            this.setRegister(rdHd + 8, this.readRegister(rsHs + 8));
                        };
                        break;
                    case 0b1101:
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`bx h${rsHs + 8}`);
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
                    this.log(`ldr r${rd}, [pc, #${immediateValue}] ; read value: 0x${readValue.toString(16)} from addr 0x${((this.readRegister(this.pcIndex) & ~0b10) + immediateValue).toString(16)}`);
                    this.setRegister(rd, readValue);
                };
            }
            else if ((instruction & 0b1111001000000000) == 0b0101000000000000) {
                let lb: number =     (instruction & 0b0000110000000000) >> 10;
                let ro: number =     (instruction & 0b0000000111000000) >> 6;
                let rb: number =     (instruction & 0b0000000000111000) >> 3;
                let rd: number =     (instruction & 0b0000000000000111);
                switch (lb) {
                    case 0b00:
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`str r${rd}, [r${rb}, r${ro}]`);
                            this.writeWord(this.readRegister(rb) + this.readRegister(ro), this.readRegister(rd));
                        }
                        break;
                    case 0b01:
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`strb r${rd}, [r${rb}, r${ro}]`);
                            this.writeByte(this.readRegister(rb) + this.readRegister(ro), this.readRegister(rd));
                        }
                        break;
                    case 0b10:
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`ldr r${rd}, [r${rb}, r${ro}]`);
                            this.setRegister(rd, this.fetchWord(this.readRegister(rb) + this.readRegister(ro)));
                        }
                        break;
                    case 0b11:
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`ldrb r${rd}, [r${rb}, r${ro}]`);
                            this.setRegister(rd, this.fetchByte(this.readRegister(rb) + this.readRegister(ro)));
                        }
                        break;
                }
            }
            else if ((instruction & 0b1111001000000000) == 0b0101001000000000) {
                let hs: number =     (instruction & 0b0000110000000000) >> 10;
                let ro: number =     (instruction & 0b0000000111000000) >> 6;
                let rb: number =     (instruction & 0b0000000000111000) >> 3;
                let rd: number =     (instruction & 0b0000000000000111);

                switch (hs) {
                    case 0b01:
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`ldsb r${rd}, [r${rb}, r${ro}]`);
                            var result = this.fetchByte(this.readRegister(rb) + this.readRegister(ro));
                            if (result & 0x80) result = result | (~0xff);
                            this.setRegister(rd, result);
                        };
                        break;
                }
            }
            else if ((instruction & 0b1110000000000000) == 0b0110000000000000) {
                let bl: number =     (instruction & 0b0001100000000000) >> 11;
                let offset: number = (instruction & 0b0000011111000000) >> 6;
                let rb: number =     (instruction & 0b0000000000111000) >> 3;
                let rd: number =     (instruction & 0b0000000000000111);

                switch (bl) {
                    case 0b00: // STR Rd, [Rb, #Imm]
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`str r${rd}, [r${rb}, 0x${(offset << 2).toString(16)}] ; addr 0x${(this.readRegister(rb) + (offset << 2)).toString(16)} set to 0x${(this.readRegister(rd)).toString(16)}`);
                            this.writeWord(this.readRegister(rb) + (offset << 2), this.readRegister(rd));
                        }
                        break;
                    case 0b01: // LDR Rd, [Rb, #Imm]
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`ldr r${rd}, [r${rb}, 0x${(offset << 2).toString(16)}] ; addr 0x${(this.readRegister(rb) + (offset << 2)).toString(16)} has value ${this.fetchWord(this.readRegister(rb) + (offset << 2))}`);
                            this.setRegister(rd, this.fetchWord(this.readRegister(rb) + (offset << 2)));
                        }
                        break;
                    case 0b10: // STRB Rd, [Rb, #Imm]
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`strb r${rd}, [r${rb}, 0x${offset.toString(16)}] ; addr 0x${(this.readRegister(rb) + offset).toString(16)} set to 0x${(this.readRegister(rd) & 0xff).toString(16)}`);
                            this.writeByte(this.readRegister(rb) + offset, this.readRegister(rd) & 0xff);
                        }
                        break;
                    case 0b11: 
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`ldrb r${rd}, [r${rb}, 0x${offset.toString(16)}] ; addr 0x${(this.readRegister(rb) + offset).toString(16)} has value ${this.fetchByte(this.readRegister(rb) + offset)}`);
                            this.setRegister(rd, this.fetchByte(this.readRegister(rb) + offset));
                        }
                        break;
                }
            }
            else if ((instruction & 0b1111000000000000) == 0b1000000000000000) {
                let l: boolean =   !!(instruction & 0b0000100000000000);
                let offset: number = (instruction & 0b0000011111000000) >> 6;
                let rb: number =     (instruction & 0b0000000000111000) >> 3;
                let rd: number =     (instruction & 0b0000000000000111);
                if (l) {
                    this._decodedInstructions[instructionIndex] = () => {
                        this.log(`strh r${rd}, [r${rb}, 0x${(offset << 1).toString(16)}] ; addr 0x${(this.readRegister(rb) + (offset << 1)).toString(16)} set to 0x${(0xffff & this.readRegister(rd)).toString(16)}`);
                        this.writeHalfword(this.readRegister(rb) + (offset << 1), this.readRegister(rd));
                    }
                }
                else {
                    this._decodedInstructions[instructionIndex] = () => {
                        this.log(`ldrh r${rd}, [r${rb}, 0x${(offset << 1).toString(16)}]`);
                        this.setRegister(rd, 0xffff & this.fetchHalfword(this.readRegister(rb) + (offset << 1)));
                    }
                }
            }
            else if ((instruction & 0b1111011000000000) == 0b1011010000000000) {
                let l: boolean = !!(instruction & 0b0000100000000000);
                let r: boolean = !!(instruction & 0b0000000100000000);
                let rlist: number = 0xff & instruction;
                if (!l && !r) {
                    this._decodedInstructions[instructionIndex] = () => {
                        this.log(`push {${(rlist & (1<<0)) ? 'r0, ' : ''}${(rlist & (1<<1)) ? 'r1, ' : ''}${(rlist & (1<<2)) ? 'r2, ' : ''}${(rlist & (1<<3)) ? 'r3, ' : ''}${(rlist & (1<<4)) ? 'r4, ' : ''}${(rlist & (1<<5)) ? 'r5, ' : ''}${(rlist & (1<<6)) ? 'r6, ' : ''}${(rlist & (1<<7)) ? 'r7, ' : ''}}`);
                        
                        var mask = 1;
                        for (var i = 0; i < 8; i++) {
                            if (rlist & mask) {
                                this.pushStack(this.readRegister(i));
                            }
                            mask = mask << 1;
                        }
                    };
                }
                if (!l && r) {
                    this._decodedInstructions[instructionIndex] = () => {
                        this.log(`push {${(rlist & (1<<0)) ? 'r0, ' : ''}${(rlist & (1<<1)) ? 'r1, ' : ''}${(rlist & (1<<2)) ? 'r2, ' : ''}${(rlist & (1<<3)) ? 'r3, ' : ''}${(rlist & (1<<4)) ? 'r4, ' : ''}${(rlist & (1<<5)) ? 'r5, ' : ''}${(rlist & (1<<6)) ? 'r6, ' : ''}${(rlist & (1<<7)) ? 'r7, ' : ''}lr}`);
                        
                        var mask = 1;
                        for (var i = 0; i < 8; i++) {
                            if (rlist & mask) {
                                this.pushStack(this.readRegister(i));
                            }
                            mask = mask << 1;
                        }
                        this.pushStack(this.readRegister(this.lrIndex));
                    };
                }
                if (l && r) {
                    this._decodedInstructions[instructionIndex] = () => {
                        this.log(`pop {${(rlist & (1<<0)) ? 'r0, ' : ''}${(rlist & (1<<1)) ? 'r1, ' : ''}${(rlist & (1<<2)) ? 'r2, ' : ''}${(rlist & (1<<3)) ? 'r3, ' : ''}${(rlist & (1<<4)) ? 'r4, ' : ''}${(rlist & (1<<5)) ? 'r5, ' : ''}${(rlist & (1<<6)) ? 'r6, ' : ''}${(rlist & (1<<7)) ? 'r7, ' : ''}pc}`);
                        
                        this.popStack(this.pcIndex);
                        this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) & (~1)); // THUMB
                        this.incrementPc();

                        var mask = 1 << 7;
                        for (var i = 7; i >= 0; i--) {
                            if (rlist & mask) {
                                this.popStack(i);
                            }
                            mask = mask >> 1;
                        }
                    };
                }
                if (l && !r) {
                    this._decodedInstructions[instructionIndex] = () => {
                        this.log(`pop {${(rlist & (1<<0)) ? 'r0, ' : ''}${(rlist & (1<<1)) ? 'r1, ' : ''}${(rlist & (1<<2)) ? 'r2, ' : ''}${(rlist & (1<<3)) ? 'r3, ' : ''}${(rlist & (1<<4)) ? 'r4, ' : ''}${(rlist & (1<<5)) ? 'r5, ' : ''}${(rlist & (1<<6)) ? 'r6, ' : ''}${(rlist & (1<<7)) ? 'r7, ' : ''}}`);
                        
                        var mask = 1 << 7;
                        for (var i = 7; i >= 0; i--) {
                            if (rlist & mask) {
                                this.popStack(i);
                            }
                            mask = mask >> 1;
                        }
                    };
                }
            }
            else if ((instruction & 0b1111111100000000) == 0b1011001000000000) {
                let opcode: number = (instruction & 0b0000000011000000) >> 6;
                let rm: number =     (instruction & 0b0000000000111000) >> 3;
                let rd: number =     (instruction & 0b0000000000000111);
                switch (opcode) {
                    case 0b01: // signed extend byte
                        this._decodedInstructions[instructionIndex] = () => {
                            var result = this.readRegister(rm) & 0xff;
                            if (result & 0x80) {
                                result = (~0xff) | result;
                            }
                            this.setRegister(rd, result);
                            this.log(`stxb r${rd}, r${rm} ; ${result.toString(16)}`);
                        };
                        break;
                }
            }
            else if ((instruction & 0b1111000000000000) == 0b1100000000000000) {
                let load: boolean = (instruction & 0b0000100000000000) != 0;
                let rb: number =    (instruction & 0b0000011100000000) >> 8;
                let rlist: number = (instruction & 0b0000000011111111);
                if (load) {
                    
                }
                else {
                    this._decodedInstructions[instructionIndex] = () => {
                        this.log(`stmia r${rb}!, {${(rlist & (1<<0)) ? 'r0, ' : ''}${(rlist & (1<<1)) ? 'r1, ' : ''}${(rlist & (1<<2)) ? 'r2, ' : ''}${(rlist & (1<<3)) ? 'r3, ' : ''}${(rlist & (1<<4)) ? 'r4, ' : ''}${(rlist & (1<<5)) ? 'r5, ' : ''}${(rlist & (1<<6)) ? 'r6, ' : ''}${(rlist & (1<<7)) ? 'r7, ' : ''}}`);
                        
                        var mask = 1;
                        var addr = this.readRegister(rb);
                        for (var i = 0; i < 8; i++) {
                            if (rlist & mask) {
                                this.writeWord(addr, this.readRegister(i));
                                addr += 4;
                            }
                            mask = mask << 1;
                        }
                        this.setRegister(rb, addr);
                    };
                }
            }
            else if ((instruction & 0b1111000000000000) == 0b1101000000000000) {
                let condition: number = (instruction & 0b0000111100000000) >> 8;
                let offset: number =    (instruction & 0b0000000011111111);
                // Handle negative
                if (offset & 0b10000000) offset |= ~0b11111111;
                offset = offset << 1;
                switch (condition) {
                    case 0b0000: // BEQ: branch if zero
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`beq <0x${offset.toString(16)}>`);
                            if (this.condZ) {
                                this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) + offset);
                                this.incrementPc();
                            }
                        };
                        break;
                    case 0b0001: // BNE: branch if not zero
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`bne <0x${offset.toString(16)}>`);
                            if (!this.condZ) {
                                this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) + offset);
                                this.incrementPc();
                            }
                        };
                        break;
                    case 0b0010: // BCS: branch if carry set
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`bcs <0x${offset.toString(16)}>`);
                            if (this.condC) {
                                this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) + offset);
                                this.incrementPc();
                            }
                        };
                        break;
                    case 0b0011: // BCC: branch if carry not set
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`bcc <0x${offset.toString(16)}>`);
                            if (!this.condC) {
                                this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) + offset);
                                this.incrementPc();
                            }
                        };
                        break;
                    case 0b0100: // BMI: branch if N set (negative)
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`bmi <0x${offset.toString(16)}>`);
                            if (this.condN) {
                                this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) + offset);
                                this.incrementPc();
                            }
                        };
                        break;
                    case 0b0101: // BPL: branch if N clear (positive or zero)
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`bpl <0x${offset.toString(16)}>`);
                            if (!this.condN) {
                                this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) + offset);
                                this.incrementPc();
                            }
                        };
                        break;
                    case 0b0110: // BVS: branch if V set (overflow)
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`bvs <0x${offset.toString(16)}>`);
                            if (this.condV) {
                                this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) + offset);
                                this.incrementPc();
                            }
                        };
                        break;
                    case 0b0111: // BVC: branch if V clear (no overflow)
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`bvc <0x${offset.toString(16)}>`);
                            if (!this.condV) {
                                this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) + offset);
                                this.incrementPc();
                            }
                        };
                        break;
                    case 0b1000: // BHI: branch if C set and Z clear (unsigned higher)
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`bhi <0x${offset.toString(16)}>`);
                            if (this.condC && !this.condZ) {
                                this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) + offset);
                                this.incrementPc();
                            }
                        };
                        break;
                    case 0b1001: // BLS: branch if C clear or Z set (unsigned lower or same)
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`bls <0x${offset.toString(16)}>`);
                            if (!this.condC || this.condZ) {
                                this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) + offset);
                                this.incrementPc();
                            }
                        };
                        break;
                    case 0b1001: // BGE: branch if N set and V set, or N clear and V clear (greater or equal)
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`bge <0x${offset.toString(16)}>`);
                            if (this.condN == this.condV) {
                                this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) + offset);
                                this.incrementPc();
                            }
                        };
                        break;
                    case 0b1011: // BLT: branch if N set and V clear, or N clear and V set (less than)
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`blt <0x${offset.toString(16)}>`);
                            if (this.condN != this.condV) {
                                this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) + offset);
                                this.incrementPc();
                            }
                        };
                        break;
                    case 0b1100: // BGT: branch if Z clear, and either N set and V set or N clear and V clear (greater than)
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`bgt <0x${offset.toString(16)}>`);
                            if (!this.condZ && (this.condN == this.condV)) {
                                this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) + offset);
                                this.incrementPc();
                            }
                        };
                        break;
                    case 0b1101: // BLE: branch if Z set, or N set and V clear, or N clear and V set (less than or equal)
                        this._decodedInstructions[instructionIndex] = () => {
                            this.log(`ble <0x${offset.toString(16)}>`);
                            if (this.condZ || (this.condN != this.condV)) {
                                this.setRegister(this.pcIndex, this.readRegister(this.pcIndex) + offset);
                                this.incrementPc();
                            }
                        };
                        break;
                }
            }
            else if ((instruction & 0b1111100000000000) == 0b1110000000000000) {
                let offset: number = (instruction & 0b0000011111111111);
                // Handle negative
                if (offset & 0b0000010000000000) offset |= ~0b0000011111111111;
                offset = offset << 1;
                this._decodedInstructions[instructionIndex] = () => {
                    this.log(`b <0x${(this.readRegister(this.pcIndex) + offset).toString(16)}>`)
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
                        this.log(`long branch with link: high, offset: ${offset}`);
                        this.setRegister(this.lrIndex, this.readRegister(this.pcIndex) + (offset << 12));
                    };
                }
                else {
                    this._decodedInstructions[instructionIndex] = () => {
                        this.log(`long branch with link: low, offset: ${offset}`);
                        // todo figure out prefetch
                        var nextInstruction: number = this.readRegister(this.pcIndex) - 2;
                        this.setRegister(this.pcIndex, this.readRegister(this.lrIndex) + (offset << 1));
                        this.setRegister(this.lrIndex, nextInstruction | 1);
                        this.incrementPc();
                    };
                }
            }
        }
    }
}
