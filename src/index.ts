import { Atsamd21 } from './atsamd21';
import { St7735 } from './st7735';
import { Buttons } from './buttons';

// Max steps to execute per `run()`
const maxLoopCount = 500000;
const programOffset = 0x4000;

export class Emulator {
    autoStart:boolean = true;
    loading:boolean = false;

    private _atsamd21:Atsamd21;
    private _screen:St7735;
    private _buttons:Buttons;
    private _ctx:CanvasRenderingContext2D;
    private _running:boolean;
    private _loopCount = maxLoopCount;
    private _customKeymap:number[][];
    private _lastTickCount:number;

    constructor(locationId:string) {
        // Create the canvas where the screen will be displayed
        var canvas = <HTMLCanvasElement>document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 256;
        document.getElementById(locationId).appendChild(canvas);
        this._ctx = canvas.getContext("2d");
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
        this._atsamd21 = new Atsamd21();
        this._atsamd21.loadFlash(new Uint8Array(buffer), programOffset);
        this.loading = false;
        
        this._screen = new St7735(this._atsamd21.sercom4, this._atsamd21.portA, this._atsamd21.portB, this._ctx);
        // Clear the canvas
        this._screen.clear();
    
        this._buttons = new Buttons(this._atsamd21.sercom4, this._atsamd21.portA, this._atsamd21.portB);
        if (this._customKeymap) {
            this._buttons.setKeymap(this._customKeymap);
        }
        
        if (this.autoStart) {
            this.start();
        }
    }

    reset() {
        this._screen.clear();
        this._atsamd21.reset(programOffset);
        this._lastTickCount = this._atsamd21.tickCount;
    }

    start() {
        if (!this._running) {
            this._running = true;
            this.run();
            this._lastTickCount = this._atsamd21.tickCount;
            setTimeout(() => { this.performanceMonitor(); }, 1000);
        }
    }

    stop() {
        this._running = false;
    }

    private run() {
        try {
            var runFunc = () => { this.run(); };
            
            // Run some number of steps in the microcontroller
            for (var i = 0; i < this._loopCount; i++) {
                this._atsamd21.step();
            }
    
            this._screen.updateCanvas();
    
            if (this._running) {
                setTimeout(runFunc, 0);
            }
        }
        catch (error) {
            this._running = false;
            
            throw error;
        }
    }

    private performanceMonitor() {
        // Try to slow down or speed up based on how many cycles we are able to complete per second.
        const goalTicks = 20000000; // Based off of hack in ATSAMD21. Realistic would be 48M. 
        var factor = goalTicks / (this._atsamd21.tickCount - this._lastTickCount);

        this._loopCount = Math.round(this._loopCount * factor);
        if (this._loopCount > maxLoopCount || this._loopCount < 0) this._loopCount = maxLoopCount;

        if (this._running) {
            this._lastTickCount = this._atsamd21.tickCount;
            setTimeout(() => { this.performanceMonitor(); }, 1000);
        }
    }

    setKeymap(keymap:number[][]) {
        this._customKeymap = keymap;

        if (this._buttons) {
            this._buttons.setKeymap(this._customKeymap);
        }
    }

    setButtonData(buttonData: number) {
        if (this._buttons) {
            this._buttons.customButtonData(buttonData);
        }
    }
}
