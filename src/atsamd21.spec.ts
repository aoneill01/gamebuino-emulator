import { Atsamd21 } from './atsamd21';
import { expect } from 'chai';
import 'mocha';
import * as fs from 'fs';

/*
fs.readFile('./blinker01.gcc.thumb.flash.bin', function(err, data) {  
    if (err) throw err;
    var memory = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) memory[0x0000 + i] = data[i];

    var micro = new Atsamd21();
    micro.loadFlash(memory);
    for (var i = 0; i < 48000000; i++) {
        micro.step();
    }
});
*/

describe('blinker01.gcc.thumb.flash.bin program', () => {
    var micro: Atsamd21;
    var flash: Uint8Array;

    before((done) => {
        fs.readFile('./blinker01.gcc.thumb.flash.bin', function(err, data) { 
            if (err) throw err;
            flash = new Uint8Array(data.length);
            for (let i = 0; i < data.length; i++) flash[i] = data[i];
            
            done();
        });
    })

    beforeEach(() => {
        micro = new Atsamd21();
        micro.loadFlash(flash);
    });

    it('loads correct initial state', () => {
        expect(micro.readRegister(micro.pcIndex)).to.equal(0x40 + 2 /* pipeline */);
        expect(micro.readRegister(micro.spIndex)).to.equal(0x20001000);
        expect(micro.readRegister(micro.lrIndex)).to.equal(0xffffffff);
    })

    it('executes first instruction', () => {
        // bl 64
        micro.step();
        micro.step();

        expect(micro.readRegister(micro.pcIndex)).to.equal(0x64 + 2 /* pipeline */);
    });

    it('executes first instruction of notmain', () => {
        var accessedPeripheral: boolean = false;
        micro.peripheralCallback = (addr: number, value: number) => { accessedPeripheral = true; }
        // bl 64
        micro.step();
        micro.step();
        // movs	r1, #128
        micro.step();

        expect(micro.readRegister(1)).to.equal(128);
        expect(accessedPeripheral).to.be.false;
    });

    
    it('turns on light', () => {
        var lightOn: boolean = false;
        micro.peripheralCallback = (addr: number, value: number) => { 
            if (addr == 0x41004418) {
                lightOn = true;
            }
        }
        
        for (let i = 0; i < 50000; i++) micro.step();

        expect(lightOn).to.be.true;
    });
})