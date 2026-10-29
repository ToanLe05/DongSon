import { deltaMS, animate, cancelAnimations } from "./Animation.js";
import * as PIXI from "pixi.js";

export default class GlowEffect extends PIXI.Container {

    constructor(app, options = {}) {

        super();

        this.app = app;

        //---------------------------------------
        // Config
        //---------------------------------------

        this.radius = options.radius ?? 34;

        this.color = options.color ?? 0xff3333;

        this.lineWidth = options.lineWidth ?? 4;

        this.alpha = options.alpha ?? 0.9;

        this.speed = options.speed ?? 3.0;

        this.minScale = options.minScale ?? 0.95;

        this.maxScale = options.maxScale ?? 1.15;

        //---------------------------------------

        this.running = false;

        this.elapsed = 0;

        //---------------------------------------

        this.graphics = new PIXI.Graphics();

        this.addChild(this.graphics);

        this.redraw();

    }

    //----------------------------------------------------------
    // Draw
    //----------------------------------------------------------

    redraw() {

        this.graphics.clear();

        //----------------------------------
        // Outer Ring
        //----------------------------------

        this.graphics.circle(
            0,
            0,
            this.radius
        );

        this.graphics.stroke({

            color: this.color,

            width: this.lineWidth,

            alpha: this.alpha

        });

        //----------------------------------
        // Soft Fill
        //----------------------------------

        this.graphics.circle(
            0,
            0,
            this.radius - this.lineWidth
        );

        this.graphics.fill({

            color: this.color,

            alpha: 0.12

        });

    }

    //----------------------------------------------------------
    // Start Animation
    //----------------------------------------------------------

    start() {

        if (this.running)
            return;

        this.running = true;

        this.visible = true;

        this.elapsed = 0;

        this.app.ticker.add(
            this.update,
            this
        );

    }

    //----------------------------------------------------------

    stop() {
        cancelAnimations(this);

        if (!this.running)
            return;

        this.running = false;

        this.app.ticker.remove(
            this.update,
            this
        );

        this.scale.set(1);

        this.alpha = 1;

        this.rotation = 0;

        this.visible = false;

    }

    //----------------------------------------------------------
    // Pulse Once
    //----------------------------------------------------------

    pulse() {
        this.visible = true;
        return animate(this, this.app.ticker, 800, t => {
            this.scale.set(t === 1 ? 1 : 1 + 0.15 * Math.sin(t * 6.4));
            this.alpha = t === 1 ? 1 : 0.55 + 0.35 * Math.sin(t * 6.4);
        });
    }

    //----------------------------------------------------------
    // Update
    //----------------------------------------------------------

    update(delta) {
        delta = deltaMS(delta) / (1000 / 60);

        this.elapsed += delta / 60;

        //----------------------------------
        // Pulse
        //----------------------------------

        const t =
            (Math.sin(this.elapsed * this.speed * Math.PI * 2) + 1) / 2;

        const scale =
            this.minScale +
            (this.maxScale - this.minScale) * t;

        this.scale.set(scale);

        //----------------------------------
        // Alpha
        //----------------------------------

        this.alpha =
            0.45 + 0.45 * t;

        //----------------------------------
        // Rotate slowly
        //----------------------------------

        this.rotation += delta * 0.002;

    }

    //----------------------------------------------------------
    // Config
    //----------------------------------------------------------

    setColor(color) {

        this.color = color;

        this.redraw();

    }

    setRadius(radius) {

        this.radius = radius;

        this.redraw();

    }

    setLineWidth(width) {

        this.lineWidth = width;

        this.redraw();

    }

    //----------------------------------------------------------
    // Attach
    //----------------------------------------------------------

    attach(target) {

        if (!target)
            return;

        target.addChild(this);

        this.position.set(0, 0);

    }

    //----------------------------------------------------------

    detach() {

        if (this.parent) {

            this.parent.removeChild(this);

        }

    }

    //----------------------------------------------------------
    // Destroy
    //----------------------------------------------------------

    destroy(options) {

        this.stop();

        super.destroy(options);

    }

}
