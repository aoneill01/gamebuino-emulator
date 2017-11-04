import * as fs from 'fs';

class Atsamd21 {
    memory: Uint32Array;
    // Stack pointer
    sp: number;
    // Program counter
    pc: number;
    // Link register
    lr: number;
    instruction: number;
    registers: number[] = [];

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

    reset() {
        this.pc = this.fetchHalfword(0x0004) & ~1; // set bit 0 to 0. 
        console.log(`init pc: ${this.pc.toString(16)}`);
        // pc one instruction ahead due to pipeline.
        this.pc += 2;
    }

    run() {
        this.reset();
        
        for (var i = 0; i < 9; i++) {
            this.instruction = this.fetchHalfword(this.pc - 2);
            this.pc += 2;

            console.log(`inst at ${(this.pc - 4).toString(16)}: ${this.instruction.toString(16)}`);
            
            if ((this.instruction & 0b1110000000000000) == 0b0000000000000000) {
                let opcode: number = (this.instruction & 0b0001100000000000) >> 11;
                let offset: number = (this.instruction & 0b0000011111000000) >> 6;
                let rs: number =     (this.instruction & 0b0000000000111000) >> 3;
                let rd: number =     (this.instruction & 0b0000000000000111);
                switch (opcode) {
                    case 0: // LSL
                    console.log(`LSL: rd: ${rd}, rs: ${rs}, offset: ${offset}`);
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
                let rd: number = (this.instruction & 0b0000011100000000) >> 8;
                let immediateValue: number = this.instruction & 0b11111111;
                switch (opcode) {
                    case 0: // mov
                        console.log(`Move immediate: rd: ${rd}, immediate value: ${immediateValue}`);
                        this.setRegister(rd, immediateValue);
                        // TODO set flags
                        break;
                    case 1: // cmp
                        break;
                    case 2: // add
                        break;
                    case 3: // sub
                        break;
                }
            }
            else if ((this.instruction & 0b1111100000000000) == 0b0100100000000000) {
                let rd: number = (this.instruction & 0b0000011100000000) >> 8;
                let immediateValue: number = (this.instruction & 0xff) << 2;
                let readValue: number = this.fetchWord((this.pc & ~0b10) + immediateValue);
                console.log(`PC-relative load: rd: ${rd}, immediate value: ${immediateValue}, read value: ${readValue.toString(16)}`);
                this.setRegister(rd, readValue)
            }
            else if ((this.instruction & 0b1110000000000000) == 0b0110000000000000) {
                let bl: number =     (this.instruction & 0b0001100000000000) >> 11;
                let offset: number = (this.instruction & 0b0000011111000000) >> 6;
                let rb: number =     (this.instruction & 0b0000000000111000) >> 3;
                let rd: number =     (this.instruction & 0b0000000000000111);

                switch (bl) {
                    case 0: // store to memory, transfer word
                        console.log(`store with offset: addr: ${(this.readRegister(rb) + offset).toString(16)}, value: ${this.readRegister(rd).toString(16)}`);
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
                console.log(`push/pop reg: load/store: ${l}, pc/lr: ${r}, rlist: ${(0xff & this.instruction).toString(2)}`);
                let mask = 1;
                for (let i = 0; i <= 8; i++) {
                    if (this.instruction & mask) {
                        this.writeWord(this.sp, this.registers[i]);
                        this.sp++;
                    }
                    mask = mask << 1;
                }
                if (r) {
                    this.writeWord(this.sp, this.lr);
                    this.sp++;
                }
            }
            else if ((this.instruction & 0b1111000000000000) == 0b1111000000000000) {
                let low: boolean = !!(this.instruction & 0b0000100000000000);
                let offset: number = this.instruction & 0b0000011111111111;
                if (!low) {
                    // Handle negative
                    if (offset & 0b0000010000000000) offset |= ~0b0000011111111111;
                    console.log(`long branch with link: high, offset: ${offset}`);
                    this.lr = this.pc + (offset << 12);
                }
                else {
                    console.log(`long branch with link: low, offset: ${offset}`);
                    // todo figure out prefetch
                    let tmp: number = this.pc - 2;
                    this.pc = this.lr + (offset << 1) + 2;
                    this.lr = tmp | 1;
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