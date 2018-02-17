import { Atsamd21 } from './atsamd21';
import { St7735 } from './st7735';
import { Buttons } from './buttons';

export class Emulator {
    atsamd21:Atsamd21;
    screen:St7735;
    buttons:Buttons;
    ctx:CanvasRenderingContext2D;
    running:boolean;
    autoStart:boolean = true;
    loading:boolean = false;
    
    private _total:number;

    constructor(locationId:string) {
        var canvas = <HTMLCanvasElement>document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 256;
        document.getElementById(locationId).appendChild(canvas);
        this.ctx = canvas.getContext("2d");
    }

    loadFromUrl(url:string): void {
        this.loading = true;

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
        this.loading = false;
        
        this.screen = new St7735(this.atsamd21.sercom4, this.atsamd21.portA, this.atsamd21.portB, this.ctx);
        // Clear the canvas
        this.screen.clear();
    
        this.buttons = new Buttons(this.atsamd21.sercom4, this.atsamd21.portA, this.atsamd21.portB);
    
        if (this.autoStart) {
            this.start();
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
            var runFunc = () => { this.run(); };
            const loopCount = 30000;
            var priorTick = this.atsamd21.tickCount;
            var count = loopCount;
            for (var i = 0; i < count; i++) {
                this.atsamd21.step();
                this.atsamd21.step();
                this.atsamd21.step();
                this.atsamd21.step();
                this.atsamd21.step();
                this.atsamd21.step();
                this.atsamd21.step();
                this.atsamd21.step();
                this.atsamd21.step();
                this.atsamd21.step();
            }
            this._total += this.atsamd21.tickCount - priorTick;
    
            this.screen.updateCanvas();
    
            if (this.running) {
                setTimeout(runFunc, 0);
            }
        }
        catch (error) {
            this.running = false;
            
            throw error;
        }
    }
}
