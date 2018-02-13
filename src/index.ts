import { Atsamd21 } from './atsamd21';
import { St7735 } from './st7735';
import { Buttons } from './buttons';

export class Emulator {
    atsamd21:Atsamd21;
    screen:St7735;
    buttons:Buttons;
    ctx:CanvasRenderingContext2D;
    running:boolean;
    
    private _total:number;

    constructor(canvasId:string) {
        var canvas = <HTMLCanvasElement>document.getElementById(canvasId);
        this.ctx = canvas.getContext("2d");
    }

    loadFromUrl(url:string): void {
        var oReq = new XMLHttpRequest();
        
        oReq.onload = (e) => {
            this.loadFromBuffer(oReq.response);
        }

        oReq.open("GET", url);
        oReq.responseType = "arraybuffer";
        oReq.send();
    }

    loadFromBuffer(buffer: ArrayBuffer) {
        this.atsamd21 = new Atsamd21();
        this.atsamd21.loadFlash(new Uint8Array(buffer), 0x4000);
    
        this.screen = new St7735(this.atsamd21.sercom4, this.atsamd21.portA, this.atsamd21.portB, this.ctx);
        // Clear the canvas
        this.screen.clear();
    
        this.buttons = new Buttons(this.atsamd21.sercom4, this.atsamd21.portA, this.atsamd21.portB);
    
        if (!this.running) {
            this.running = true;
            this.run();
        }
    }

    reset() {
        this.screen.clear();
        this.atsamd21.reset(0x4000);
    }

    start() {
        if (!this.running) {
            this.running = true;
            this.run();
        }
    }

    stop() {
        this.running = false;
    }

    private run() {
        try {
            const loopCount = 480000;
            var priorTick = this.atsamd21.tickCount;
            var count = loopCount;
            for (var i = 0; i < count; i++) {
                this.atsamd21.step();
            }
            this._total += this.atsamd21.tickCount - priorTick;
    
            this.screen.updateCanvas();
    
            if (this.running) {
                setTimeout(() => { this.run(); }, 0);
            }
        }
        catch (error) {
            this.running = false;
            
            throw error;
        }
    }
}
