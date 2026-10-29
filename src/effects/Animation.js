// Pixi v8 supplies a Ticker object; older callers may supply frame units.
export function deltaMS(tick) {
    const ms = typeof tick === "number" ? tick * (1000 / 60) : tick?.deltaMS;
    return Number.isFinite(ms) && ms >= 0 ? ms : 0;
}

export function animate(owner, ticker, duration, draw) {
    owner._animations ??= new Set();
    return new Promise((resolve, reject) => {
        let elapsed = 0;
        const finish = (completed = false) => {
            ticker.remove(update);
            owner._animations.delete(finish);
            resolve(completed);
        };
        const update = tick => {
            if (owner.destroyed) return finish();
            elapsed += deltaMS(tick);
            const t = duration <= 0 ? 1 : Math.min(elapsed / duration, 1);
            try { draw(t); }
            catch (error) {
                ticker.remove(update);
                owner._animations.delete(finish);
                reject(error);
                return;
            }
            if (t >= 1) finish(true);
        };
        owner._animations.add(finish);
        ticker.add(update);
    });
}

export function cancelAnimations(owner) {
    for (const cancel of owner._animations ?? []) cancel();
}
